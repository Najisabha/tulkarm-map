import pool from '../../config/db.js';

export const ratingsRepo = {
  async create({ placeId, userId, rating, comment }) {
    const { rows } = await pool.query(
      `INSERT INTO ratings (place_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [placeId, userId, rating, comment || null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT r.*, u.name as user_name
       FROM ratings r JOIN users u ON u.id = r.user_id
       WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async findByPlaceAndUser(placeId, userId) {
    const { rows } = await pool.query(
      'SELECT * FROM ratings WHERE place_id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [placeId, userId]
    );
    return rows[0] || null;
  },

  async findByPlace(placeId, { page, limit }) {
    const offset = (page - 1) * limit;

    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) FROM ratings WHERE place_id = $1 AND deleted_at IS NULL',
      [placeId]
    );
    const total = parseInt(countRows[0].count);

    const { rows: data } = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at,
              u.name as user_name, r.user_id
       FROM ratings r JOIN users u ON u.id = r.user_id
       WHERE r.place_id = $1 AND r.deleted_at IS NULL
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [placeId, limit, offset]
    );

    return { data, total, page, limit };
  },

  async update(id, { rating, comment }) {
    const updates = [];
    const values = [];
    let i = 1;

    if (rating !== undefined) { updates.push(`rating = $${i++}`); values.push(rating); }
    if (comment !== undefined) { updates.push(`comment = $${i++}`); values.push(comment); }
    if (updates.length === 0) return null;

    updates.push('updated_at = now()');
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE ratings SET ${updates.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async softDelete(id) {
    const { rows } = await pool.query(
      'UPDATE ratings SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );
    return rows[0] || null;
  },
};
