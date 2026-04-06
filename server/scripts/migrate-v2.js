/**
 * migrate-v2 — إضافة حقول جديدة بدون كسر الحقول الحالية
 * شغّل: npm run migrate:v2 --prefix server
 */
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  // 1) رقم الهاتف مباشرة على places (كان في attributes فقط)
  await pool.query(`
    ALTER TABLE places ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
  `);

  // 2) جدول المجمعات (سكني / تجاري)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS complexes (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      place_id     UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      complex_type VARCHAR(20) NOT NULL DEFAULT 'residential'
                   CHECK (complex_type IN ('residential','commercial')),
      floors_count   INTEGER NOT NULL DEFAULT 1,
      units_per_floor INTEGER NOT NULL DEFAULT 1,
      created_at   TIMESTAMPTZ DEFAULT now(),
      updated_at   TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT complexes_place_unique UNIQUE (place_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_complexes_place ON complexes(place_id);
  `);

  // 3) جدول وحدات المجمعات
  await pool.query(`
    CREATE TABLE IF NOT EXISTS complex_units (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      complex_id    UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
      floor_number  INTEGER NOT NULL,
      unit_number   VARCHAR(20) NOT NULL,
      child_place_id UUID REFERENCES places(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT complex_unit_unique UNIQUE (complex_id, floor_number, unit_number)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_complex_units_complex ON complex_units(complex_id);
    CREATE INDEX IF NOT EXISTS idx_complex_units_child ON complex_units(child_place_id)
      WHERE child_place_id IS NOT NULL;
  `);

  // 4) إضافة store_owner لقائمة الأدوار المسموحة (تبقى owner للتوافق للخلف)
  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin','user','owner','store_owner'));
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // 5) نقل بيانات الهاتف من store_details → places.phone_number (مرة واحدة)
  await pool.query(`
    UPDATE places p
    SET phone_number = sd.phone
    FROM store_details sd
    WHERE sd.place_id = p.id
      AND p.phone_number IS NULL
      AND sd.phone IS NOT NULL
      AND sd.phone <> '';
  `);

  console.log('✅ migrate-v2 completed');
}

async function main() {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      console.error('DATABASE_URL missing in server/.env');
      process.exit(1);
    }
    await migrate();
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
