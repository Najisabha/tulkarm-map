import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// اختبار الاتصال
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ خطأ في الاتصال بـ PostgreSQL:', err.message);
    console.log('تأكد من:');
    console.log('1. تشغيل PostgreSQL');
    console.log('2. وجود ملف .env مع DATABASE_URL صحيح');
    console.log('3. قاعدة البيانات tulkarm-map موجودة');
  } else {
    console.log('✅ متصل بـ PostgreSQL:', res.rows[0].now);
  }
});

export default pool;
