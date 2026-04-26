import pool from '../../config/db.js';

let ensureUserProfileColumnsPromise = null;

function ensureUserProfileColumns() {
  if (!ensureUserProfileColumnsPromise) {
    ensureUserProfileColumnsPromise = pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30),
        ADD COLUMN IF NOT EXISTS date_of_birth DATE,
        ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
        ADD COLUMN IF NOT EXISTS id_card_image_url TEXT,
        ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';
      ALTER TABLE users
        ALTER COLUMN date_of_birth TYPE DATE USING date_of_birth::date;
    `);
  }
  return ensureUserProfileColumnsPromise;
}

export const authRepo = {
  async findUserByEmail(email) {
    await ensureUserProfileColumns();
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, role, created_at,
              phone_number,
              to_char(date_of_birth::date, 'YYYY-MM-DD') AS date_of_birth,
              profile_image_url, id_card_image_url, verification_status
       FROM users
       WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`,
      [email]
    );
    return rows[0] || null;
  },

  async findUserById(id) {
    await ensureUserProfileColumns();
    const { rows } = await pool.query(
      `SELECT id, name, email, role, created_at, phone_number,
              to_char(date_of_birth::date, 'YYYY-MM-DD') AS date_of_birth,
              profile_image_url, id_card_image_url, verification_status
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async findAuthUserById(id) {
    const { rows } = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  },

  async updateProfile(id, { name, phone_number, date_of_birth, profile_image_url, id_card_image_url }) {
    await ensureUserProfileColumns();
    const { rows } = await pool.query(
      `UPDATE users
       SET name = $2,
           phone_number = $3,
           date_of_birth = $4::date,
           profile_image_url = $5,
           id_card_image_url = $6,
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, name, email, role, created_at, phone_number,
                 to_char(date_of_birth::date, 'YYYY-MM-DD') AS date_of_birth,
                 profile_image_url, id_card_image_url, verification_status`,
      [id, name, phone_number, date_of_birth, profile_image_url, id_card_image_url]
    );
    return rows[0] || null;
  },

  async updatePasswordHash(id, passwordHash) {
    const { rowCount } = await pool.query(
      `UPDATE users
       SET password_hash = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, passwordHash]
    );
    return rowCount > 0;
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
