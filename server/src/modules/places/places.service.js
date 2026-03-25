import { placesRepo } from './places.repository.js';
import { placeTypesRepo } from '../placeTypes/placeTypes.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import pool from '../../config/db.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function effectiveCreatedBy(user) {
  if (!user?.id) return null;
  const id = String(user.id);
  return UUID_RE.test(id) ? id : null;
}

function isAdminRole(user) {
  return Boolean(user?.role && String(user.role).toLowerCase() === 'admin');
}

export const placesService = {
  /**
   * @param {object} options
   * @param {boolean} [options.publishDirectly] — `true` فقط من مسار `/api/places/from-admin` (مدير مسجّل). أي إضافة من التطبيق العام تبقى `pending`.
   */
  async create(data, user, options = {}) {
    const typeRow = await placeTypesRepo.findById(data.type_id);
    if (!typeRow) {
      throw ApiError.badRequest(
        'نوع المكان غير موجود في قاعدة البيانات. من الإدارة: «إدارة الفئات» ثم أعد فتح إضافة المكان.'
      );
    }

    const publishDirectly = options.publishDirectly === true;
    const status = publishDirectly && isAdminRole(user) ? 'active' : 'pending';
    const createdBy = effectiveCreatedBy(user);

    const place = await placesRepo.create({
      name: data.name,
      description: data.description,
      typeId: data.type_id,
      createdBy,
      status,
    });

    await placesRepo.createLocation({
      placeId: place.id,
      latitude: data.latitude,
      longitude: data.longitude,
    });

    if (data.attributes?.length) {
      for (const attr of data.attributes) {
        await placesRepo.upsertAttribute({
          placeId: place.id,
          key: attr.key,
          value: attr.value,
          valueType: attr.value_type,
        });
      }
    }

    if (data.image_urls?.length) {
      for (let i = 0; i < data.image_urls.length; i++) {
        await placesRepo.addImage({
          placeId: place.id,
          imageUrl: data.image_urls[i],
          sortOrder: i,
        });
      }
    }

    // Sync typed detail tables + legacy stores table (for buying/services) when needed
    await syncTypedDetailsAndLegacyStore(place.id);

    return placesRepo.findById(place.id);
  },

  async getById(id, viewer = null) {
    const place = await placesRepo.findById(id);
    if (!place) throw ApiError.notFound('المكان غير موجود');
    const admin = viewer?.role === 'admin';
    if (place.status !== 'active' && !admin) {
      throw ApiError.notFound('المكان غير موجود');
    }
    return place;
  },

  async getMany(query) {
    return placesRepo.findMany(query);
  },

  async update(id, data, user) {
    const place = await placesRepo.findById(id);
    if (!place) throw ApiError.notFound('المكان غير موجود');

    if (user.role !== 'admin' && place.created_by !== user.id) {
      throw ApiError.forbidden('لا يمكنك تعديل هذا المكان');
    }

    if (data.status !== undefined && user.role !== 'admin') {
      throw ApiError.forbidden('فقط المدير يمكنه تغيير حالة نشر المكان');
    }

    /** رفض طلب معلّق: حذف نهائي من قاعدة البيانات (لا يبقى كمكان/طلب). */
    if (user.role === 'admin' && data.status === 'rejected') {
      const st = String(place.status || '').toLowerCase();
      if (st === 'pending') {
        await placesRepo.hardDelete(id);
        // Remove legacy store row to avoid dangling purchase/services
        await pool.query('DELETE FROM stores WHERE id = $1', [id]);
        return null;
      }
      throw ApiError.badRequest(
        'حالة «مرفوض» تُطبَّق على طلبات قيد الانتظار فقط. لإزالة مكان منشور استخدم حذف المكان.'
      );
    }

    await placesRepo.update(id, {
      name: data.name,
      description: data.description,
      typeId: data.type_id,
      status: data.status,
    });

    if (data.latitude != null && data.longitude != null) {
      await placesRepo.updateLocation({
        placeId: id,
        latitude: data.latitude,
        longitude: data.longitude,
      });
    }

    if (data.attributes?.length) {
      for (const attr of data.attributes) {
        await placesRepo.upsertAttribute({
          placeId: id,
          key: attr.key,
          value: attr.value,
          valueType: attr.value_type,
        });
      }
    }

    // Sync typed detail tables + legacy stores table (for buying/services) when needed
    await syncTypedDetailsAndLegacyStore(id);

    return placesRepo.findById(id);
  },

  async remove(id, user) {
    const place = await placesRepo.findById(id);
    if (!place) throw ApiError.notFound('المكان غير موجود');

    if (user.role !== 'admin' && place.created_by !== user.id) {
      throw ApiError.forbidden('لا يمكنك حذف هذا المكان');
    }

    const st = String(place.status || '').toLowerCase();
    const unpublished = st !== 'active';
    if (unpublished) {
      await pool.query('DELETE FROM stores WHERE id = $1', [id]);
      return placesRepo.hardDelete(id);
    }
    // For soft delete: also delete legacy stores row to prevent purchase of hidden places
    await pool.query('DELETE FROM stores WHERE id = $1', [id]);
    return placesRepo.softDelete(id);
  },

  async addImage(placeId, imageUrl, user) {
    const place = await placesRepo.findById(placeId);
    if (!place) throw ApiError.notFound('المكان غير موجود');
    if (user.role !== 'admin' && place.created_by !== user.id) {
      throw ApiError.forbidden('لا يمكنك إضافة صور لهذا المكان');
    }
    return placesRepo.addImage({ placeId, imageUrl, sortOrder: (place.images?.length || 0) });
  },

  async removeImage(placeId, imageId, user) {
    const place = await placesRepo.findById(placeId);
    if (!place) throw ApiError.notFound('المكان غير موجود');
    if (user.role !== 'admin' && place.created_by !== user.id) {
      throw ApiError.forbidden('لا يمكنك حذف صور من هذا المكان');
    }
    const deleted = await placesRepo.deleteImage(imageId);
    if (!deleted) throw ApiError.notFound('الصورة غير موجودة');
    return deleted;
  },
};

async function getPlaceContext(placeId) {
  const { rows: placeRows } = await pool.query(
    `
      SELECT
        p.id,
        p.name,
        p.description,
        p.status,
        p.created_at,
        pt.name AS type_name,
        pl.latitude,
        pl.longitude
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.type_id
      LEFT JOIN place_locations pl ON pl.place_id = p.id
      WHERE p.id = $1 AND p.deleted_at IS NULL
    `,
    [placeId]
  );
  if (!placeRows[0]) return null;
  const place = placeRows[0];

  const { rows: attrRows } = await pool.query(
    'SELECT key, value, value_type FROM place_attributes WHERE place_id = $1',
    [placeId]
  );
  const attrs = {};
  for (const a of attrRows) attrs[a.key] = a.value;

  const { rows: images } = await pool.query(
    'SELECT image_url FROM place_images WHERE place_id = $1 ORDER BY sort_order ASC',
    [placeId]
  );

  return { place, attrs, images };
}

function parseJsonMaybe(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function toIntMaybe(value) {
  if (value == null) return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

async function upsertTypedDetails(placeId) {
  const ctx = await getPlaceContext(placeId);
  if (!ctx) return;

  const { place, attrs, images } = ctx;
  const typeName = place.type_name;
  const imageUrl = images?.[0]?.image_url || null;

  const commonCols = {
    place_id: place.id,
    name: place.name,
    location_text: attrs.location_text ?? null,
    description: place.description ?? null,
  };

  switch (typeName) {
    case 'منزل': {
      await pool.query(
        `
          INSERT INTO house_details (place_id, name, house_number, location_text, description, image_url)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (place_id) DO UPDATE SET
            name = EXCLUDED.name,
            house_number = EXCLUDED.house_number,
            location_text = EXCLUDED.location_text,
            description = EXCLUDED.description,
            image_url = EXCLUDED.image_url
        `,
        [
          commonCols.place_id,
          commonCols.name,
          attrs.house_number ?? null,
          commonCols.location_text,
          commonCols.description,
          imageUrl,
        ]
      );
      return;
    }

    case 'متجر تجاري': {
      await pool.query(
        `
          INSERT INTO store_details (place_id, name, store_type, store_category, store_number, location_text, description)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (place_id) DO UPDATE SET
            name = EXCLUDED.name,
            store_type = EXCLUDED.store_type,
            store_category = EXCLUDED.store_category,
            store_number = EXCLUDED.store_number,
            location_text = EXCLUDED.location_text,
            description = EXCLUDED.description
        `,
        [
          commonCols.place_id,
          commonCols.name,
          attrs.store_type ?? null,
          attrs.store_category ?? null,
          attrs.store_number ?? null,
          commonCols.location_text,
          commonCols.description,
        ]
      );
      return;
    }

    case 'مجمّع سكني': {
      const housesPerFloor = parseJsonMaybe(attrs.houses_per_floor);
      const housesPerFloorParam = housesPerFloor != null ? JSON.stringify(housesPerFloor) : null;
      await pool.query(
        `
          INSERT INTO residential_complex_details (
            place_id, name, complex_number, location_text, description, floors_count, houses_per_floor
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (place_id) DO UPDATE SET
            name = EXCLUDED.name,
            complex_number = EXCLUDED.complex_number,
            location_text = EXCLUDED.location_text,
            description = EXCLUDED.description,
            floors_count = EXCLUDED.floors_count,
            houses_per_floor = EXCLUDED.houses_per_floor
        `,
        [
          commonCols.place_id,
          commonCols.name,
          attrs.complex_number ?? null,
          commonCols.location_text,
          commonCols.description,
          toIntMaybe(attrs.floors_count),
          housesPerFloorParam,
        ]
      );
      return;
    }

    case 'مجمّع تجاري': {
      const storesPerFloor = parseJsonMaybe(attrs.stores_per_floor);
      const storesPerFloorParam = storesPerFloor != null ? JSON.stringify(storesPerFloor) : null;
      await pool.query(
        `
          INSERT INTO commercial_complex_details (
            place_id, name, complex_number, location_text, description, floors_count, stores_per_floor
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (place_id) DO UPDATE SET
            name = EXCLUDED.name,
            complex_number = EXCLUDED.complex_number,
            location_text = EXCLUDED.location_text,
            description = EXCLUDED.description,
            floors_count = EXCLUDED.floors_count,
            stores_per_floor = EXCLUDED.stores_per_floor
        `,
        [
          commonCols.place_id,
          commonCols.name,
          attrs.complex_number ?? null,
          commonCols.location_text,
          commonCols.description,
          toIntMaybe(attrs.floors_count),
          storesPerFloorParam,
        ]
      );
      return;
    }

    default: {
      await pool.query(
        `
          INSERT INTO other_place_details (place_id, name, location_text, description)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (place_id) DO UPDATE SET
            name = EXCLUDED.name,
            location_text = EXCLUDED.location_text,
            description = EXCLUDED.description
        `,
        [commonCols.place_id, commonCols.name, commonCols.location_text, commonCols.description]
      );
      return;
    }
  }
}

async function syncLegacyStoreFromPlace(placeId) {
  const ctx = await getPlaceContext(placeId);
  if (!ctx) return;
  const { place, attrs, images } = ctx;

  const typeName = place.type_name;
  const isStoreType = typeName === 'متجر تجاري' || typeName === 'مجمّع تجاري';
  const isActive = String(place.status || '').toLowerCase() === 'active';

  if (!isStoreType || !isActive) {
    await pool.query('DELETE FROM stores WHERE id = $1', [placeId]);
    return;
  }

  const { rows: catRows } = await pool.query(
    'SELECT id FROM categories WHERE name = $1 LIMIT 1',
    [typeName]
  );
  const categoryId = catRows[0]?.id ?? null;

  const photos = (images || []).map((img) => img.image_url);
  const phone = attrs.phone ?? null;
  const description = place.description ?? '';

  await pool.query(
    `
      INSERT INTO stores (
        id, name, description, category_id,
        latitude, longitude, phone, photos, videos,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category_id = EXCLUDED.category_id,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        phone = EXCLUDED.phone,
        photos = EXCLUDED.photos,
        videos = EXCLUDED.videos
    `,
    [
      place.id,
      place.name,
      description,
      categoryId,
      Number(place.latitude ?? 0),
      Number(place.longitude ?? 0),
      phone,
      JSON.stringify(photos || []),
      JSON.stringify([]),
      place.created_at ?? new Date().toISOString(),
    ]
  );
}

async function syncTypedDetailsAndLegacyStore(placeId) {
  await upsertTypedDetails(placeId);
  await syncLegacyStoreFromPlace(placeId);
}
