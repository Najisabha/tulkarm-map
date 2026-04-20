import pool from '../../config/db.js';

export const placeTypesRepo = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM place_types ORDER BY sort_order ASC, name ASC');
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

  async create(name, emoji = null, color = null, sortOrder = null) {
    const { rows } = await pool.query(
      `INSERT INTO place_types (name, emoji, color, sort_order)
       VALUES ($1, $2, $3, COALESCE($4, 100)) RETURNING *`,
      [name, emoji, color, sortOrder]
    );
    return rows[0];
  },

  async update(id, patch) {
    const current = await this.findById(id);
    if (!current) return null;
    const name = patch.name !== undefined ? patch.name : current.name;
    const emoji = patch.emoji !== undefined ? patch.emoji : current.emoji;
    const color = patch.color !== undefined ? patch.color : current.color;
    const sortOrder = patch.sort_order !== undefined ? patch.sort_order : current.sort_order;
    const { rows } = await pool.query(
      `UPDATE place_types SET name = $1, emoji = $2, color = $3, sort_order = $4, updated_at = now()
       WHERE id = $5 RETURNING *`,
      [name, emoji, color, sortOrder, id]
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

  async findAttributeDefinitionById(defId) {
    const { rows } = await pool.query(
      'SELECT * FROM place_type_attribute_definitions WHERE id = $1',
      [defId]
    );
    return rows[0] || null;
  },

  async updateAttributeDefinition(defId, placeTypeId, patch) {
    const current = await this.findAttributeDefinitionById(defId);
    if (!current || current.place_type_id !== placeTypeId) return null;

    const nextKey = patch.key !== undefined ? patch.key : current.key;
    const nextLabel = patch.label !== undefined ? patch.label : current.label;
    const nextVt = patch.value_type !== undefined ? patch.value_type : current.value_type;
    const nextReq = patch.is_required !== undefined ? patch.is_required : current.is_required;
    const nextOptions = Object.prototype.hasOwnProperty.call(patch, 'options')
      ? patch.options
      : current.options;

    if (nextKey !== current.key) {
      const { rows: clash } = await pool.query(
        `SELECT 1 FROM place_type_attribute_definitions WHERE place_type_id = $1 AND LOWER(key) = LOWER($2) AND id <> $3 LIMIT 1`,
        [placeTypeId, nextKey, defId]
      );
      if (clash.length > 0) {
        const err = new Error('duplicate attribute key');
        err.code = 'ATTR_KEY_CONFLICT';
        throw err;
      }
    }

    const { rows } = await pool.query(
      `UPDATE place_type_attribute_definitions
       SET key = $1, label = $2, value_type = $3, is_required = $4,
           options = $5, updated_at = now()
       WHERE id = $6 AND place_type_id = $7
       RETURNING *`,
      [nextKey, nextLabel, nextVt, nextReq, nextOptions ?? null, defId, placeTypeId]
    );
    return rows[0] || null;
  },

  async deleteAttributeDefinition(defId, placeTypeId) {
    const { rows } = await pool.query(
      `DELETE FROM place_type_attribute_definitions WHERE id = $1 AND place_type_id = $2 RETURNING *`,
      [defId, placeTypeId]
    );
    return rows[0] || null;
  },
};
