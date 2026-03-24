import { Router } from 'express';
import pool from '../../config/db.js';
import bcrypt from 'bcryptjs';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { ApiError } from '../../utils/ApiError.js';
import { success } from '../../utils/response.js';

const router = Router();

async function logActivity(action, entityType, entityId, details = {}) {
  try {
    await pool.query(
      'INSERT INTO activity_log (action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4)',
      [action, entityType, entityId || null, JSON.stringify(details)]
    );
  } catch (e) {
    console.error('logActivity:', e.message);
  }
}

// ────── Users (admin) ──────

router.get('/users', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );
    return success(res, rows);
  } catch (err) { next(err); }
});

router.patch('/users/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name : undefined;
    const email = typeof body.email === 'string' ? body.email : undefined;
    const role = typeof body.role === 'string' ? body.role : undefined;

    const { rows: curRows } = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (!curRows[0]) throw ApiError.notFound('المستخدم غير موجود');
    const cur = curRows[0];
    const isDefaultAdmin = String(cur.email).toLowerCase() === 'admin@tulkarm.com';

    if (isDefaultAdmin) {
      if (email !== undefined && email.trim().toLowerCase() !== 'admin@tulkarm.com') {
        throw ApiError.badRequest('لا يمكن تغيير بريد المدير الافتراضي');
      }
      if (role !== undefined && role !== 'admin') {
        throw ApiError.badRequest('لا يمكن إنزال دور المدير الافتراضي');
      }
    }

    if (email !== undefined) {
      const em = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw ApiError.badRequest('البريد غير صالح');
      const { rows: dup } = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 AND deleted_at IS NULL',
        [em, id]
      );
      if (dup.length) throw ApiError.conflict('البريد مستخدم مسبقاً');
    }

    if (role !== undefined && !['admin', 'user', 'owner'].includes(role)) {
      throw ApiError.badRequest('الدور غير صالح');
    }

    const sets = [];
    const vals = [];

    if (name !== undefined) {
      const nm = name.trim();
      if (!nm) throw ApiError.badRequest('الاسم لا يمكن أن يكون فارغاً');
      sets.push(`name = $${vals.length + 1}`);
      vals.push(nm);
    }
    if (email !== undefined) {
      const em = email.trim().toLowerCase();
      sets.push(`email = $${vals.length + 1}`);
      vals.push(em);
    }
    if (role !== undefined) {
      sets.push(`role = $${vals.length + 1}`);
      vals.push(role);
    }

    if (sets.length === 0) throw ApiError.badRequest('لا يوجد شيء للتحديث');

    sets.push('updated_at = now()');
    vals.push(id);
    const whereParam = vals.length;

    const { rowCount } = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${whereParam} AND deleted_at IS NULL`,
      vals
    );
    if (rowCount === 0) throw ApiError.notFound('المستخدم غير موجود');

    logActivity('update', 'user', id, { name: name !== undefined, email: email !== undefined, role: role !== undefined });
    return success(res, { message: 'تم تحديث المستخدم' });
  } catch (err) { next(err); }
});

router.delete('/users/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.params.id]);
    if (rows.length === 0) throw ApiError.notFound('المستخدم غير موجود');
    if (rows[0].email === 'admin@tulkarm.com') throw ApiError.badRequest('لا يمكن حذف حساب المدير الافتراضي');
    await pool.query('UPDATE users SET deleted_at = now() WHERE id = $1', [req.params.id]);
    logActivity('delete', 'user', req.params.id);
    return success(res, { message: 'تم حذف المستخدم' });
  } catch (err) { next(err); }
});

// ────── Reports ──────

router.get('/reports', authenticate, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.store_id as place_id, r.reason, r.details, r.status, r.created_at,
              COALESCE(p.name, s.name) as place_name
       FROM reports r
       LEFT JOIN places p ON r.store_id::text = p.id::text
       LEFT JOIN stores s ON r.store_id::text = s.id::text
       ORDER BY r.created_at DESC`
    );
    return success(res, rows.map((r) => ({
      id: r.id,
      placeId: r.place_id,
      placeName: r.place_name,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
    })));
  } catch (err) { next(err); }
});

router.post('/reports', authenticate, async (req, res, next) => {
  try {
    const { placeId, reason, details } = req.body;
    if (!placeId || !reason) throw ApiError.badRequest('معرف المكان والسبب مطلوبان');
    const { rows } = await pool.query(
      'INSERT INTO reports (store_id, reason, details) VALUES ($1, $2, $3) RETURNING *',
      [placeId, reason, details || null]
    );
    const r = rows[0];
    return success(res, {
      id: r.id, placeId: r.store_id, reason: r.reason,
      details: r.details, status: r.status, createdAt: r.created_at,
    }, 201);
  } catch (err) { next(err); }
});

router.patch('/reports/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'resolved', 'dismissed'].includes(status)) throw ApiError.badRequest('حالة غير صالحة');
    await pool.query(
      "UPDATE reports SET status = $1, resolved_at = CASE WHEN $1 != 'pending' THEN now() ELSE resolved_at END WHERE id = $2",
      [status, req.params.id]
    );
    return success(res, { message: 'تم تحديث حالة البلاغ' });
  } catch (err) { next(err); }
});

// ────── Activity Log ──────

router.get('/activity-log', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, action, entity_type, entity_id, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 100'
    );
    return success(res, rows.map((r) => ({
      id: r.id, action: r.action, entityType: r.entity_type,
      entityId: r.entity_id, details: r.details || {}, createdAt: r.created_at,
    })));
  } catch (err) { next(err); }
});

// ────── Settings ──────

router.get('/settings', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM app_settings');
    const settings = { maintenance_mode: false, welcome_message: 'مرحباً بكم في خريطة طولكرم' };
    rows.forEach((r) => { settings[r.key] = r.value; });
    return success(res, settings);
  } catch (err) {
    return success(res, { maintenance_mode: false, welcome_message: 'مرحباً بكم في خريطة طولكرم' });
  }
});

router.patch('/settings', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { maintenance_mode, welcome_message } = req.body;
    if (typeof maintenance_mode === 'boolean') {
      await pool.query(
        "INSERT INTO app_settings (key, value, updated_at) VALUES ('maintenance_mode', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = now()",
        [JSON.stringify(maintenance_mode)]
      );
    }
    if (typeof welcome_message === 'string') {
      await pool.query(
        "INSERT INTO app_settings (key, value, updated_at) VALUES ('welcome_message', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = now()",
        [JSON.stringify(welcome_message)]
      );
    }
    return success(res, { message: 'تم تحديث الإعدادات' });
  } catch (err) { next(err); }
});

// ────── Admin Stats ──────

router.get('/admin/stats', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    let pendingReports = 0;
    try {
      pendingReports = parseInt((await pool.query("SELECT COUNT(*) FROM reports WHERE status = 'pending'")).rows[0].count);
    } catch { /* table might not exist */ }

    const [users, places, placeTypes, pendingPlaceRequests] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL').then(r => parseInt(r.rows[0].count)),
      pool
        .query("SELECT COUNT(*) FROM places WHERE deleted_at IS NULL AND status = 'active'")
        .then(r => parseInt(r.rows[0].count)),
      pool.query('SELECT COUNT(*) FROM place_types').then(r => parseInt(r.rows[0].count)),
      pool
        .query("SELECT COUNT(*) FROM places WHERE deleted_at IS NULL AND status = 'pending'")
        .then(r => parseInt(r.rows[0].count))
        .catch(() => 0),
    ]);

    let stores = 0;
    try {
      stores = parseInt((await pool.query('SELECT COUNT(*) FROM stores')).rows[0].count);
    } catch { /* table might not exist yet */ }

    return success(res, {
      users,
      stores,
      places,
      placeTypes,
      pendingReports,
      pendingPlaceRequests,
    });
  } catch (err) {
    return success(res, {
      users: 0,
      stores: 0,
      places: 0,
      placeTypes: 0,
      pendingReports: 0,
      pendingPlaceRequests: 0,
    });
  }
});

// ────── Store ownership ──────

router.get('/my-stores', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.description, c.name as category, s.latitude, s.longitude,
              s.phone, s.photos, s.videos, s.created_at
       FROM stores s JOIN categories c ON s.category_id = c.id
       WHERE s.owner_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    return success(res, rows.map((r) => ({
      ...r,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      photos: r.photos || [],
      videos: r.videos || [],
    })));
  } catch (err) { next(err); }
});

router.get('/stores/:id/full', async (req, res, next) => {
  try {
    const { rows: storeRows } = await pool.query(
      `SELECT s.*, c.name as category, c.emoji, c.color
       FROM stores s JOIN categories c ON s.category_id = c.id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (!storeRows[0]) throw ApiError.notFound('المتجر غير موجود');
    const store = storeRows[0];

    const { rows: services } = await pool.query(
      'SELECT * FROM store_services WHERE store_id = $1 AND is_available = true ORDER BY sort_order, name',
      [req.params.id]
    );
    const { rows: products } = await pool.query(
      'SELECT * FROM store_products WHERE store_id = $1 AND is_available = true ORDER BY sort_order, name',
      [req.params.id]
    );

    return success(res, {
      ...store,
      latitude: parseFloat(store.latitude),
      longitude: parseFloat(store.longitude),
      services,
      products,
    });
  } catch (err) { next(err); }
});

router.patch('/stores/:id/owner', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { owner_id } = req.body;
    if (owner_id) {
      const { rows: userRows } = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL',
        [owner_id]
      );
      if (!userRows[0]) throw ApiError.notFound('المستخدم غير موجود');
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['owner', owner_id]);
    }
    await pool.query('UPDATE stores SET owner_id = $1 WHERE id = $2', [owner_id || null, req.params.id]);
    logActivity('assign_owner', 'store', req.params.id, { owner_id });
    return success(res, { message: 'تم تعيين صاحب المتجر' });
  } catch (err) { next(err); }
});

export default router;
