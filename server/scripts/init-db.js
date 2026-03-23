/**
 * ينشئ الجداول والبيانات الافتراضية في PostgreSQL
 * شغّل: npm run init-db
 */
import pg from 'pg';
import 'dotenv/config';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const schema = `
-- جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- جدول الفئات
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  color VARCHAR(7) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- جدول المتاجر
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  phone VARCHAR(20),
  photos JSONB DEFAULT '[]',
  videos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- جدول طلبات الأماكن
CREATE TABLE IF NOT EXISTS place_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  phone VARCHAR(20),
  photos JSONB DEFAULT '[]',
  videos JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- فهرس للبحث حسب الموقع
CREATE INDEX IF NOT EXISTS idx_stores_location ON stores(latitude, longitude);
`;

const defaultCategories = [
  { name: 'تسوق', emoji: '🛍️', color: '#F59E0B' },
  { name: 'مطاعم', emoji: '🍽️', color: '#EF4444' },
  { name: 'صحة', emoji: '💊', color: '#10B981' },
  { name: 'خدمات', emoji: '🔧', color: '#8B5CF6' },
  { name: 'ترفيه', emoji: '🎭', color: '#EC4899' },
  { name: 'تعليم', emoji: '📚', color: '#3B82F6' },
];

async function init() {
  const client = await pool.connect();
  try {
    console.log('إنشاء الجداول...');
    await client.query(schema);

    // إدراج الفئات الافتراضية إذا كانت فارغة
    const { rows: catRows } = await client.query('SELECT COUNT(*) FROM categories');
    if (parseInt(catRows[0].count) === 0) {
      console.log('إضافة الفئات الافتراضية...');
      for (const c of defaultCategories) {
        await client.query(
          'INSERT INTO categories (name, emoji, color) VALUES ($1, $2, $3)',
          [c.name, c.emoji, c.color]
        );
      }
    }

    // إدراج المدير الافتراضي إذا لم يكن موجوداً
    const { rows: adminRows } = await client.query(
      "SELECT id FROM users WHERE email = 'admin@tulkarm.com'"
    );
    if (adminRows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await client.query(
        `INSERT INTO users (name, email, password_hash, is_admin)
         VALUES ('مدير التطبيق', 'admin@tulkarm.com', $1, true)`
      );
      console.log('تم إنشاء حساب المدير: admin@tulkarm.com / admin123');
    }

    console.log('✅ تم تهيئة قاعدة البيانات بنجاح');
  } catch (err) {
    console.error('❌ خطأ:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
