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

  async create(
    name,
    emoji = null,
    color = null,
    sortOrder = null,
    meta = {}
  ) {
    const kind = meta.kind ?? 'other';
    const singularLabel = meta.singular_label ?? name;
    const pluralLabel = meta.plural_label ?? name;
    const uiLabels = meta.ui_labels != null ? JSON.stringify(meta.ui_labels) : '{}';
    const flags = meta.flags != null ? JSON.stringify(meta.flags) : '{}';
    const aliases = meta.aliases != null ? JSON.stringify(meta.aliases) : '[]';
    const { rows } = await pool.query(
      `INSERT INTO place_types (
         name, emoji, color, sort_order,
         kind, singular_label, plural_label, ui_labels, flags, aliases
       )
       VALUES (
         $1, $2, $3, COALESCE($4, 100),
         $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb
       ) RETURNING *`,
      [name, emoji, color, sortOrder, kind, singularLabel, pluralLabel, uiLabels, flags, aliases]
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
    const kind = patch.kind !== undefined ? patch.kind : current.kind ?? 'other';
    const singularLabel =
      patch.singular_label !== undefined ? patch.singular_label : current.singular_label ?? current.name;
    const pluralLabel =
      patch.plural_label !== undefined ? patch.plural_label : current.plural_label ?? current.name;
    const uiLabels =
      patch.ui_labels !== undefined
        ? JSON.stringify(patch.ui_labels ?? {})
        : typeof current.ui_labels === 'object' && current.ui_labels !== null
          ? JSON.stringify(current.ui_labels)
          : '{}';
    const flags =
      patch.flags !== undefined
        ? JSON.stringify(patch.flags ?? {})
        : typeof current.flags === 'object' && current.flags !== null
          ? JSON.stringify(current.flags)
          : '{}';
    const aliases =
      patch.aliases !== undefined
        ? JSON.stringify(patch.aliases ?? [])
        : Array.isArray(current.aliases)
          ? JSON.stringify(current.aliases)
          : '[]';
    const { rows } = await pool.query(
      `UPDATE place_types SET
         name = $1, emoji = $2, color = $3, sort_order = $4,
         kind = $5, singular_label = $6, plural_label = $7,
         ui_labels = $8::jsonb, flags = $9::jsonb, aliases = $10::jsonb,
         updated_at = now()
       WHERE id = $11 RETURNING *`,
      [name, emoji, color, sortOrder, kind, singularLabel, pluralLabel, uiLabels, flags, aliases, id]
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
