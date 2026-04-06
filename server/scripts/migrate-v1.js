/**
 * مصدر واحد لمخطط قاعدة البيانات — شغّل: npm run migrate:v1 --prefix server
 */
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  const sql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin','user','owner')),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS place_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  emoji VARCHAR(64),
  color VARCHAR(32),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS place_type_attribute_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_type_id UUID NOT NULL REFERENCES place_types(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'string',
  is_required BOOLEAN DEFAULT false,
  options JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ptad_type_key_unique UNIQUE(place_type_id, key),
  CONSTRAINT ptad_value_type_check CHECK (value_type IN ('string','number','boolean','json','date'))
);

CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type_id UUID REFERENCES place_types(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('active','pending','rejected')),
  attributes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_places_status ON places(status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS place_locations (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_locations_coords ON place_locations(latitude, longitude);

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('image','video')),
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(place_id, user_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS place_tags (
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (place_id, tag_id)
);

CREATE TABLE IF NOT EXISTS store_details (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  phone VARCHAR(20),
  opening_hours TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  stock INTEGER NOT NULL DEFAULT -1,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  main_category VARCHAR(100),
  sub_category VARCHAR(100),
  company_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL,
  details TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','resolved','dismissed')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_main_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) UNIQUE NOT NULL,
  emoji VARCHAR(16),
  arrow_color VARCHAR(32),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_category_id UUID NOT NULL REFERENCES product_main_categories(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  emoji VARCHAR(16),
  arrow_color VARCHAR(32),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT product_sub_unique UNIQUE (main_category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_product_sub_main ON product_sub_categories(main_category_id, sort_order);
`;

  await pool.query(sql);

  // مخطط قديم (متاجر): store_id — المخطط الحالي place_id. CREATE TABLE IF NOT EXISTS لا يحدّث الأعمدة.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media' AND column_name = 'place_id')
      THEN ALTER TABLE media RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'place_id')
      THEN ALTER TABLE ratings RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'place_id')
      THEN ALTER TABLE orders RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_services' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_services' AND column_name = 'place_id')
      THEN ALTER TABLE store_services RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'place_id')
      THEN ALTER TABLE reports RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'place_id')
      THEN ALTER TABLE products RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'favorites' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'favorites' AND column_name = 'place_id')
      THEN ALTER TABLE favorites RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_details' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_details' AND column_name = 'place_id')
      THEN ALTER TABLE store_details RENAME COLUMN store_id TO place_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'place_tags' AND column_name = 'store_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'place_tags' AND column_name = 'place_id')
      THEN ALTER TABLE place_tags RENAME COLUMN store_id TO place_id;
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE place_types ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE places ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE ratings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE ratings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_places_owner ON places(owner_id) WHERE owner_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_media_place ON media(place_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_ratings_place ON ratings(place_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_products_place ON products(place_id) WHERE is_available = true;
    CREATE INDEX IF NOT EXISTS idx_store_services_place ON store_services(place_id) WHERE is_available = true;
    CREATE INDEX IF NOT EXISTS idx_orders_place ON orders(place_id, created_at DESC);
  `);

  await pool.query(`
INSERT INTO app_settings (key, value, updated_at) VALUES
  ('maintenance_mode', 'false'::jsonb, now()),
  ('welcome_message', '"مرحباً بكم في خريطة طولكرم"'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
`);

  const { rows: adminRows } = await pool.query(
    "SELECT id FROM users WHERE LOWER(email) = LOWER('admin@tulkarm.com') AND deleted_at IS NULL"
  );
  if (adminRows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_admin)
       VALUES ($1, $2, $3, 'admin', true)`,
      ['مدير التطبيق', 'admin@tulkarm.com', hash]
    );
    console.log('✅ Admin: admin@tulkarm.com / admin123');
  }

  await pool.query(`
INSERT INTO place_types (name, emoji, color, sort_order) VALUES
  ('منزل', '🏠', '#2E86AB', 1),
  ('متجر تجاري', '🏪', '#16A34A', 2),
  ('مجمّع تجاري', '🏬', '#F59E0B', 3),
  ('مجمّع سكني', '🏘️', '#2563EB', 4),
  ('مطعم', '🍽️', '#EF4444', 5),
  ('مسجد', '🕌', '#10B981', 6),
  ('كنيسة', '⛪', '#8B5CF6', 7),
  ('موقف سيارات', '🅿️', '#F59E0B', 8),
  ('مكتب', '🏢', '#0EA5E9', 9),
  ('مستشفى', '🏥', '#DC2626', 10),
  ('عيادة', '⚕️', '#F97316', 11),
  ('صالون', '💇', '#EC4899', 12),
  ('مؤسسة تعليمية', '🏫', '#3B82F6', 13),
  ('مؤسسة حكومية', '🏛️', '#6B7280', 14),
  ('أخرى', '📍', '#6B7280', 15)
ON CONFLICT (name) DO UPDATE SET
  emoji = EXCLUDED.emoji,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
`);

  console.log('✅ migrate-v1 completed');
}

async function main() {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      console.error('DATABASE_URL missing in server/.env');
      process.exit(1);
    }
    await initDb();
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
