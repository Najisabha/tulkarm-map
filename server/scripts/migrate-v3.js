/**
 * migrate-v3 — place categories (tree) + place/category links
 * شغّل: npm run migrate:v3 --prefix server
 */
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  // شجرة تصنيفات الأماكن (main/sub/…)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS place_categories (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(150) NOT NULL,
      emoji      VARCHAR(16),
      color      VARCHAR(32),
      sort_order INTEGER NOT NULL DEFAULT 0,
      parent_id  UUID REFERENCES place_categories(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT place_categories_unique_name_per_parent UNIQUE (parent_id, name)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_place_categories_parent ON place_categories(parent_id, sort_order);
  `);

  // ربط مكان بتصنيف (main/sub) — مع إبقاء attributes كـ fallback
  await pool.query(`
    CREATE TABLE IF NOT EXISTS place_category_links (
      place_id    UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
      main_category_id UUID REFERENCES place_categories(id) ON DELETE SET NULL,
      sub_category_id  UUID REFERENCES place_categories(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_place_category_links_main ON place_category_links(main_category_id);
    CREATE INDEX IF NOT EXISTS idx_place_category_links_sub ON place_category_links(sub_category_id);
  `);

  console.log('✅ migrate-v3 completed');
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

