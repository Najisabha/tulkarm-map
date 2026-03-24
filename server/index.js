import express from 'express';
import cors from 'cors';
import pool from './db.js';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

// ============ المستخدمون ============

// تسجيل الدخول
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      'SELECT id, name, email, password_hash, is_admin, created_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.is_admin,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// إنشاء حساب
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ success: false, message: 'يرجى تعبئة جميع الحقول' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'هذا البريد الإلكتروني مسجل مسبقاً' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, is_admin)
       VALUES ($1, $2, $3, false)
       RETURNING id, name, email, is_admin, created_at`,
      [name.trim(), email.trim().toLowerCase(), hash]
    );
    res.json({
      success: true,
      user: {
        id: rows[0].id,
        name: rows[0].name,
        email: rows[0].email,
        isAdmin: false,
        createdAt: rows[0].created_at,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ الفئات ============

app.get('/api/categories', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categories ORDER BY sort_order, name');
    res.json(rows.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, color: r.color })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, emoji, color } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO categories (name, emoji, color) VALUES ($1, $2, $3) RETURNING *',
      [name, emoji || '📍', color || '#2E86AB']
    );
    logActivity('add', 'category', rows[0].id, { name });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, emoji, color } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (emoji !== undefined) { updates.push(`emoji = $${i++}`); values.push(emoji); }
    if (color !== undefined) { updates.push(`color = $${i++}`); values.push(color); }
    if (updates.length === 0) return res.status(400).json({ error: 'لا يوجد شيء للتحديث' });
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'الفئة غير موجودة' });
    logActivity('update', 'category', id, req.body);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id, name', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'الفئة غير موجودة' });
    logActivity('delete', 'category', req.params.id, { name: rows[0].name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تحديث اسم الفئة في المتاجر وطلبات الأماكن
app.post('/api/categories/rename', async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    await pool.query(
      `UPDATE stores s SET category_id = c2.id FROM categories c1, categories c2
       WHERE s.category_id = c1.id AND c1.name = $1 AND c2.name = $2`,
      [oldName, newName]
    );
    await pool.query(
      `UPDATE place_requests pr SET category_id = c2.id FROM categories c1, categories c2
       WHERE pr.category_id = c1.id AND c1.name = $1 AND c2.name = $2`,
      [oldName, newName]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ المتاجر ============

app.get('/api/stores', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.description, c.name as category, s.latitude, s.longitude, s.phone, s.photos, s.videos, s.created_at
       FROM stores s JOIN categories c ON s.category_id = c.id ORDER BY s.created_at DESC`
    );
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      phone: r.phone,
      photos: r.photos || [],
      videos: r.videos || [],
      createdAt: r.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stores', async (req, res) => {
  try {
    const { name, description, category, latitude, longitude, phone, photos, videos } = req.body;
    const { rows: cat } = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
    if (cat.length === 0) return res.status(400).json({ error: 'الفئة غير موجودة' });
    const { rows } = await pool.query(
      `INSERT INTO stores (name, description, category_id, latitude, longitude, phone, photos, videos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, description, latitude, longitude, phone, photos, videos, created_at`,
      [name, description, cat[0].id, latitude, longitude, phone || null, JSON.stringify(photos || []), JSON.stringify(videos || [])]
    );
    const r = rows[0];
    logActivity('add', 'store', r.id, { name: r.name });
    res.json({
      id: r.id,
      name: r.name,
      description: r.description,
      category,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      phone: r.phone,
      photos: r.photos || [],
      videos: r.videos || [],
      createdAt: r.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/stores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, latitude, longitude, phone, photos, videos } = req.body;
    let categoryId;
    if (category) {
      const { rows } = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
      if (rows.length === 0) return res.status(400).json({ error: 'الفئة غير موجودة' });
      categoryId = rows[0].id;
    }
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
    if (categoryId) { updates.push(`category_id = $${i++}`); values.push(categoryId); }
    if (latitude !== undefined) { updates.push(`latitude = $${i++}`); values.push(latitude); }
    if (longitude !== undefined) { updates.push(`longitude = $${i++}`); values.push(longitude); }
    if (phone !== undefined) { updates.push(`phone = $${i++}`); values.push(phone); }
    if (photos !== undefined) { updates.push(`photos = $${i++}`); values.push(JSON.stringify(photos)); }
    if (videos !== undefined) { updates.push(`videos = $${i++}`); values.push(JSON.stringify(videos)); }
    if (updates.length === 0) return res.status(400).json({ error: 'لا يوجد شيء للتحديث' });
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE stores SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'المتجر غير موجود' });
    const r = rows[0];
    const { rows: cr } = await pool.query('SELECT name FROM categories WHERE id = $1', [r.category_id]);
    logActivity('update', 'store', id, { name: r.name });
    res.json({
      id: r.id,
      name: r.name,
      description: r.description,
      category: cr[0]?.name,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      phone: r.phone,
      photos: r.photos || [],
      videos: r.videos || [],
      createdAt: r.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/stores/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM stores WHERE id = $1 RETURNING name', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'المتجر غير موجود' });
    logActivity('delete', 'store', req.params.id, { name: rows[0].name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تحديث فئة المتاجر بالاسم
app.post('/api/stores/update-category', async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    await pool.query(
      `UPDATE stores s SET category_id = c2.id FROM categories c1, categories c2
       WHERE s.category_id = c1.id AND c1.name = $1 AND c2.name = $2`,
      [oldName, newName]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ طلبات الأماكن ============

app.get('/api/place-requests', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.id, pr.name, pr.description, c.name as category, pr.latitude, pr.longitude, pr.phone, pr.photos, pr.videos, pr.status, pr.created_at
       FROM place_requests pr JOIN categories c ON pr.category_id = c.id ORDER BY pr.created_at DESC`
    );
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      phone: r.phone,
      photos: r.photos || [],
      videos: r.videos || [],
      status: r.status,
      createdAt: r.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/place-requests', async (req, res) => {
  try {
    const { name, description, category, latitude, longitude, phone, photos, videos } = req.body;
    const { rows: cat } = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
    if (cat.length === 0) return res.status(400).json({ error: 'الفئة غير موجودة' });
    const { rows } = await pool.query(
      `INSERT INTO place_requests (name, description, category_id, latitude, longitude, phone, photos, videos, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING id, name, description, latitude, longitude, phone, photos, videos, status, created_at`,
      [name, description, cat[0].id, latitude, longitude, phone || null, JSON.stringify(photos || []), JSON.stringify(videos || [])]
    );
    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      description: r.description,
      category,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      phone: r.phone,
      photos: r.photos || [],
      videos: r.videos || [],
      status: r.status,
      createdAt: r.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/place-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, latitude, longitude, phone, photos, videos, status } = req.body;
    let categoryId;
    if (category) {
      const { rows } = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
      if (rows.length === 0) return res.status(400).json({ error: 'الفئة غير موجودة' });
      categoryId = rows[0].id;
    }
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
    if (categoryId) { updates.push(`category_id = $${i++}`); values.push(categoryId); }
    if (latitude !== undefined) { updates.push(`latitude = $${i++}`); values.push(latitude); }
    if (longitude !== undefined) { updates.push(`longitude = $${i++}`); values.push(longitude); }
    if (phone !== undefined) { updates.push(`phone = $${i++}`); values.push(phone); }
    if (photos !== undefined) { updates.push(`photos = $${i++}`); values.push(JSON.stringify(photos)); }
    if (videos !== undefined) { updates.push(`videos = $${i++}`); values.push(JSON.stringify(videos)); }
    if (status) { updates.push(`status = $${i++}`); values.push(status); }
    if (updates.length === 0) return res.status(400).json({ error: 'لا يوجد شيء للتحديث' });
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE place_requests SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
    const r = rows[0];
    const { rows: cr } = await pool.query('SELECT name FROM categories WHERE id = $1', [r.category_id]);
    res.json({
      id: r.id,
      name: r.name,
      description: r.description,
      category: cr[0]?.name,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      phone: r.phone,
      photos: r.photos || [],
      videos: r.videos || [],
      status: r.status,
      createdAt: r.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/place-requests/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM place_requests WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// قبول طلب → إنشاء متجر
app.post('/api/place-requests/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const overrides = req.body || {};
    const { rows: reqRows } = await pool.query(
      'SELECT * FROM place_requests WHERE id = $1 AND status = $2',
      [id, 'pending']
    );
    if (reqRows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود أو تمت معالجته' });
    const r = reqRows[0];
    const name = overrides.name ?? r.name;
    const description = overrides.description ?? r.description;
    const categoryId = r.category_id;
    const latitude = overrides.latitude ?? parseFloat(r.latitude);
    const longitude = overrides.longitude ?? parseFloat(r.longitude);
    const phone = overrides.phone ?? r.phone;
    const photos = overrides.photos ?? r.photos ?? [];
    const videos = overrides.videos ?? r.videos ?? [];

    await pool.query(
      `INSERT INTO stores (name, description, category_id, latitude, longitude, phone, photos, videos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [name, description, categoryId, latitude, longitude, phone, JSON.stringify(photos), JSON.stringify(videos)]
    );
    await pool.query('UPDATE place_requests SET status = $1 WHERE id = $2', ['accepted', id]);
    logActivity('accept', 'place_request', id, { name });

    const { rows: cr } = await pool.query('SELECT name FROM categories WHERE id = $1', [categoryId]);
    res.json({
      success: true,
      store: {
        name,
        description,
        category: cr[0]?.name,
        latitude,
        longitude,
        phone,
        photos,
        videos,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/place-requests/:id/reject', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE place_requests SET status = 'rejected' WHERE id = $1 RETURNING name",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
    logActivity('reject', 'place_request', req.params.id, { name: rows[0].name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تحديث فئة الطلبات بالاسم
app.post('/api/place-requests/update-category', async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    await pool.query(
      `UPDATE place_requests pr SET category_id = c2.id FROM categories c1, categories c2
       WHERE pr.category_id = c1.id AND c1.name = $1 AND c2.name = $2`,
      [oldName, newName]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ المستخدمون (للإدارة) ============

app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      isAdmin: r.is_admin,
      createdAt: r.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;
    if (typeof isAdmin !== 'boolean') {
      return res.status(400).json({ error: 'isAdmin مطلوب' });
    }
    const { rowCount } = await pool.query(
      'UPDATE users SET is_admin = $1 WHERE id = $2',
      [isAdmin, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (rows[0].email === 'admin@tulkarm.com') {
      return res.status(400).json({ error: 'لا يمكن حذف حساب المدير الافتراضي' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ الإبلاغات ============

app.get('/api/reports', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.store_id, r.reason, r.details, r.status, r.created_at, s.name as store_name
       FROM reports r
       LEFT JOIN stores s ON r.store_id = s.id
       ORDER BY r.created_at DESC`
    );
    res.json(rows.map((r) => ({
      id: r.id,
      storeId: r.store_id,
      storeName: r.store_name,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const { storeId, reason, details } = req.body;
    if (!storeId || !reason) return res.status(400).json({ error: 'storeId و reason مطلوبان' });
    const { rows } = await pool.query(
      'INSERT INTO reports (store_id, reason, details) VALUES ($1, $2, $3) RETURNING id, store_id, reason, details, status, created_at',
      [storeId, reason, details || null]
    );
    const r = rows[0];
    res.json({ id: r.id, storeId: r.store_id, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'حالة غير صالحة' });
    }
    await pool.query(
      'UPDATE reports SET status = $1, resolved_at = CASE WHEN $1 != $2 THEN now() ELSE resolved_at END WHERE id = $3',
      [status, 'pending', id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ سجل النشاط ============

app.get('/api/activity-log', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, action, entity_type, entity_id, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 100'
    );
    res.json(rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details || {},
      createdAt: r.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ إعدادات التطبيق ============

app.get('/api/settings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM app_settings');
    const settings = { maintenance_mode: false, welcome_message: 'مرحباً بكم في خريطة طولكرم' };
    rows.forEach((r) => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.json({ maintenance_mode: false, welcome_message: 'مرحباً بكم في خريطة طولكرم' });
  }
});

app.patch('/api/settings', async (req, res) => {
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
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ إحصائيات الإدارة ============

app.get('/api/admin/stats', async (req, res) => {
  try {
    let reports = 0;
    try {
      const r = await pool.query("SELECT COUNT(*) FROM reports WHERE status = 'pending'");
      reports = parseInt(r.rows[0].count);
    } catch {
      reports = 0;
    }
    const [users, stores, categories, placeReqs, storesThisMonth, requestsThisWeek] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users').then((r) => parseInt(r.rows[0].count)),
      pool.query('SELECT COUNT(*) FROM stores').then((r) => parseInt(r.rows[0].count)),
      pool.query('SELECT COUNT(*) FROM categories').then((r) => parseInt(r.rows[0].count)),
      pool.query("SELECT COUNT(*) FROM place_requests WHERE status = 'pending'").then((r) => parseInt(r.rows[0].count)),
      pool.query("SELECT COUNT(*) FROM stores WHERE created_at >= date_trunc('month', CURRENT_DATE)").then((r) => parseInt(r.rows[0].count)),
      pool.query("SELECT COUNT(*) FROM place_requests WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'").then((r) => parseInt(r.rows[0].count)),
    ]);
    res.json({
      users,
      stores,
      categories,
      pendingPlaceRequests: placeReqs,
      pendingReports: reports,
      storesThisMonth,
      requestsThisWeek,
    });
  } catch (err) {
    res.json({
      users: 0,
      stores: 0,
      categories: 0,
      pendingPlaceRequests: 0,
      pendingReports: 0,
      storesThisMonth: 0,
      requestsThisWeek: 0,
    });
  }
});

// ============ تصدير / استيراد ============

app.get('/api/admin/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const { rows: stores } = await pool.query(
      `SELECT s.id, s.name, s.description, c.name as category, s.latitude, s.longitude, s.phone, s.photos, s.videos, s.created_at
       FROM stores s JOIN categories c ON s.category_id = c.id ORDER BY s.created_at DESC`
    );
    const data = stores.map((r) => ({
      name: r.name,
      description: r.description,
      category: r.category,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      phone: r.phone,
      photos: r.photos || [],
      videos: r.videos || [],
    }));
    if (format === 'csv') {
      const header = 'الاسم,الوصف,الفئة,خط العرض,خط الطول,الهاتف\n';
      const rows = data.map((d) =>
        `"${(d.name || '').replace(/"/g, '""')}","${(d.description || '').replace(/"/g, '""')}","${d.category}",${d.latitude},${d.longitude},"${d.phone || ''}"`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=stores.csv');
      return res.send('\ufeff' + header + rows);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/import', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body.items || [];
    let created = 0;
    for (const item of items) {
      if (!item.name || !item.category) continue;
      const { rows: cat } = await pool.query('SELECT id FROM categories WHERE name = $1', [item.category]);
      if (cat.length === 0) continue;
      await pool.query(
        `INSERT INTO stores (name, description, category_id, latitude, longitude, phone, photos, videos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          item.name,
          item.description || '',
          cat[0].id,
          item.latitude ?? 32.31,
          item.longitude ?? 35.03,
          item.phone || null,
          JSON.stringify(item.photos || []),
          JSON.stringify(item.videos || []),
        ]
      );
      created++;
    }
    res.json({ success: true, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// اختبار
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Tulkarm Map API' });
});

app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
  console.log(`   اختبر: http://localhost:${PORT}/api/health`);
});
