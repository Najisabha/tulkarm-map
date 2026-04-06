import { placesRepo } from './places.repository.js';
import { placeTypesRepo } from '../placeTypes/placeTypes.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import pool from '../../config/db.js';
import { assertWithinTulkarmGovernorate } from '../../lib/tulkarmGovernorate.js';

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

function readPhoneFromAttributesJson(attributes) {
  if (!attributes || typeof attributes !== 'object') return null;
  const raw = attributes.phone;
  if (raw == null) return null;
  if (typeof raw === 'object' && raw !== null && 'v' in raw) {
    const s = String(raw.v ?? '').trim();
    return s || null;
  }
  const s = String(raw).trim();
  return s || null;
}

async function syncStoreDetailsFromPlace(placeId) {
  const { rows } = await pool.query(
    `SELECT p.phone_number, p.attributes FROM places p WHERE p.id = $1`,
    [placeId]
  );
  const row = rows[0];
  if (!row) return;

  // يعطي الأولوية لـ phone_number المباشر ثم attributes كـ fallback
  const phone = row.phone_number || readPhoneFromAttributesJson(row.attributes);
  await pool.query(
    `INSERT INTO store_details (place_id, phone) VALUES ($1, $2)
     ON CONFLICT (place_id) DO UPDATE SET phone = EXCLUDED.phone`,
    [placeId, phone]
  );
}

/** هل النوع يستدعي إنشاء سجل في complexes؟ */
function isComplexType(typeName) {
  const n = String(typeName ?? '').trim();
  return n === 'مجمّع سكني' || n === 'مجمع سكني' ||
         n === 'مجمّع تجاري' || n === 'مجمع تجاري';
}

export const placesService = {
  /**
   * @param {object} options
   * @param {boolean} [options.publishDirectly] — من `/api/places/from-admin` فقط.
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

    assertWithinTulkarmGovernorate(data.latitude, data.longitude);

    const place = await placesRepo.create({
      name: data.name,
      description: data.description,
      typeId: data.type_id,
      createdBy,
      status,
      phoneNumber: data.phone_number,
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

    // إنشاء سجل مجمع إذا كان النوع مجمع أو تم تمرير complex_kind
    const complexKind = data.complex_kind ||
      (isComplexType(typeRow.name) ? (typeRow.name.includes('سكني') ? 'residential' : 'commercial') : null);

    if (complexKind) {
      const complex = await placesRepo.upsertComplex({
        placeId: place.id,
        complexType: complexKind,
        floorsCount: data.floors_count || 1,
        unitsPerFloor: data.units_per_floor || 1,
      });

      // إنشاء وحدات المجمع تلقائياً (idempotent)
      const floorsCount = data.floors_count || 1;
      const unitsPerFloor = data.units_per_floor || 1;
      const insertValues = [];
      const params = [complex.id];
      let i = 2;
      for (let floor = 1; floor <= floorsCount; floor++) {
        for (let u = 1; u <= unitsPerFloor; u++) {
          insertValues.push(`($1, $${i++}, $${i++})`);
          params.push(floor, String(u));
        }
      }
      if (insertValues.length > 0) {
        await pool.query(
          `INSERT INTO complex_units (complex_id, floor_number, unit_number)
           VALUES ${insertValues.join(', ')}
           ON CONFLICT (complex_id, floor_number, unit_number) DO NOTHING`,
          params
        );
      }
    }

    // ربط التصنيفات إذا أُرسلت
    if (data.main_category_id || data.sub_category_id) {
      await placesRepo.upsertCategoryLink({
        placeId: place.id,
        mainCategoryId: data.main_category_id,
        subCategoryId: data.sub_category_id,
      });
    }

    await syncStoreDetailsFromPlace(place.id);

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

    if (user.role === 'admin' && data.status === 'rejected') {
      const st = String(place.status || '').toLowerCase();
      if (st === 'pending') {
        await placesRepo.hardDelete(id);
        return null;
      }
      throw ApiError.badRequest(
        'حالة «مرفوض» تُطبَّق على طلبات قيد الانتظار فقط. لإزالة مكان منشور استخدم حذف المكان.'
      );
    }

    await placesRepo.update(id, {
      name: data.name,
      description: data.description,
      typeId: data.type_id,
      status: data.status,
      phoneNumber: data.phone_number,
    });

    if (data.latitude != null && data.longitude != null) {
      assertWithinTulkarmGovernorate(data.latitude, data.longitude);
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

    // تحديث بيانات المجمع إن أُرسلت
    if (data.floors_count != null || data.units_per_floor != null) {
      const existing = await placesRepo.findComplexByPlaceId(id);
      if (existing) {
        await placesRepo.upsertComplex({
          placeId: id,
          complexType: existing.complex_type,
          floorsCount: data.floors_count ?? existing.floors_count,
          unitsPerFloor: data.units_per_floor ?? existing.units_per_floor,
        });
      }
    }

    // تحديث روابط التصنيفات
    if (data.main_category_id !== undefined || data.sub_category_id !== undefined) {
      const existing = await placesRepo.findCategoryLink(id);
      await placesRepo.upsertCategoryLink({
        placeId: id,
        mainCategoryId: data.main_category_id ?? existing?.main_category_id ?? null,
        subCategoryId: data.sub_category_id ?? existing?.sub_category_id ?? null,
      });
    }

    await syncStoreDetailsFromPlace(id);

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
      return placesRepo.hardDelete(id);
    }
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
