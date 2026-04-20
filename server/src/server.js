import app from './app.js';
import { env } from './config/env.js';
import pool from './config/db.js';

async function start() {
  try {
    const { rows } = await pool.query('SELECT NOW()');
    console.log('DB connected:', rows[0].now);
  } catch (err) {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
    console.log(`API: /api/*`);
    console.log(`Health: http://localhost:${env.PORT}/api/health`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${env.PORT} is already in use. Stop the other process or set PORT in server/.env.`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

start();
