import { placesRepo } from './places.repository.js';
import { placeTypesRepo } from '../placeTypes/placeTypes.repository.js';
import { ApiError } from '../../utils/ApiError.js';

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
