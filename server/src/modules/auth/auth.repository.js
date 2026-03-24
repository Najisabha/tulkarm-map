import pool from '../../config/db.js';

export const authRepo = {
  async findUserByEmail(email) {
    const { rows } = await pool.query(
      'SELECT id, name, email, password_hash, role, created_at FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL',
      [email]
    );
    return rows[0] || null;
  },

  async findUserById(id) {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  },

  async createUser({ name, email, passwordHash }) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, name, email, role, created_at`,
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    );
    return rows[0];
  },

  async saveRefreshToken({ userId, tokenHash, expiresAt }) {
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
  },

  async findValidRefreshToken(tokenHash) {
    const { rows } = await pool.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, u.role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id AND u.deleted_at IS NULL
       WHERE rt.token_hash = $1
         AND rt.revoked_at IS NULL
         AND rt.expires_at > now()`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  async revokeRefreshToken(tokenHash) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1',
      [tokenHash]
    );
  },

  async revokeAllUserTokens(userId) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  },
};
