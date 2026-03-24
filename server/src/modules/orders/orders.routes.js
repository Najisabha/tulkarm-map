import { Router } from 'express';
import pool from '../../config/db.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../utils/ApiError.js';
import { success } from '../../utils/response.js';

const router = Router();

// POST /api/orders - create order (authenticated user, NOT guest)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { store_id, items, notes } = req.body;
    if (!store_id) throw ApiError.badRequest('معرف المتجر مطلوب');
    if (!items?.length) throw ApiError.badRequest('يجب إضافة منتج واحد على الأقل');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let total = 0;
      const resolvedItems = [];

      for (const item of items) {
        const { rows: prodRows } = await client.query(
          'SELECT id, name, price, stock, is_available FROM store_products WHERE id = $1 AND store_id = $2',
          [item.product_id, store_id]
        );
        const product = prodRows[0];
        if (!product) throw ApiError.badRequest(`المنتج ${item.product_id} غير موجود`);
        if (!product.is_available) throw ApiError.badRequest(`المنتج "${product.name}" غير متاح حالياً`);
        if (product.stock !== -1 && product.stock < (item.quantity || 1)) {
          throw ApiError.badRequest(`الكمية المطلوبة من "${product.name}" غير متوفرة`);
        }

        const qty = item.quantity || 1;
        const unitPrice = parseFloat(product.price);
        total += unitPrice * qty;

        resolvedItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: qty,
          unit_price: unitPrice,
        });

        if (product.stock !== -1) {
          await client.query(
            'UPDATE store_products SET stock = stock - $1, updated_at = now() WHERE id = $2',
            [qty, product.id]
          );
        }
      }

      const { rows: orderRows } = await client.query(
        `INSERT INTO orders (store_id, user_id, total, notes)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [store_id, req.user.id, total, notes || null]
      );
      const order = orderRows[0];

      for (const ri of resolvedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.id, ri.product_id, ri.product_name, ri.quantity, ri.unit_price]
        );
      }

      await client.query('COMMIT');
      return success(res, { ...order, items: resolvedItems }, 201);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// GET /api/orders/my - get my orders
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const { rows: orders } = await pool.query(
      `SELECT o.*, s.name as store_name
       FROM orders o JOIN stores s ON s.id = o.store_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC LIMIT 50`,
      [req.user.id]
    );

    for (const order of orders) {
      const { rows: items } = await pool.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.id]
      );
      order.items = items;
    }

    return success(res, orders);
  } catch (err) { next(err); }
});

// GET /api/orders/store/:storeId - get store orders (owner/admin)
router.get('/store/:storeId', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      const { rows } = await pool.query('SELECT owner_id FROM stores WHERE id = $1', [req.params.storeId]);
      if (!rows[0] || rows[0].owner_id !== req.user.id) {
        throw ApiError.forbidden('ليس لديك صلاحية');
      }
    }

    const { rows: orders } = await pool.query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.store_id = $1
       ORDER BY o.created_at DESC LIMIT 100`,
      [req.params.storeId]
    );

    for (const order of orders) {
      const { rows: items } = await pool.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.id]
      );
      order.items = items;
    }

    return success(res, orders);
  } catch (err) { next(err); }
});

// PATCH /api/orders/:id/status - update order status (owner/admin)
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      throw ApiError.badRequest('حالة غير صالحة');
    }

    const { rows: orderRows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!orderRows[0]) throw ApiError.notFound('الطلب غير موجود');
    const order = orderRows[0];

    if (req.user.role !== 'admin') {
      const { rows } = await pool.query('SELECT owner_id FROM stores WHERE id = $1', [order.store_id]);
      if (!rows[0] || rows[0].owner_id !== req.user.id) {
        throw ApiError.forbidden('ليس لديك صلاحية');
      }
    }

    await pool.query(
      'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2',
      [status, req.params.id]
    );

    return success(res, { message: 'تم تحديث حالة الطلب' });
  } catch (err) { next(err); }
});

export default router;
