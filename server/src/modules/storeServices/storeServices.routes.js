import { Router } from 'express';
import pool from '../../config/db.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../utils/ApiError.js';
import { success } from '../../utils/response.js';

const router = Router({ mergeParams: true });

async function assertOwnerOrAdmin(req, placeId) {
  if (!req.user) throw ApiError.unauthorized('يجب تسجيل الدخول');
  if (req.user.role === 'admin') return;
  const { rows } = await pool.query(
    'SELECT owner_id FROM places WHERE id = $1 AND deleted_at IS NULL',
    [placeId]
  );
  if (!rows[0]) throw ApiError.notFound('المتجر غير موجود');
  if (rows[0].owner_id !== req.user.id) {
    throw ApiError.forbidden('ليس لديك صلاحية لإدارة هذا المتجر');
  }
}

function rowToService(r) {
  if (!r) return r;
  return { ...r, store_id: r.place_id };
}

// GET /api/stores/:storeId/services
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM store_services WHERE place_id = $1 AND is_available = true
       ORDER BY sort_order, name`,
      [req.params.storeId]
    );
    return success(res, rows.map(rowToService));
  } catch (err) {
    next(err);
  }
});

// POST /api/stores/:storeId/services (owner/admin)
router.post('/', authenticate, async (req, res, next) => {
  try {
    await assertOwnerOrAdmin(req, req.params.storeId);
    const { name, description, price } = req.body;
    if (!name?.trim()) throw ApiError.badRequest('اسم الخدمة مطلوب');
    const { rows } = await pool.query(
      `INSERT INTO store_services (place_id, name, description, price)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.storeId, name.trim(), description || null, price || null]
    );
    return success(res, rowToService(rows[0]), 201);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/stores/:storeId/services/:id (owner/admin)
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    await assertOwnerOrAdmin(req, req.params.storeId);
    const { name, description, price, is_available, sort_order } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) {
      updates.push(`name = $${i++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${i++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updates.push(`price = $${i++}`);
      values.push(price);
    }
    if (is_available !== undefined) {
      updates.push(`is_available = $${i++}`);
      values.push(is_available);
    }
    if (sort_order !== undefined) {
      updates.push(`sort_order = $${i++}`);
      values.push(sort_order);
    }
    if (updates.length === 0) throw ApiError.badRequest('لا يوجد شيء للتحديث');
    updates.push('updated_at = now()');
    const idParam = values.length + 1;
    const placeParam = values.length + 2;
    values.push(req.params.id, req.params.storeId);
    const { rows } = await pool.query(
      `UPDATE store_services SET ${updates.join(', ')}
       WHERE id = $${idParam} AND place_id = $${placeParam} RETURNING *`,
      values
    );
    if (!rows[0]) throw ApiError.notFound('الخدمة غير موجودة');
    return success(res, rowToService(rows[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/stores/:storeId/services/:id (owner/admin)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await assertOwnerOrAdmin(req, req.params.storeId);
    const { rowCount } = await pool.query(
      'DELETE FROM store_services WHERE id = $1 AND place_id = $2',
      [req.params.id, req.params.storeId]
    );
    if (rowCount === 0) throw ApiError.notFound('الخدمة غير موجودة');
    return success(res, { message: 'تم حذف الخدمة' });
  } catch (err) {
    next(err);
  }
});

export default router;
