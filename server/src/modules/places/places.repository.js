import pool from '../../config/db.js';

export const placesRepo = {
  async create({ name, description, typeId, createdBy, status }) {
    const { rows } = await pool.query(
      `INSERT INTO places (name, description, type_id, created_by, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      // Fail safe: any place created without an explicit status stays pending
      // until an admin approves it.
      [name, description || null, typeId, createdBy, status || 'pending']
    );
    return rows[0];
  },

  async createLocation({ placeId, latitude, longitude }) {
    await pool.query(
      `INSERT INTO place_locations (place_id, latitude, longitude)
       VALUES ($1, $2, $3)`,
      [placeId, latitude, longitude]
    );
  },

  async updateLocation({ placeId, latitude, longitude }) {
    await pool.query(
      `UPDATE place_locations SET latitude = $2, longitude = $3, updated_at = now()
       WHERE place_id = $1`,
      [placeId, latitude, longitude]
    );
  },

  async upsertAttribute({ placeId, key, value, valueType }) {
    await pool.query(
      `INSERT INTO place_attributes (place_id, key, value, value_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (place_id, key)
       DO UPDATE SET value = $3, value_type = $4, updated_at = now()`,
      [placeId, key, value, valueType || 'string']
    );
  },

  async addImage({ placeId, imageUrl, sortOrder }) {
    const { rows } = await pool.query(
      `INSERT INTO place_images (place_id, image_url, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [placeId, imageUrl, sortOrder || 0]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT p.*, pt.name as type_name, pl.latitude, pl.longitude,
              u.name as creator_name
       FROM places p
       LEFT JOIN place_types pt ON pt.id = p.type_id
       LEFT JOIN place_locations pl ON pl.place_id = p.id
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id]
    );
    if (!rows[0]) return null;

    const place = rows[0];

    const { rows: attrs } = await pool.query(
      'SELECT key, value, value_type FROM place_attributes WHERE place_id = $1',
      [id]
    );
    place.attributes = attrs;

    const { rows: images } = await pool.query(
      'SELECT id, image_url, sort_order FROM place_images WHERE place_id = $1 ORDER BY sort_order',
      [id]
    );
    place.images = images;

    const { rows: ratingAgg } = await pool.query(
      `SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as rating_count
       FROM ratings WHERE place_id = $1 AND deleted_at IS NULL`,
      [id]
    );
    place.avg_rating = parseFloat(ratingAgg[0].avg_rating).toFixed(1);
    place.rating_count = parseInt(ratingAgg[0].rating_count);

    return place;
  },

  async findMany({ page, limit, type, q, status, lat, lng, radius, sort }) {
    const conditions = ['p.deleted_at IS NULL'];
    const params = [];
    let paramIdx = 1;

    if (status) {
      conditions.push(`p.status = $${paramIdx++}`);
      params.push(status);
    }

    if (type) {
      conditions.push(`pt.name = $${paramIdx++}`);
      params.push(type);
    }

    if (q) {
      conditions.push(`(p.name ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx})`);
      params.push(`%${q}%`);
      paramIdx++;
    }

    let distanceExpr = 'NULL';
    if (lat != null && lng != null) {
      distanceExpr = `(
        6371000 * acos(
          LEAST(1, cos(radians($${paramIdx})) * cos(radians(pl.latitude))
          * cos(radians(pl.longitude) - radians($${paramIdx + 1}))
          + sin(radians($${paramIdx})) * sin(radians(pl.latitude)))
        )
      )`;
      params.push(lat, lng);
      paramIdx += 2;

      if (radius) {
        conditions.push(`${distanceExpr} <= $${paramIdx++}`);
        params.push(radius);
      }
    }

    const whereClause = conditions.join(' AND ');

    let orderBy;
    switch (sort) {
      case 'distance':
        orderBy = lat != null ? `${distanceExpr} ASC NULLS LAST` : 'p.created_at DESC';
        break;
      case 'rating':
        orderBy = 'avg_rating DESC NULLS LAST, p.created_at DESC';
        break;
      default:
        orderBy = 'p.created_at DESC';
    }

    const countQuery = `
      SELECT COUNT(*) FROM places p
      LEFT JOIN place_types pt ON pt.id = p.type_id
      LEFT JOIN place_locations pl ON pl.place_id = p.id
      WHERE ${whereClause}`;
    const { rows: countRows } = await pool.query(countQuery, params);
    const total = parseInt(countRows[0].count);

    const offset = (page - 1) * limit;
    const dataParams = [...params, limit, offset];

    const dataQuery = `
      SELECT p.id, p.name, p.description, p.status, p.created_at,
             pt.name as type_name, pt.id as type_id,
             pl.latitude, pl.longitude,
             COALESCE(r.avg_rating, 0) as avg_rating,
             COALESCE(r.rating_count, 0) as rating_count
             ${lat != null ? `, ${distanceExpr} as distance` : ''}
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.type_id
      LEFT JOIN place_locations pl ON pl.place_id = p.id
      LEFT JOIN LATERAL (
        SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count
        FROM ratings WHERE place_id = p.id AND deleted_at IS NULL
      ) r ON true
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;

    const { rows: data } = await pool.query(dataQuery, dataParams);

    if (data.length > 0) {
      const ids = data.map((p) => p.id);
      const { rows: allAttrs } = await pool.query(
        'SELECT place_id, key, value, value_type FROM place_attributes WHERE place_id = ANY($1)',
        [ids]
      );
      const { rows: allImages } = await pool.query(
        'SELECT place_id, id, image_url, sort_order FROM place_images WHERE place_id = ANY($1) ORDER BY sort_order',
        [ids]
      );
      for (const p of data) {
        p.attributes = allAttrs.filter((a) => a.place_id === p.id);
        p.images = allImages.filter((img) => img.place_id === p.id);
      }
    }

    return { data, total, page, limit };
  },

  async update(id, { name, description, typeId, status }) {
    const updates = [];
    const values = [];
    let i = 1;

    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
    if (typeId !== undefined) { updates.push(`type_id = $${i++}`); values.push(typeId); }
    if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }

    if (updates.length === 0) return null;

    updates.push(`updated_at = now()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE places SET ${updates.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async softDelete(id) {
    const { rows } = await pool.query(
      'UPDATE places SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );
    return rows[0] || null;
  },

  /** إزالة الصف نهائياً (CASCADE يزيل المواقع والخصائص والصور المرتبطة) */
  async hardDelete(id) {
    const { rows } = await pool.query('DELETE FROM places WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  },

  async deleteImage(imageId) {
    const { rows } = await pool.query(
      'DELETE FROM place_images WHERE id = $1 RETURNING *',
      [imageId]
    );
    return rows[0] || null;
  },
};
