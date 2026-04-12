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

    if (role !== undefined && !['admin', 'user'].includes(role)) {
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
      `SELECT r.id, r.place_id, r.reason, r.details, r.status, r.created_at,
              p.name as place_name
       FROM reports r
       LEFT JOIN places p ON p.id = r.place_id AND p.deleted_at IS NULL
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
      'INSERT INTO reports (place_id, reason, details) VALUES ($1, $2, $3) RETURNING *',
      [placeId, reason, details || null]
    );
    const r = rows[0];
    return success(res, {
      id: r.id, placeId: r.place_id, reason: r.reason,
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

    return success(res, {
      users,
      stores: places,
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

router.get('/stores/:id/full', async (req, res, next) => {
  try {
    const { rows: storeRows } = await pool.query(
      `SELECT p.*, pt.name AS category, pt.emoji, pt.color,
              pl.latitude, pl.longitude, sd.phone,
              COALESCE(
                (SELECT json_agg(m.url ORDER BY m.sort_order, m.created_at)
                 FROM media m WHERE m.place_id = p.id AND m.type = 'image'),
                '[]'::json
              ) AS photos,
              COALESCE(
                (SELECT json_agg(m.url ORDER BY m.sort_order, m.created_at)
                 FROM media m WHERE m.place_id = p.id AND m.type = 'video'),
                '[]'::json
              ) AS videos
       FROM places p
       LEFT JOIN place_types pt ON pt.id = p.type_id
       LEFT JOIN place_locations pl ON pl.place_id = p.id
       LEFT JOIN store_details sd ON sd.place_id = p.id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!storeRows[0]) throw ApiError.notFound('المكان غير موجود');
    const store = storeRows[0];

    return success(res, {
      ...store,
      latitude: store.latitude != null ? parseFloat(store.latitude) : null,
      longitude: store.longitude != null ? parseFloat(store.longitude) : null,
      photos: Array.isArray(store.photos) ? store.photos : [],
      videos: Array.isArray(store.videos) ? store.videos : [],
    });
  } catch (err) { next(err); }
});

export default router;
