/**
 * ينشئ الجداول والبيانات الافتراضية في PostgreSQL
 * شغّل: npm run init-db
 */
import pg from 'pg';
import 'dotenv/config';
import bcrypt from 'bcryptjs';

const { escapeLiteral } = pg;

const connStr = process.env.DATABASE_URL;
if (!connStr || connStr.includes('YOUR_PASSWORD') || connStr.includes('localhost:5432/tulkarm-map')) {
  console.error('❌ يُرجى تعديل server/.env وإضافة رابط اتصال Neon:');
  console.error('   1. افتح Neon Console → اضغط Connect');
  console.error('   2. انسخ Connection string');
  console.error('   3. ضعه في server/.env كقيمة لـ DATABASE_URL');
  console.error('   مثال: DATABASE_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: connStr });

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

-- جدول الإبلاغات
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason VARCHAR(50) NOT NULL,
  details TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- جدول سجل النشاط
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  details JSONB DEFAULT '{}',
  actor_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- جدول إعدادات التطبيق
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  ('welcome_message', '"مرحباً بكم في خريطة طولكرم"')
ON CONFLICT (key) DO NOTHING;
`;

async function init() {
  const client = await pool.connect();
  try {
    console.log('إنشاء الجداول...');
    await client.query(schema);
    console.log('(الفئات تُضاف يدوياً من لوحة الإدارة)');

    // إدراج المدير الافتراضي إذا لم يكن موجوداً
    const { rows: adminRows } = await client.query(
      "SELECT id FROM users WHERE email = 'admin@tulkarm.com'"
    );
    if (adminRows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await client.query(
        `INSERT INTO users (name, email, password_hash, is_admin)
         VALUES ('مدير التطبيق', 'admin@tulkarm.com', ${escapeLiteral(hash)}, true)`
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
