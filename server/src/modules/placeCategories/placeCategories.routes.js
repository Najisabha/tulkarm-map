import { Router } from 'express';
import pool from '../../config/db.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { ApiError } from '../../utils/ApiError.js';
import { success } from '../../utils/response.js';

const router = Router();

function normalizeName(name) {
  return String(name || '').trim();
}

// GET /api/place-categories?parent_id=<uuid|null>
router.get('/place-categories', async (req, res, next) => {
  try {
    const parentIdRaw = req.query.parent_id;
    const parentId =
      parentIdRaw === undefined || parentIdRaw === null || String(parentIdRaw).trim() === ''
        ? null
        : String(parentIdRaw);

    const { rows } = await pool.query(
      `
        SELECT id, name, emoji, color, sort_order, parent_id, created_at, updated_at
        FROM place_categories
        WHERE ($1::uuid IS NULL AND parent_id IS NULL) OR parent_id = $1
        ORDER BY sort_order, name
      `,
      [parentId]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/place-categories/tree
router.get('/place-categories/tree', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT id, name, emoji, color, sort_order, parent_id
        FROM place_categories
        ORDER BY parent_id NULLS FIRST, sort_order, name
      `
    );

    const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
    const roots = [];
    for (const r of rows) {
      const node = byId.get(r.id);
      if (!r.parent_id) {
        roots.push(node);
      } else {
        const parent = byId.get(r.parent_id);
        if (parent) parent.children.push(node);
      }
    }
    return success(res, roots);
  } catch (err) {
    next(err);
  }
});

// POST /api/place-categories (admin)
router.post('/place-categories', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const name = normalizeName(req.body?.name);
    const emoji = req.body?.emoji === undefined || req.body?.emoji === null ? null : String(req.body.emoji).trim() || null;
    const color = req.body?.color === undefined || req.body?.color === null ? null : String(req.body.color).trim() || null;
    const sortOrder =
      req.body?.sort_order === undefined || req.body?.sort_order === null
        ? 0
        : parseInt(String(req.body.sort_order), 10);
    const parentId =
      req.body?.parent_id === undefined || req.body?.parent_id === null || String(req.body.parent_id).trim() === ''
        ? null
        : String(req.body.parent_id);

    if (!name) throw ApiError.badRequest('اسم التصنيف مطلوب');
    if (!Number.isFinite(sortOrder)) throw ApiError.badRequest('ترتيب غير صالح');

    if (parentId) {
      const { rows: parent } = await pool.query('SELECT id FROM place_categories WHERE id = $1', [parentId]);
      if (!parent[0]) throw ApiError.notFound('التصنيف الأب غير موجود');
    }

    const { rows } = await pool.query(
      `
        INSERT INTO place_categories (name, emoji, color, sort_order, parent_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [name, emoji, color, sortOrder, parentId]
    );
    return success(res, rows[0], 201);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/place-categories/:id (admin)
router.patch('/place-categories/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const updates = [];
    const values = [];
    let i = 1;

    if (req.body?.name !== undefined) {
      const name = normalizeName(req.body.name);
      if (!name) throw ApiError.badRequest('اسم التصنيف لا يمكن أن يكون فارغاً');
      updates.push(`name = $${i++}`);
      values.push(name);
    }
    if (req.body?.emoji !== undefined) {
      const emoji = req.body.emoji === null ? null : String(req.body.emoji).trim() || null;
      updates.push(`emoji = $${i++}`);
      values.push(emoji);
    }
    if (req.body?.color !== undefined) {
      const c = req.body.color === null ? null : String(req.body.color).trim() || null;
      updates.push(`color = $${i++}`);
      values.push(c);
    }
    if (req.body?.sort_order !== undefined) {
      const n = parseInt(String(req.body.sort_order), 10);
      if (!Number.isFinite(n)) throw ApiError.badRequest('ترتيب غير صالح');
      updates.push(`sort_order = $${i++}`);
      values.push(n);
    }
    if (req.body?.parent_id !== undefined) {
      const parentId =
        req.body.parent_id === null || String(req.body.parent_id).trim() === '' ? null : String(req.body.parent_id);
      if (parentId === id) throw ApiError.badRequest('لا يمكن أن يكون التصنيف أباً لنفسه');
      if (parentId) {
        const { rows: parent } = await pool.query('SELECT id FROM place_categories WHERE id = $1', [parentId]);
        if (!parent[0]) throw ApiError.notFound('التصنيف الأب غير موجود');
      }
      updates.push(`parent_id = $${i++}`);
      values.push(parentId);
    }

    if (updates.length === 0) throw ApiError.badRequest('لا يوجد شيء للتحديث');
    updates.push('updated_at = now()');
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE place_categories SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) throw ApiError.notFound('التصنيف غير موجود');
    return success(res, rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/place-categories/:id (admin)
router.delete('/place-categories/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const id = req.params.id;
    // منع حذف تصنيف مستخدم في الروابط
    const { rows: used } = await pool.query(
      `
        SELECT COUNT(*)::int AS cnt
        FROM place_category_links
        WHERE main_category_id = $1 OR sub_category_id = $1
      `,
      [id]
    );
    const cnt = used?.[0]?.cnt ?? 0;
    if (cnt > 0) throw ApiError.badRequest('لا يمكن حذف تصنيف مستخدم في أماكن');

    const { rowCount } = await pool.query('DELETE FROM place_categories WHERE id = $1', [id]);
    if (rowCount === 0) throw ApiError.notFound('التصنيف غير موجود');
    return success(res, { message: 'تم حذف التصنيف' });
  } catch (err) {
    next(err);
  }
});

export default router;

