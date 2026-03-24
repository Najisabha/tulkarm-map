/**
 * V5: place_types — أيقونة ولون للعرض في التطبيق
 *
 * Run: npm run migrate:v5
 *
 * آمن للتشغيل أكثر من مرة (IF NOT EXISTS).
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

async function main() {
  const client = await pool.connect();
  try {
    await client.query(migration);
    console.log('migrate:v5 done — place_types.emoji / place_types.color');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
