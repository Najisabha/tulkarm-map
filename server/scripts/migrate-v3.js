/**
 * V3 Migration: Scalable schema with place_types, places, place_locations,
 * place_attributes, place_images, ratings, refresh_tokens,
 * and place_type_attribute_definitions.
 *
 * Run: npm run migrate:v3
 *
 * Safe to run multiple times (IF NOT EXISTS on everything).
 * Existing tables (users, categories, stores, etc.) are NOT dropped.
 */
import pg from 'pg';
import 'dotenv/config';

const connStr = process.env.DATABASE_URL;
if (!connStr || connStr.includes('YOUR_PASSWORD')) {
  console.error('DATABASE_URL not configured in server/.env');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: connStr });

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

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running V3 migration...');
    await client.query(migration);
    console.log('V3 migration completed successfully');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
