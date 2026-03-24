import pg from 'pg';
import { env } from './env.js';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

export default pool;
