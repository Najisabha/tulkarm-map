import pool from '../../config/db.js';

function rowAttributesToArray(attributes) {
  if (!attributes || typeof attributes !== 'object') return [];
  const out = [];
  for (const [key, raw] of Object.entries(attributes)) {
    if (raw != null && typeof raw === 'object' && !Array.isArray(raw) && 'v' in raw) {
      out.push({
        key,
        value: String(raw.v ?? ''),
        value_type: typeof raw.t === 'string' ? raw.t : 'string',
      });
    } else {
      out.push({ key, value: String(raw ?? ''), value_type: 'string' });
    }
  }
  return out;
}

function mediaRowsToImages(rows) {
  return (rows || []).map((r) => ({
    id: r.id,
    image_url: r.url,
    sort_order: r.sort_order,
  }));
}

export const placesRepo = {
  async create({ name, description, typeId, createdBy, status, phoneNumber }) {
    const { rows } = await pool.query(
      `INSERT INTO places (name, description, type_id, created_by, status, attributes, phone_number)
       VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, $6)
       RETURNING *`,
      [name, description || null, typeId, createdBy, status || 'pending', phoneNumber || null]
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
    const t = valueType || 'string';
    const payload = JSON.stringify({ v: String(value), t });
    await pool.query(
      `UPDATE places SET attributes = jsonb_set(
         COALESCE(attributes, '{}'::jsonb),
         ARRAY[$2::text],
         $3::jsonb,
         true
       ), updated_at = now() WHERE id = $1`,
      [placeId, key, payload]
    );
  },

  async addImage({ placeId, imageUrl, sortOrder }) {
    const { rows } = await pool.query(
      `INSERT INTO media (place_id, type, url, sort_order)
       VALUES ($1, 'image', $2, $3) RETURNING *`,
      [placeId, imageUrl, sortOrder || 0]
    );
    const m = rows[0];
    return { id: m.id, place_id: m.place_id, image_url: m.url, sort_order: m.sort_order };
  },

  /** إنشاء أو تحديث سجل المجمع */
  async upsertComplex({ placeId, complexType, floorsCount, unitsPerFloor }) {
    const { rows } = await pool.query(
      `INSERT INTO complexes (place_id, complex_type, floors_count, units_per_floor)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (place_id) DO UPDATE SET
         complex_type    = EXCLUDED.complex_type,
         floors_count    = EXCLUDED.floors_count,
         units_per_floor = EXCLUDED.units_per_floor,
         updated_at      = now()
       RETURNING *`,
      [placeId, complexType || 'residential', floorsCount || 1, unitsPerFloor || 1]
    );
    return rows[0];
  },

  /** ربط المكان بتصنيف رئيسي/فرعي */
  async upsertCategoryLink({ placeId, mainCategoryId, subCategoryId }) {
    const { rows } = await pool.query(
      `
        INSERT INTO place_category_links (place_id, main_category_id, sub_category_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (place_id) DO UPDATE SET
          main_category_id = EXCLUDED.main_category_id,
          sub_category_id  = EXCLUDED.sub_category_id,
          updated_at       = now()
        RETURNING *
      `,
      [placeId, mainCategoryId || null, subCategoryId || null]
    );
    return rows[0];
  },

  async findCategoryLink(placeId) {
    const { rows } = await pool.query(
      `SELECT * FROM place_category_links WHERE place_id = $1`,
      [placeId]
    );
    return rows[0] || null;
  },

  async findComplexByPlaceId(placeId) {
    const { rows } = await pool.query(
      `SELECT * FROM complexes WHERE place_id = $1`,
      [placeId]
    );
    return rows[0] || null;
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
    place.attributes = rowAttributesToArray(place.attributes);

    const { rows: mediaRows } = await pool.query(
      `SELECT id, url, sort_order FROM media WHERE place_id = $1 AND type = 'image' ORDER BY sort_order, created_at`,
      [id]
    );
    place.images = mediaRowsToImages(mediaRows);

    const { rows: ratingAgg } = await pool.query(
      `SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as rating_count
       FROM ratings WHERE place_id = $1 AND deleted_at IS NULL`,
      [id]
    );
    place.avg_rating = parseFloat(ratingAgg[0].avg_rating).toFixed(1);
    place.rating_count = parseInt(ratingAgg[0].rating_count);

    // بيانات المجمع إن وُجدت
    const complex = await placesRepo.findComplexByPlaceId(id);
    if (complex) {
      place.complex_kind = complex.complex_type;
      place.floors_count = complex.floors_count;
      place.units_per_floor = complex.units_per_floor;
    }

    // روابط التصنيفات إن وُجدت (إضافية غير كاسرة)
    const link = await placesRepo.findCategoryLink(id);
    if (link) {
      place.main_category_id = link.main_category_id;
      place.sub_category_id = link.sub_category_id;
    }

    return place;
  },

  async findMany({ page, limit, type, q, status, lat, lng, radius, sort }) {
    const conditions = ['p.deleted_at IS NULL'];
    const params = [];
    let paramIdx = 1;

    if (status && status !== 'all') {
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
      SELECT p.id, p.name, p.description, p.status, p.created_at, p.attributes,
             p.phone_number,
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

      const { rows: allMedia } = await pool.query(
        `SELECT place_id, id, url, sort_order FROM media
         WHERE place_id = ANY($1) AND type = 'image' ORDER BY sort_order, created_at`,
        [ids]
      );

      const { rows: allComplexes } = await pool.query(
        `SELECT place_id, complex_type, floors_count, units_per_floor
         FROM complexes WHERE place_id = ANY($1)`,
        [ids]
      );

      const complexMap = Object.fromEntries(allComplexes.map((c) => [c.place_id, c]));

      const { rows: allLinks } = await pool.query(
        `SELECT place_id, main_category_id, sub_category_id
         FROM place_category_links WHERE place_id = ANY($1)`,
        [ids]
      );
      const linkMap = Object.fromEntries(allLinks.map((l) => [l.place_id, l]));

      for (const p of data) {
        p.attributes = rowAttributesToArray(p.attributes);
        p.images = mediaRowsToImages(allMedia.filter((m) => m.place_id === p.id));
        const cx = complexMap[p.id];
        if (cx) {
          p.complex_kind = cx.complex_type;
          p.floors_count = cx.floors_count;
          p.units_per_floor = cx.units_per_floor;
        }
        const lk = linkMap[p.id];
        if (lk) {
          p.main_category_id = lk.main_category_id;
          p.sub_category_id = lk.sub_category_id;
        }
      }
    }

    return { data, total, page, limit };
  },

  async update(id, { name, description, typeId, status, phoneNumber }) {
    const updates = [];
    const values = [];
    let i = 1;

    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
    if (typeId !== undefined) { updates.push(`type_id = $${i++}`); values.push(typeId); }
    if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }
    if (phoneNumber !== undefined) { updates.push(`phone_number = $${i++}`); values.push(phoneNumber || null); }

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

  async hardDelete(id) {
    const { rows } = await pool.query('DELETE FROM places WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  },

  async deleteImage(imageId) {
    const { rows } = await pool.query(
      'DELETE FROM media WHERE id = $1 AND type = $2 RETURNING id, url as image_url, sort_order',
      [imageId, 'image']
    );
    return rows[0] || null;
  },
};
