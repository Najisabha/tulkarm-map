/**
 * Legacy bridge: mounts old v1 routes (from index.js) alongside new v2 routes
 * on a single Express server. This allows gradual migration.
 *
 * Usage: node src/legacy-bridge.js
 */
import app from './app.js';
import { env } from './config/env.js';
import pool from './config/db.js';
import bcrypt from 'bcryptjs';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

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

// ============ Legacy v1 routes (keep original /api/* paths) ============

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      'SELECT id, name, email, password_hash, is_admin, role, created_at FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL',
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin || user.role === 'admin', createdAt: user.created_at },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password?.trim()) return res.status(400).json({ success: false, message: 'يرجى تعبئة جميع الحقول' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.length > 0) return res.status(400).json({ success: false, message: 'هذا البريد الإلكتروني مسجل مسبقاً' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'user') RETURNING id, name, email, role, created_at`,
      [name.trim(), email.trim().toLowerCase(), hash]
    );
    res.json({ success: true, user: { id: rows[0].id, name: rows[0].name, email: rows[0].email, isAdmin: false, createdAt: rows[0].created_at } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Categories
app.get('/api/categories', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categories ORDER BY sort_order, name');
    res.json(rows.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, color: r.color })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, emoji, color } = req.body;
    const { rows } = await pool.query('INSERT INTO categories (name, emoji, color) VALUES ($1, $2, $3) RETURNING *', [name, emoji || '📍', color || '#2E86AB']);
    logActivity('add', 'category', rows[0].id, { name });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, emoji, color } = req.body;
    const updates = []; const values = []; let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (emoji !== undefined) { updates.push(`emoji = $${i++}`); values.push(emoji); }
    if (color !== undefined) { updates.push(`color = $${i++}`); values.push(color); }
    if (updates.length === 0) return res.status(400).json({ error: 'لا يوجد شيء للتحديث' });
    values.push(id);
    const { rows } = await pool.query(`UPDATE categories SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json({ error: 'الفئة غير موجودة' });
    logActivity('update', 'category', id, req.body);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id, name', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'الفئة غير موجودة' });
    logActivity('delete', 'category', req.params.id, { name: rows[0].name });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stores
app.get('/api/stores', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.description, c.name as category, s.latitude, s.longitude, s.phone, s.photos, s.videos, s.created_at
       FROM stores s JOIN categories c ON s.category_id = c.id ORDER BY s.created_at DESC`
    );
    res.json(rows.map((r) => ({
      id: r.id, name: r.name, description: r.description, category: r.category,
      latitude: parseFloat(r.latitude), longitude: parseFloat(r.longitude),
      phone: r.phone, photos: r.photos || [], videos: r.videos || [], createdAt: r.created_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/stores', async (req, res) => {
  try {
    const { name, description, category, latitude, longitude, phone, photos, videos } = req.body;
    const { rows: cat } = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
    if (cat.length === 0) return res.status(400).json({ error: 'الفئة غير موجودة' });
    const { rows } = await pool.query(
      `INSERT INTO stores (name, description, category_id, latitude, longitude, phone, photos, videos) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, description, cat[0].id, latitude, longitude, phone || null, JSON.stringify(photos || []), JSON.stringify(videos || [])]
    );
    const r = rows[0]; logActivity('add', 'store', r.id, { name });
    res.json({ id: r.id, name: r.name, description: r.description, category, latitude: parseFloat(r.latitude), longitude: parseFloat(r.longitude), phone: r.phone, photos: r.photos || [], videos: r.videos || [], createdAt: r.created_at });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/stores/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM stores WHERE id = $1 RETURNING name', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'المتجر غير موجود' });
    logActivity('delete', 'store', req.params.id, { name: rows[0].name });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Place Requests
app.get('/api/place-requests', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.id, pr.name, pr.description, c.name as category, pr.latitude, pr.longitude, pr.phone, pr.photos, pr.videos, pr.status, pr.created_at
       FROM place_requests pr JOIN categories c ON pr.category_id = c.id ORDER BY pr.created_at DESC`
    );
    res.json(rows.map((r) => ({
      id: r.id, name: r.name, description: r.description, category: r.category,
      latitude: parseFloat(r.latitude), longitude: parseFloat(r.longitude),
      phone: r.phone, photos: r.photos || [], videos: r.videos || [], status: r.status, createdAt: r.created_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/place-requests', async (req, res) => {
  try {
    const { name, description, category, latitude, longitude, phone, photos, videos } = req.body;
    const { rows: cat } = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
    if (cat.length === 0) return res.status(400).json({ error: 'الفئة غير موجودة' });
    const { rows } = await pool.query(
      `INSERT INTO place_requests (name, description, category_id, latitude, longitude, phone, photos, videos, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,
      [name, description, cat[0].id, latitude, longitude, phone || null, JSON.stringify(photos || []), JSON.stringify(videos || [])]
    );
    const r = rows[0];
    res.json({ id: r.id, name: r.name, description: r.description, category, latitude: parseFloat(r.latitude), longitude: parseFloat(r.longitude), phone: r.phone, photos: r.photos || [], videos: r.videos || [], status: r.status, createdAt: r.created_at });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/place-requests/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const overrides = req.body || {};
    const { rows: reqRows } = await pool.query('SELECT * FROM place_requests WHERE id = $1 AND status = $2', [id, 'pending']);
    if (reqRows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود أو تمت معالجته' });
    const r = reqRows[0];
    const nm = overrides.name ?? r.name;
    const desc = overrides.description ?? r.description;
    await pool.query(
      `INSERT INTO stores (name, description, category_id, latitude, longitude, phone, photos, videos) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [nm, desc, r.category_id, overrides.latitude ?? parseFloat(r.latitude), overrides.longitude ?? parseFloat(r.longitude), overrides.phone ?? r.phone, JSON.stringify(overrides.photos ?? r.photos ?? []), JSON.stringify(overrides.videos ?? r.videos ?? [])]
    );
    await pool.query("UPDATE place_requests SET status = 'accepted' WHERE id = $1", [id]);
    logActivity('accept', 'place_request', id, { name: nm });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/place-requests/:id/reject', async (req, res) => {
  try {
    const { rows } = await pool.query("UPDATE place_requests SET status = 'rejected' WHERE id = $1 RETURNING name", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
    logActivity('reject', 'place_request', req.params.id, { name: rows[0].name });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/place-requests/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM place_requests WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Users (admin)
app.get('/api/users', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, is_admin, role, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC');
    res.json(rows.map((r) => ({ id: r.id, name: r.name, email: r.email, isAdmin: r.is_admin || r.role === 'admin', createdAt: r.created_at })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;
    if (typeof isAdmin !== 'boolean') return res.status(400).json({ error: 'isAdmin مطلوب' });
    const role = isAdmin ? 'admin' : 'user';
    const { rowCount } = await pool.query('UPDATE users SET is_admin = $1, role = $2 WHERE id = $3', [isAdmin, role, id]);
    if (rowCount === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (rows[0].email === 'admin@tulkarm.com') return res.status(400).json({ error: 'لا يمكن حذف حساب المدير الافتراضي' });
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reports, Activity log, Settings, Admin stats (keep as-is from v1)
app.get('/api/reports', async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT r.id, r.store_id, r.reason, r.details, r.status, r.created_at, s.name as store_name FROM reports r LEFT JOIN stores s ON r.store_id = s.id ORDER BY r.created_at DESC`);
    res.json(rows.map((r) => ({ id: r.id, storeId: r.store_id, storeName: r.store_name, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reports', async (req, res) => {
  try {
    const { storeId, reason, details } = req.body;
    if (!storeId || !reason) return res.status(400).json({ error: 'storeId و reason مطلوبان' });
    const { rows } = await pool.query('INSERT INTO reports (store_id, reason, details) VALUES ($1, $2, $3) RETURNING *', [storeId, reason, details || null]);
    const r = rows[0];
    res.json({ id: r.id, storeId: r.store_id, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/reports/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });
    await pool.query("UPDATE reports SET status = $1, resolved_at = CASE WHEN $1 != 'pending' THEN now() ELSE resolved_at END WHERE id = $2", [status, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/activity-log', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, action, entity_type, entity_id, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 100');
    res.json(rows.map((r) => ({ id: r.id, action: r.action, entityType: r.entity_type, entityId: r.entity_id, details: r.details || {}, createdAt: r.created_at })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/settings', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM app_settings');
    const settings = { maintenance_mode: false, welcome_message: 'مرحباً بكم في خريطة طولكرم' };
    rows.forEach((r) => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.json({ maintenance_mode: false, welcome_message: 'مرحباً بكم في خريطة طولكرم' }); }
});

app.patch('/api/settings', async (req, res) => {
  try {
    const { maintenance_mode, welcome_message } = req.body;
    if (typeof maintenance_mode === 'boolean') await pool.query("INSERT INTO app_settings (key, value, updated_at) VALUES ('maintenance_mode', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = now()", [JSON.stringify(maintenance_mode)]);
    if (typeof welcome_message === 'string') await pool.query("INSERT INTO app_settings (key, value, updated_at) VALUES ('welcome_message', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = now()", [JSON.stringify(welcome_message)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/stats', async (_req, res) => {
  try {
    let reports = 0;
    try { reports = parseInt((await pool.query("SELECT COUNT(*) FROM reports WHERE status = 'pending'")).rows[0].count); } catch { reports = 0; }
    const [users, stores, categories, placeReqs] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL').then(r => parseInt(r.rows[0].count)),
      pool.query('SELECT COUNT(*) FROM stores').then(r => parseInt(r.rows[0].count)),
      pool.query('SELECT COUNT(*) FROM categories').then(r => parseInt(r.rows[0].count)),
      pool.query("SELECT COUNT(*) FROM place_requests WHERE status = 'pending'").then(r => parseInt(r.rows[0].count)),
    ]);
    res.json({ users, stores, categories, pendingPlaceRequests: placeReqs, pendingReports: reports, storesThisMonth: 0, requestsThisWeek: 0 });
  } catch (err) { res.json({ users: 0, stores: 0, categories: 0, pendingPlaceRequests: 0, pendingReports: 0, storesThisMonth: 0, requestsThisWeek: 0 }); }
});

// GET legacy store (بدون منتجات/خدمات — مخطط v1 قديم)
app.get('/api/stores/:id/full', async (req, res) => {
  try {
    const { rows: storeRows } = await pool.query(
      `SELECT s.*, c.name as category, c.emoji, c.color
       FROM stores s JOIN categories c ON s.category_id = c.id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (!storeRows[0]) return res.status(404).json({ success: false, message: 'المتجر غير موجود' });
    const store = storeRows[0];

    res.json({
      success: true,
      data: {
        ...store,
        latitude: parseFloat(store.latitude),
        longitude: parseFloat(store.longitude),
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 404 and error handler must come after ALL routes
app.use(notFoundHandler);
app.use(errorHandler);

// Start
async function start() {
  try {
    const { rows } = await pool.query('SELECT NOW()');
    console.log('DB connected:', rows[0].now);
  } catch (err) {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
    console.log(`v1 API: /api/*`);
    console.log(`v2 API: /api/v2/*`);
    console.log(`Health: http://localhost:${env.PORT}/api/health`);
  });
}

start();
