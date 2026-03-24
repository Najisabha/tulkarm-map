import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const connStr = process.env.DATABASE_URL?.trim();
const isValidUrl = connStr && !connStr.includes('YOUR_PASSWORD') && !connStr.includes('localhost:5432/tulkarm-map');

if (!isValidUrl) {
  console.error('❌ يُرجى إضافة رابط اتصال Neon في server/.env');
  console.error('   Neon Console → Connect → انسخ الرابط → ضعه في DATABASE_URL');
}

const pool = new Pool({
  connectionString: connStr || undefined,
});

// اختبار الاتصال (فقط عند وجود رابط صحيح)
if (isValidUrl) {
  pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
    if (!connStr || connStr.includes('YOUR_PASSWORD')) {
      console.log('   ضع رابط Neon في server/.env (من Neon Console → Connect)');
    } else {
      console.log('   تأكد أن رابط DATABASE_URL صحيح وقاعدة البيانات متاحة');
    }
  } else {
    console.log('✅ متصل بقاعدة البيانات:', res.rows[0].now);
  }
  });
}

export default pool;
