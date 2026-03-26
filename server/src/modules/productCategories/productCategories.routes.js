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

// =========================
// Main categories
// =========================

// GET /api/product-categories
router.get('/product-categories', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          mc.id,
          mc.name,
          mc.emoji,
          mc.arrow_color,
          mc.sort_order,
          mc.created_at,
          mc.updated_at,
          COALESCE(sc.cnt, 0) AS subcategories_count
        FROM product_main_categories mc
        LEFT JOIN (
          SELECT main_category_id, COUNT(*)::int AS cnt
          FROM product_sub_categories
          GROUP BY main_category_id
        ) sc ON sc.main_category_id = mc.id
        ORDER BY mc.sort_order, mc.name
      `
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/product-categories (admin)
router.post('/product-categories', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const name = normalizeName(req.body?.name);
    const emoji = req.body?.emoji === undefined || req.body?.emoji === null ? null : String(req.body.emoji).trim() || null;
    const arrowColor =
      req.body?.arrow_color === undefined || req.body?.arrow_color === null
        ? null
        : String(req.body.arrow_color).trim() || null;
    const sortOrder =
      req.body?.sort_order === undefined || req.body?.sort_order === null
        ? 0
        : parseInt(String(req.body.sort_order), 10);

    if (!name) throw ApiError.badRequest('اسم التصنيف الرئيسي مطلوب');
    if (!Number.isFinite(sortOrder)) throw ApiError.badRequest('ترتيب غير صالح');

    const { rows } = await pool.query(
      `
        INSERT INTO product_main_categories (name, emoji, arrow_color, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [name, emoji, arrowColor, sortOrder]
    );
    return success(res, rows[0], 201);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/product-categories/:id (admin)
router.patch('/product-categories/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const updates = [];
    const values = [];
    let i = 1;

    if (req.body?.name !== undefined) {
      const name = normalizeName(req.body.name);
      if (!name) throw ApiError.badRequest('اسم التصنيف الرئيسي لا يمكن أن يكون فارغاً');
      updates.push(`name = $${i++}`);
      values.push(name);
    }
    if (req.body?.emoji !== undefined) {
      const emoji = req.body.emoji === null ? null : String(req.body.emoji).trim() || null;
      updates.push(`emoji = $${i++}`);
      values.push(emoji);
    }
    if (req.body?.arrow_color !== undefined) {
      const c = req.body.arrow_color === null ? null : String(req.body.arrow_color).trim() || null;
      updates.push(`arrow_color = $${i++}`);
      values.push(c);
    }
    if (req.body?.sort_order !== undefined) {
      const n = parseInt(String(req.body.sort_order), 10);
      if (!Number.isFinite(n)) throw ApiError.badRequest('ترتيب غير صالح');
      updates.push(`sort_order = $${i++}`);
      values.push(n);
    }

    if (updates.length === 0) throw ApiError.badRequest('لا يوجد شيء للتحديث');

    updates.push('updated_at = now()');
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE product_main_categories SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) throw ApiError.notFound('التصنيف الرئيسي غير موجود');
    return success(res, rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/product-categories/:id (admin)
router.delete('/product-categories/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const { rows: subRows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM product_sub_categories WHERE main_category_id = $1',
      [id]
    );
    const cnt = subRows?.[0]?.cnt ?? 0;
    if (cnt > 0) {
      throw ApiError.badRequest('لا يمكن حذف التصنيف الرئيسي قبل حذف التصنيفات الفرعية التابعة له');
    }

    const { rowCount } = await pool.query('DELETE FROM product_main_categories WHERE id = $1', [id]);
    if (rowCount === 0) throw ApiError.notFound('التصنيف الرئيسي غير موجود');
    return success(res, { message: 'تم حذف التصنيف الرئيسي' });
  } catch (err) {
    next(err);
  }
});

// =========================
// Sub categories
// =========================

// GET /api/product-categories/:id/subcategories
router.get('/product-categories/:id/subcategories', async (req, res, next) => {
  try {
    const mainId = req.params.id;
    const { rows: main } = await pool.query('SELECT id FROM product_main_categories WHERE id = $1', [mainId]);
    if (!main[0]) throw ApiError.notFound('التصنيف الرئيسي غير موجود');

    const { rows } = await pool.query(
      `
        SELECT id, main_category_id, name, emoji, arrow_color, sort_order, created_at, updated_at
        FROM product_sub_categories
        WHERE main_category_id = $1
        ORDER BY sort_order, name
      `,
      [mainId]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/product-categories/:id/subcategories (admin)
router.post('/product-categories/:id/subcategories', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const mainId = req.params.id;
    const name = normalizeName(req.body?.name);
    const emoji = req.body?.emoji === undefined || req.body?.emoji === null ? null : String(req.body.emoji).trim() || null;
    const arrowColor =
      req.body?.arrow_color === undefined || req.body?.arrow_color === null
        ? null
        : String(req.body.arrow_color).trim() || null;
    const sortOrder =
      req.body?.sort_order === undefined || req.body?.sort_order === null
        ? 0
        : parseInt(String(req.body.sort_order), 10);

    if (!name) throw ApiError.badRequest('اسم التصنيف الفرعي مطلوب');
    if (!Number.isFinite(sortOrder)) throw ApiError.badRequest('ترتيب غير صالح');

    const { rows: main } = await pool.query('SELECT id FROM product_main_categories WHERE id = $1', [mainId]);
    if (!main[0]) throw ApiError.notFound('التصنيف الرئيسي غير موجود');

    const { rows } = await pool.query(
      `
        INSERT INTO product_sub_categories (main_category_id, name, emoji, arrow_color, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [mainId, name, emoji, arrowColor, sortOrder]
    );
    return success(res, rows[0], 201);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/product-subcategories/:id (admin)
router.patch('/product-subcategories/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const updates = [];
    const values = [];
    let i = 1;

    if (req.body?.name !== undefined) {
      const name = normalizeName(req.body.name);
      if (!name) throw ApiError.badRequest('اسم التصنيف الفرعي لا يمكن أن يكون فارغاً');
      updates.push(`name = $${i++}`);
      values.push(name);
    }
    if (req.body?.emoji !== undefined) {
      const emoji = req.body.emoji === null ? null : String(req.body.emoji).trim() || null;
      updates.push(`emoji = $${i++}`);
      values.push(emoji);
    }
    if (req.body?.arrow_color !== undefined) {
      const c = req.body.arrow_color === null ? null : String(req.body.arrow_color).trim() || null;
      updates.push(`arrow_color = $${i++}`);
      values.push(c);
    }
    if (req.body?.sort_order !== undefined) {
      const n = parseInt(String(req.body.sort_order), 10);
      if (!Number.isFinite(n)) throw ApiError.badRequest('ترتيب غير صالح');
      updates.push(`sort_order = $${i++}`);
      values.push(n);
    }
    if (updates.length === 0) throw ApiError.badRequest('لا يوجد شيء للتحديث');

    updates.push('updated_at = now()');
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE product_sub_categories SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) throw ApiError.notFound('التصنيف الفرعي غير موجود');
    return success(res, rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/product-subcategories/:id (admin)
router.delete('/product-subcategories/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const { rowCount } = await pool.query('DELETE FROM product_sub_categories WHERE id = $1', [id]);
    if (rowCount === 0) throw ApiError.notFound('التصنيف الفرعي غير موجود');
    return success(res, { message: 'تم حذف التصنيف الفرعي' });
  } catch (err) {
    next(err);
  }
});

export default router;

