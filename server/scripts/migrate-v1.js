/**
 * Unified DB bootstrap + migrations (v1).
 *
 * هدف السكربت:
 * 1) إنشاء الجداول الأساسية (init-db)
 * 2) تشغيل ترحيلات v2..v8 بالترتيب
 * 3) تنفيذ seed الخاص بـ place_types
 * 4) (اختياري) حذف جداول غير مستخدمة حالياً
 *
 * التشغيل:
 *   npm run migrate:v1 --prefix server
 *
 * اختيارياً:
 *   npm run migrate:v1 --prefix server -- --drop-unused-tables
 * أو:
 *   DROP_UNUSED_TABLES=true
 */
import pg from 'pg';
import 'dotenv/config';
import bcrypt from 'bcryptjs';

const connStr = process.env.DATABASE_URL;
if (
  !connStr ||
  connStr.includes('YOUR_PASSWORD')
) {
  console.error('DATABASE_URL غير صالح في server/.env');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: connStr });

const shouldDropUnusedTables =
  process.argv.includes('--drop-unused-tables') || process.env.DROP_UNUSED_TABLES === 'true';

async function initDb() {
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

  await pool.query(schema);

  // إدراج المدير الافتراضي إذا لم يكن موجوداً
  const { rows: adminRows } = await pool.query("SELECT id FROM users WHERE email = 'admin@tulkarm.com'");
  if (adminRows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `
      INSERT INTO users (name, email, password_hash, is_admin)
      VALUES ($1, $2, $3, true)
      `,
      ['مدير التطبيق', 'admin@tulkarm.com', hash]
    );
    console.log('تم إنشاء حساب المدير: admin@tulkarm.com / admin123');
  }

  console.log('✅ init-db done');
}

async function migrateV2() {
  const migration = `
-- ترحيل إضافي: جداول الإبلاغ، سجل النشاط، إعدادات التطبيق
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

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  details JSONB DEFAULT '{}',
  actor_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now()
);

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

  await pool.query(migration);
  console.log('V2 migration completed successfully');
}

async function migrateV3() {
  const migration = `
-- ==========================================
-- Extensions
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- A) users: add role, updated_at, deleted_at
-- ==========================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';
    UPDATE users SET role = 'admin' WHERE is_admin = true;
    UPDATE users SET role = 'user' WHERE is_admin = false OR is_admin IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'user';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','user'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ==========================================
-- B) place_types
-- ==========================================
CREATE TABLE IF NOT EXISTS place_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_types_name ON place_types(name);

-- Seed default place types from existing categories
INSERT INTO place_types (name)
SELECT DISTINCT c.name FROM categories c
WHERE NOT EXISTS (SELECT 1 FROM place_types pt WHERE pt.name = c.name)
ON CONFLICT (name) DO NOTHING;

-- ==========================================
-- C) places
-- ==========================================
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type_id UUID REFERENCES place_types(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT places_status_check CHECK (status IN ('active','pending','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_places_type_created
  ON places(type_id, created_at) WHERE deleted_at IS NULL;

-- ==========================================
-- D) place_locations
-- ==========================================
CREATE TABLE IF NOT EXISTS place_locations (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_locations_coords
  ON place_locations(latitude, longitude);

-- ==========================================
-- E) place_attributes (EAV for dynamic fields)
-- ==========================================
CREATE TABLE IF NOT EXISTS place_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'string',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT place_attributes_value_type_check
    CHECK (value_type IN ('string','number','boolean','json','date')),
  CONSTRAINT place_attributes_place_key_unique UNIQUE(place_id, key)
);

CREATE INDEX IF NOT EXISTS idx_place_attributes_place_key
  ON place_attributes(place_id, key);

-- ==========================================
-- F) place_images
-- ==========================================
CREATE TABLE IF NOT EXISTS place_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- G) ratings
-- ==========================================
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ratings_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT ratings_place_user_unique UNIQUE(place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_place_created
  ON ratings(place_id, created_at) WHERE deleted_at IS NULL;

-- ==========================================
-- H) refresh_tokens
-- ==========================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

-- ==========================================
-- I) place_type_attribute_definitions (advanced)
-- ==========================================
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
  CONSTRAINT ptad_value_type_check
    CHECK (value_type IN ('string','number','boolean','json','date')),
  CONSTRAINT ptad_type_key_unique UNIQUE(place_type_id, key)
);

-- ==========================================
-- Migrate existing stores into the new places schema
-- ==========================================
DO $$
DECLARE
  store_row RECORD;
  new_place_id UUID;
  pt_id UUID;
  cat_name TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM places LIMIT 1) THEN
    FOR store_row IN
      SELECT s.*, c.name as category_name FROM stores s
      JOIN categories c ON s.category_id = c.id
    LOOP
      cat_name := store_row.category_name;

      SELECT id INTO pt_id FROM place_types WHERE name = cat_name;
      IF pt_id IS NULL THEN
        INSERT INTO place_types (name) VALUES (cat_name) RETURNING id INTO pt_id;
      END IF;

      INSERT INTO places (name, description, type_id, status, created_at)
      VALUES (store_row.name, store_row.description, pt_id, 'active', store_row.created_at)
      RETURNING id INTO new_place_id;

      INSERT INTO place_locations (place_id, latitude, longitude)
      VALUES (new_place_id, store_row.latitude, store_row.longitude);

      IF store_row.phone IS NOT NULL AND store_row.phone != '' THEN
        INSERT INTO place_attributes (place_id, key, value, value_type)
        VALUES (new_place_id, 'phone', store_row.phone, 'string');
      END IF;
    END LOOP;

    RAISE NOTICE 'Migrated existing stores into places table';
  END IF;
END $$;
`;

  await pool.query(migration);
  console.log('V3 migration completed successfully');
}

async function migrateV4() {
  const migration = `
-- Add 'owner' to the role CHECK constraint
DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','user','owner'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Store services (managed by owner/admin)
CREATE TABLE IF NOT EXISTS store_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'ILS',
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_services_store ON store_services(store_id) WHERE is_available = true;

-- Store products (managed by owner/admin)
CREATE TABLE IF NOT EXISTS store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'ILS',
  image_url TEXT,
  stock INTEGER DEFAULT -1,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_products_store ON store_products(store_id) WHERE is_available = true;

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'ILS',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES store_products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Store ownership: link stores to owner users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE stores ADD COLUMN owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id) WHERE owner_id IS NOT NULL;
`;

  await pool.query(migration);
  console.log('V4 migration completed successfully');
}

async function migrateV5() {
  const migration = `
ALTER TABLE place_types ADD COLUMN IF NOT EXISTS emoji VARCHAR(32);
ALTER TABLE place_types ADD COLUMN IF NOT EXISTS color VARCHAR(32);

-- نقل من جدول categories القديم إن وُجد وتطابق الاسم
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'categories'
  ) THEN
    UPDATE place_types pt
    SET
      emoji = COALESCE(NULLIF(TRIM(pt.emoji), ''), c.emoji),
      color = COALESCE(NULLIF(TRIM(pt.color), ''), c.color)
    FROM categories c
    WHERE LOWER(TRIM(pt.name)) = LOWER(TRIM(c.name))
      AND (
        (pt.emoji IS NULL OR TRIM(pt.emoji) = '')
        OR (pt.color IS NULL OR TRIM(pt.color) = '')
      );
  END IF;
END $$;
`;

  await pool.query(migration);
  console.log('V5 migration completed successfully');
}

async function migrateV6() {
  const migration = `
-- ==========================================
-- V6: extension tables (optional)
-- ==========================================

-- NOTE: We don't drop legacy tables because the app still uses them.

CREATE TABLE IF NOT EXISTS house_details (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,

  -- المطلوبة:
  name VARCHAR(255),
  house_number VARCHAR(50),
  location_text VARCHAR(255),
  description TEXT,
  image_url TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_details (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,

  -- المطلوبة:
  name VARCHAR(255),
  store_type VARCHAR(100),
  store_category VARCHAR(100),
  store_number VARCHAR(50),
  location_text VARCHAR(255),
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS residential_complex_details (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,

  -- المطلوبة:
  name VARCHAR(255),
  complex_number VARCHAR(50),
  location_text VARCHAR(255),
  description TEXT,
  floors_count INTEGER,
  houses_per_floor JSONB, -- example: [10, 8, 12] or {"1":10,"2":8}

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commercial_complex_details (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,

  -- المطلوبة:
  name VARCHAR(255),
  complex_number VARCHAR(50),
  location_text VARCHAR(255),
  description TEXT,
  floors_count INTEGER,
  stores_per_floor JSONB, -- example: [6, 4, 10] or {"1":6,"2":4}

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS other_place_details (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,

  -- غير محددة بالكامل عندك، بنخليها عامة:
  name VARCHAR(255),
  location_text VARCHAR(255),
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
`;

  await pool.query(migration);
  console.log('V6 migration completed successfully');
}

async function seedPlaceTypesConstants() {
  const migration = `
ALTER TABLE place_types ADD COLUMN IF NOT EXISTS emoji VARCHAR(32);
ALTER TABLE place_types ADD COLUMN IF NOT EXISTS color VARCHAR(32);

INSERT INTO place_types (name, emoji, color)
VALUES
  ('منزل', '🏠', '#2E86AB'),
  ('متجر تجاري', '🏪', '#16A34A'),
  ('مجمّع سكني', '🏘️', '#2563EB'),
  ('مجمّع تجاري', '🏬', '#F59E0B'),
  ('أخرى', '📍', '#6B7280')
ON CONFLICT (name) DO UPDATE
SET
  emoji = EXCLUDED.emoji,
  color = EXCLUDED.color,
  updated_at = now();
`;

  await pool.query(migration);
  console.log('seed-place-types-constants done');
}

async function migrateV7() {
  const CANONICAL_TYPES = ['منزل', 'متجر تجاري', 'مجمّع سكني', 'مجمّع تجاري', 'أخرى'];
  const STORE_TYPES = ['متجر تجاري', 'مجمّع تجاري'];

  function parseJsonMaybe(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  function toIntMaybe(value) {
    if (value == null) return null;
    const n = parseInt(String(value), 10);
    return Number.isFinite(n) ? n : null;
  }

  async function seedCategories() {
    const migration = `
    INSERT INTO categories (name, emoji, color, sort_order)
    VALUES
      ('منزل', '🏠', '#2E86AB', 0),
      ('متجر تجاري', '🏪', '#16A34A', 1),
      ('مجمّع سكني', '🏘️', '#2563EB', 2),
      ('مجمّع تجاري', '🏬', '#F59E0B', 3),
      ('أخرى', '📍', '#6B7280', 4)
    ON CONFLICT (name) DO UPDATE
      SET emoji = EXCLUDED.emoji,
          color = EXCLUDED.color,
          sort_order = EXCLUDED.sort_order;
  `;
    await pool.query(migration);
  }

  async function upsertTypedDetails(place) {
    const { type_name: typeName, id: placeId, name, description, status } = place;

    const { rows: attrRows } = await pool.query('SELECT key, value FROM place_attributes WHERE place_id = $1', [
      placeId,
    ]);
    const attrs = {};
    for (const a of attrRows) attrs[a.key] = a.value;

    const { rows: images } = await pool.query(
      'SELECT image_url FROM place_images WHERE place_id = $1 ORDER BY sort_order ASC',
      [placeId]
    );
    const imageUrl = images?.[0]?.image_url ?? null;

    const locationText = attrs.location_text ?? null;

    if (typeName === 'منزل') {
      await pool.query(
        `
        INSERT INTO house_details (place_id, name, house_number, location_text, description, image_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (place_id) DO UPDATE SET
          name = EXCLUDED.name,
          house_number = EXCLUDED.house_number,
          location_text = EXCLUDED.location_text,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url
      `,
        [placeId, name, attrs.house_number ?? null, locationText, description ?? null, imageUrl]
      );
      return;
    }

    if (typeName === 'متجر تجاري') {
      await pool.query(
        `
        INSERT INTO store_details (place_id, name, store_type, store_category, store_number, location_text, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (place_id) DO UPDATE SET
          name = EXCLUDED.name,
          store_type = EXCLUDED.store_type,
          store_category = EXCLUDED.store_category,
          store_number = EXCLUDED.store_number,
          location_text = EXCLUDED.location_text,
          description = EXCLUDED.description
      `,
        [
          placeId,
          name,
          attrs.store_type ?? null,
          attrs.store_category ?? null,
          attrs.store_number ?? null,
          locationText,
          description ?? null,
        ]
      );
      return;
    }

    if (typeName === 'مجمّع سكني') {
      const housesPerFloor = parseJsonMaybe(attrs.houses_per_floor);
      const housesPerFloorParam = housesPerFloor != null ? JSON.stringify(housesPerFloor) : null;
      await pool.query(
        `
        INSERT INTO residential_complex_details (
          place_id, name, complex_number, location_text, description, floors_count, houses_per_floor
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (place_id) DO UPDATE SET
          name = EXCLUDED.name,
          complex_number = EXCLUDED.complex_number,
          location_text = EXCLUDED.location_text,
          description = EXCLUDED.description,
          floors_count = EXCLUDED.floors_count,
          houses_per_floor = EXCLUDED.houses_per_floor
      `,
        [
          placeId,
          name,
          attrs.complex_number ?? null,
          locationText,
          description ?? null,
          toIntMaybe(attrs.floors_count),
          housesPerFloorParam,
        ]
      );
      return;
    }

    if (typeName === 'مجمّع تجاري') {
      const storesPerFloor = parseJsonMaybe(attrs.stores_per_floor);
      const storesPerFloorParam = storesPerFloor != null ? JSON.stringify(storesPerFloor) : null;
      await pool.query(
        `
        INSERT INTO commercial_complex_details (
          place_id, name, complex_number, location_text, description, floors_count, stores_per_floor
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (place_id) DO UPDATE SET
          name = EXCLUDED.name,
          complex_number = EXCLUDED.complex_number,
          location_text = EXCLUDED.location_text,
          description = EXCLUDED.description,
          floors_count = EXCLUDED.floors_count,
          stores_per_floor = EXCLUDED.stores_per_floor
      `,
        [
          placeId,
          name,
          attrs.complex_number ?? null,
          locationText,
          description ?? null,
          toIntMaybe(attrs.floors_count),
          storesPerFloorParam,
        ]
      );
      return;
    }

    await pool.query(
      `
      INSERT INTO other_place_details (place_id, name, location_text, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (place_id) DO UPDATE SET
        name = EXCLUDED.name,
        location_text = EXCLUDED.location_text,
        description = EXCLUDED.description
    `,
      [placeId, name, locationText, description ?? null]
    );
  }

  async function syncLegacyStore(place) {
    const { type_name: typeName, id: placeId, name, description, status, latitude, longitude, created_at } = place;
    const isActive = String(status || '').toLowerCase() === 'active';
    const isStoreType = STORE_TYPES.includes(typeName);

    if (!isStoreType || !isActive) {
      await pool.query('DELETE FROM stores WHERE id = $1', [placeId]);
      return;
    }

    const { rows: attrRows } = await pool.query('SELECT key, value FROM place_attributes WHERE place_id = $1', [
      placeId,
    ]);
    const attrs = {};
    for (const a of attrRows) attrs[a.key] = a.value;

    const { rows: images } = await pool.query(
      'SELECT image_url FROM place_images WHERE place_id = $1 ORDER BY sort_order ASC',
      [placeId]
    );
    const photos = (images || []).map((i) => i.image_url);
    const phone = attrs.phone ?? null;

    const { rows: catRows } = await pool.query('SELECT id FROM categories WHERE name = $1 LIMIT 1', [typeName]);
    const categoryId = catRows[0]?.id ?? null;

    await pool.query(
      `
      INSERT INTO stores (
        id, name, description, category_id,
        latitude, longitude, phone, photos, videos,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category_id = EXCLUDED.category_id,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        phone = EXCLUDED.phone,
        photos = EXCLUDED.photos,
        videos = EXCLUDED.videos
    `,
      [
        placeId,
        name,
        description ?? '',
        categoryId,
        Number(latitude ?? 0),
        Number(longitude ?? 0),
        phone,
        JSON.stringify(photos || []),
        JSON.stringify([]),
        created_at ?? new Date().toISOString(),
      ]
    );
  }

  await seedCategories();

  const { rows: places } = await pool.query(
    `
        SELECT
          p.id,
          p.name,
          p.description,
          p.status,
          p.created_at,
          pt.name AS type_name,
          pl.latitude,
          pl.longitude
        FROM places p
        LEFT JOIN place_types pt ON pt.id = p.type_id
        LEFT JOIN place_locations pl ON pl.place_id = p.id
        WHERE p.deleted_at IS NULL
          AND pt.name = ANY($1::text[])
      `,
    [CANONICAL_TYPES]
  );

  for (const p of places) {
    await upsertTypedDetails(p);
    await syncLegacyStore(p);
  }

  console.log('V7 migration completed successfully');
}

async function migrateV8() {
  const migration = `
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS main_category VARCHAR(100);
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS sub_category VARCHAR(100);
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_store_products_main_category
  ON store_products (store_id, main_category);

CREATE INDEX IF NOT EXISTS idx_store_products_sub_category
  ON store_products (store_id, sub_category);
`;

  await pool.query(migration);
  console.log('V8 migration completed successfully');
}

async function migrateV9() {
  const migration = `
-- ==========================================
-- V9: Product categories (main/sub)
-- ==========================================

CREATE TABLE IF NOT EXISTS product_main_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) UNIQUE NOT NULL,
  emoji VARCHAR(16),
  arrow_color VARCHAR(32),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backward-compatible: add columns if table existed already
ALTER TABLE product_main_categories ADD COLUMN IF NOT EXISTS emoji VARCHAR(16);
ALTER TABLE product_main_categories ADD COLUMN IF NOT EXISTS arrow_color VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_product_main_categories_sort
  ON product_main_categories (sort_order, name);

CREATE TABLE IF NOT EXISTS product_sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_category_id UUID NOT NULL REFERENCES product_main_categories(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  emoji VARCHAR(16),
  arrow_color VARCHAR(32),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT product_sub_categories_unique UNIQUE (main_category_id, name)
);

ALTER TABLE product_sub_categories ADD COLUMN IF NOT EXISTS emoji VARCHAR(16);
ALTER TABLE product_sub_categories ADD COLUMN IF NOT EXISTS arrow_color VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_product_sub_categories_main_sort
  ON product_sub_categories (main_category_id, sort_order, name);
`;
  await pool.query(migration);
  console.log('V9 migration completed successfully');
}

async function dropUnusedTables() {
  const migration = `
DROP TABLE IF EXISTS place_requests;
`;
  await pool.query(migration);
  console.log('drop-unused-tables done');
}

async function main() {
  try {
    console.log('Running unified DB bootstrap + migrations (v1)...');
    await initDb();
    await migrateV2();
    await migrateV3();
    await migrateV4();
    await migrateV5();
    await migrateV6();

    // يجب أن تكون الأنواع الخمسة الأساسية موجودة قبل backfill في v7
    await seedPlaceTypesConstants();

    await migrateV7();
    await migrateV8();
    await migrateV9();

    if (shouldDropUnusedTables) {
      await dropUnusedTables();
    }

    console.log('✅ migrate:v1 completed successfully');
  } catch (err) {
    console.error('❌ migrate:v1 error:', err?.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

