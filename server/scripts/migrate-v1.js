/**
 * مخطط قاعدة البيانات الموحّد للإنتاج والتطوير (idempotent).
 * ينشئ الجداول التي يعتمد عليها Express API الحالي فقط (بدون legacy stores/categories).
 *
 * التشغيل: npm run migrate (من server أو من الجذر عبر npm run migrate)
 *
 * متغيرات بيئة اختيارية:
 * - ADMIN_EMAIL (افتراضي admin@system.local)
 * - ADMIN_PASSWORD (افتراضي ChangeMe123!)
 */

import bcrypt from 'bcryptjs';
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const q = (text, params) => pool.query(text, params);

async function runInTransaction(fn) {
  await q('BEGIN');
  try {
    await fn();
    await q('COMMIT');
  } catch (err) {
    await q('ROLLBACK');
    throw err;
  }
}

async function createSchema() {
  await q(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin','user','owner','store_owner')),
      is_admin BOOLEAN NOT NULL DEFAULT false,
      phone_number VARCHAR(30),
      date_of_birth DATE,
      profile_image_url TEXT,
      id_card_image_url TEXT,
      verification_status VARCHAR(20) DEFAULT 'unverified',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT users_email_key UNIQUE (email)
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      revoked_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS place_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      emoji VARCHAR(64),
      color VARCHAR(32),
      sort_order INTEGER NOT NULL DEFAULT 100,
      kind VARCHAR(32) NOT NULL DEFAULT 'other'
        CHECK (kind IN ('house','store','residentialComplex','commercialComplex','other')),
      singular_label VARCHAR(150),
      plural_label VARCHAR(150),
      ui_labels JSONB NOT NULL DEFAULT '{}'::jsonb,
      flags JSONB NOT NULL DEFAULT '{}'::jsonb,
      aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
      CONSTRAINT place_types_name_key UNIQUE (name)
    );
    CREATE INDEX IF NOT EXISTS idx_place_types_name ON place_types(name);
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS place_type_attribute_definitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      place_type_id UUID NOT NULL REFERENCES place_types(id) ON DELETE CASCADE,
      key VARCHAR(100) NOT NULL,
      label VARCHAR(255) NOT NULL,
      value_type VARCHAR(20) NOT NULL DEFAULT 'string'
        CHECK (value_type IN ('string','number','boolean','json','date','phone')),
      is_required BOOLEAN DEFAULT false,
      options JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT ptad_type_key_unique UNIQUE (place_type_id, key)
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS places (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      type_id UUID REFERENCES place_types(id) ON DELETE SET NULL,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('active','pending','rejected')),
      attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
      phone_number VARCHAR(30),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_places_status ON places(status) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_places_owner ON places(owner_id) WHERE owner_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_places_type_created ON places(type_id, created_at) WHERE deleted_at IS NULL;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS place_locations (
      place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
      latitude DECIMAL(10,7) NOT NULL,
      longitude DECIMAL(10,7) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_place_locations_coords ON place_locations(latitude, longitude);
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      type VARCHAR(10) NOT NULL CHECK (type IN ('image','video')),
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_media_place ON media(place_id, sort_order);
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS store_details (
      place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
      phone VARCHAR(30),
      opening_hours TEXT
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS complexes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      complex_type VARCHAR(20) NOT NULL DEFAULT 'residential'
        CHECK (complex_type IN ('residential','commercial')),
      floors_count INTEGER NOT NULL DEFAULT 1,
      units_per_floor INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT complexes_place_unique UNIQUE (place_id)
    );
    CREATE INDEX IF NOT EXISTS idx_complexes_place ON complexes(place_id);
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS complex_units (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
      floor_number INTEGER NOT NULL,
      unit_number VARCHAR(20) NOT NULL,
      child_place_id UUID REFERENCES places(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT complex_unit_unique UNIQUE (complex_id, floor_number, unit_number)
    );
    CREATE INDEX IF NOT EXISTS idx_complex_units_complex ON complex_units(complex_id);
    CREATE INDEX IF NOT EXISTS idx_complex_units_child ON complex_units(child_place_id) WHERE child_place_id IS NOT NULL;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS place_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(150) NOT NULL,
      emoji VARCHAR(16),
      color VARCHAR(32),
      sort_order INTEGER NOT NULL DEFAULT 0,
      parent_id UUID REFERENCES place_categories(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      place_type_id UUID NOT NULL REFERENCES place_types(id) ON DELETE CASCADE,
      CONSTRAINT place_categories_unique_type_parent_name UNIQUE (place_type_id, parent_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_place_categories_parent ON place_categories(parent_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_place_categories_type ON place_categories(place_type_id, sort_order);
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS place_category_links (
      place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
      main_category_id UUID REFERENCES place_categories(id) ON DELETE SET NULL,
      sub_category_id UUID REFERENCES place_categories(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_place_category_links_main ON place_category_links(main_category_id);
    CREATE INDEX IF NOT EXISTS idx_place_category_links_sub ON place_category_links(sub_category_id);
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT ratings_place_user_unique UNIQUE (place_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ratings_place ON ratings(place_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_ratings_place_created ON ratings(place_id, created_at) WHERE deleted_at IS NULL;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      place_id UUID REFERENCES places(id) ON DELETE CASCADE,
      reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reason VARCHAR(50) NOT NULL,
      details TEXT,
      status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending','resolved','dismissed')),
      resolved_at TIMESTAMPTZ,
      resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100),
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      actor_name VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

/** قواعد قديمة: pg_dump ربط place_id في reports بجدول stores بالخطأ — يُصلح إلى places. */
async function fixReportsPlaceFk() {
  await q(`ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_store_id_fkey;`);
  const { rows } = await q(`
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public' AND t.relname = 'reports' AND c.conname = 'reports_place_id_fkey'
  `);
  if (rows.length === 0) {
    await q(`
      DO $$
      BEGIN
        ALTER TABLE reports
          ADD CONSTRAINT reports_place_id_fkey
          FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }
}

async function seedDefaults() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@system.local').trim().toLowerCase();
  const { rows } = await q(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [adminEmail]);

  if (rows.length === 0) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
    await q(
      `INSERT INTO users (name, email, password_hash, role, is_admin)
       VALUES ($1, $2, $3, 'admin', true)`,
      ['System Admin', adminEmail, hash]
    );
    console.log(`✅ تم إنشاء حساب المدير: ${adminEmail} (غيّر ADMIN_PASSWORD في الإنتاج)`);
  }

  await q(`
    INSERT INTO app_settings (key, value, updated_at) VALUES
      ('maintenance_mode', 'false'::jsonb, now()),
      ('welcome_message', '"مرحباً بكم في خريطة طولكرم"'::jsonb, now())
    ON CONFLICT (key) DO NOTHING;
  `);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL مفقود');
    process.exit(1);
  }

  try {
    await runInTransaction(async () => {
      await createSchema();
      await fixReportsPlaceFk();
      await seedDefaults();
    });

    console.log('✅ Database schema ready');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
