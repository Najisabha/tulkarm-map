/**
 * ترحيل إضافي: جداول الإبلاغ، سجل النشاط، إعدادات التطبيق
 * شغّل: node scripts/migrate-v2.js
 */
import pg from 'pg';
import 'dotenv/config';

const connStr = process.env.DATABASE_URL;
if (!connStr || connStr.includes('YOUR_PASSWORD')) {
  console.error('❌ DATABASE_URL غير صالح في server/.env');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: connStr });

const schema = `
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

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('تشغيل الترحيل...');
    await client.query(schema);
    console.log('✅ تم الترحيل بنجاح');
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
