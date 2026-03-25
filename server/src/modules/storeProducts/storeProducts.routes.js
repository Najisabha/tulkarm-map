import { Router } from 'express';
import pool from '../../config/db.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../utils/ApiError.js';
import { success } from '../../utils/response.js';

const router = Router({ mergeParams: true });

async function assertOwnerOrAdmin(req, storeId) {
  if (!req.user) throw ApiError.unauthorized('يجب تسجيل الدخول');
  if (req.user.role === 'admin') return;
  const { rows } = await pool.query('SELECT owner_id FROM stores WHERE id = $1', [storeId]);
  if (!rows[0]) throw ApiError.notFound('المتجر غير موجود');
  if (rows[0].owner_id !== req.user.id) throw ApiError.forbidden('ليس لديك صلاحية لإدارة هذا المتجر');
}

// GET /api/stores/:storeId/products
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM store_products WHERE store_id = $1 AND is_available = true ORDER BY sort_order, name',
      [req.params.storeId]
    );
    return success(res, rows);
  } catch (err) { next(err); }
});

// POST /api/stores/:storeId/products (owner/admin)
router.post('/', authenticate, async (req, res, next) => {
  try {
    await assertOwnerOrAdmin(req, req.params.storeId);
    const { name, description, price, image_url, stock, main_category, sub_category, company_name } = req.body;
    if (!name?.trim()) throw ApiError.badRequest('اسم المنتج مطلوب');
    if (price === undefined || price === null) throw ApiError.badRequest('السعر مطلوب');
    const { rows } = await pool.query(
      `INSERT INTO store_products (store_id, name, description, price, image_url, stock, main_category, sub_category, company_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.params.storeId,
        name.trim(),
        description || null,
        price,
        image_url || null,
        stock ?? -1,
        main_category || null,
        sub_category || null,
        company_name || null,
      ]
    );
    return success(res, rows[0], 201);
  } catch (err) { next(err); }
});

// PATCH /api/stores/:storeId/products/:id (owner/admin)
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    await assertOwnerOrAdmin(req, req.params.storeId);
    const { name, description, price, image_url, stock, is_available, sort_order, main_category, sub_category, company_name } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
    if (price !== undefined) { updates.push(`price = $${i++}`); values.push(price); }
    if (image_url !== undefined) { updates.push(`image_url = $${i++}`); values.push(image_url); }
    if (stock !== undefined) { updates.push(`stock = $${i++}`); values.push(stock); }
    if (is_available !== undefined) { updates.push(`is_available = $${i++}`); values.push(is_available); }
    if (sort_order !== undefined) { updates.push(`sort_order = $${i++}`); values.push(sort_order); }
    if (main_category !== undefined) { updates.push(`main_category = $${i++}`); values.push(main_category); }
    if (sub_category !== undefined) { updates.push(`sub_category = $${i++}`); values.push(sub_category); }
    if (company_name !== undefined) { updates.push(`company_name = $${i++}`); values.push(company_name); }
    if (updates.length === 0) throw ApiError.badRequest('لا يوجد شيء للتحديث');
    updates.push('updated_at = now()');
    values.push(req.params.id, req.params.storeId);
    const { rows } = await pool.query(
      `UPDATE store_products SET ${updates.join(', ')} WHERE id = $${i} AND store_id = $${i + 1} RETURNING *`,
      values
    );
    if (!rows[0]) throw ApiError.notFound('المنتج غير موجود');
    return success(res, rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/stores/:storeId/products/:id (owner/admin)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await assertOwnerOrAdmin(req, req.params.storeId);
    const { rowCount } = await pool.query(
      'DELETE FROM store_products WHERE id = $1 AND store_id = $2',
      [req.params.id, req.params.storeId]
    );
    if (rowCount === 0) throw ApiError.notFound('المنتج غير موجود');
    return success(res, { message: 'تم حذف المنتج' });
  } catch (err) { next(err); }
});

export default router;
