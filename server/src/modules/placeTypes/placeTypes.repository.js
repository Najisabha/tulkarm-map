import pool from '../../config/db.js';

export const placeTypesRepo = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM place_types ORDER BY name');
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM place_types WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findByName(name) {
    const { rows } = await pool.query('SELECT * FROM place_types WHERE LOWER(name) = LOWER($1)', [name]);
    return rows[0] || null;
  },

  async create(name, emoji = null, color = null) {
    const { rows } = await pool.query(
      'INSERT INTO place_types (name, emoji, color) VALUES ($1, $2, $3) RETURNING *',
      [name, emoji, color]
    );
    return rows[0];
  },

  async update(id, patch) {
    const current = await this.findById(id);
    if (!current) return null;
    const name = patch.name !== undefined ? patch.name : current.name;
    const emoji = patch.emoji !== undefined ? patch.emoji : current.emoji;
    const color = patch.color !== undefined ? patch.color : current.color;
    const { rows } = await pool.query(
      `UPDATE place_types SET name = $1, emoji = $2, color = $3, updated_at = now()
       WHERE id = $4 RETURNING *`,
      [name, emoji, color, id]
    );
    return rows[0] || null;
  },

  async hasPlaces(placeTypeId) {
    const { rows } = await pool.query(
      'SELECT 1 FROM places WHERE type_id = $1 LIMIT 1',
      [placeTypeId]
    );
    return rows.length > 0;
  },

  async remove(id) {
    await pool.query('DELETE FROM place_types WHERE id = $1', [id]);
  },

  async getAttributeDefinitions(placeTypeId) {
    const { rows } = await pool.query(
      'SELECT * FROM place_type_attribute_definitions WHERE place_type_id = $1 ORDER BY key',
      [placeTypeId]
    );
    return rows;
  },

  async createAttributeDefinition(placeTypeId, data) {
    const { rows } = await pool.query(
      `INSERT INTO place_type_attribute_definitions (place_type_id, key, label, value_type, is_required, options)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [placeTypeId, data.key, data.label, data.value_type, data.is_required, data.options ? JSON.stringify(data.options) : null]
    );
    return rows[0];
  },
};
