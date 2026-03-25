import { placeTypesService } from './placeTypes.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { success } from '../../utils/response.js';

const CANONICAL_PLACE_TYPES = [
  { name: 'منزل' },
  { name: 'متجر تجاري' },
  { name: 'مجمّع سكني' },
  { name: 'مجمّع تجاري' },
  { name: 'أخرى' },
];

function isCanonicalTypeName(name) {
  if (!name) return false;
  return CANONICAL_PLACE_TYPES.some((t) => t.name === name);
}

export const placeTypesController = {
  async getAll(_req, res, next) {
    try {
      const types = await placeTypesService.getAll();
      const canonicalNames = CANONICAL_PLACE_TYPES.map((t) => t.name);
      return success(res, types.filter((t) => canonicalNames.includes(t.name)));
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      if (!req.validated?.name || !isCanonicalTypeName(req.validated.name)) {
        throw ApiError.forbidden('لا يمكن إنشاء نوع مكان إلا للأنواع الثابتة');
      }
      const type = await placeTypesService.create(req.validated);
      return success(res, type, 201);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const typeId = req.params?.id;
      const existing = await placeTypesService.getById(typeId);
      if (!existing) throw ApiError.notFound('نوع المكان غير موجود');

      // منع تغيير الاسم إلى غير ثابت (حتى لو كان المدير).
      if (req.validated?.name !== undefined && !isCanonicalTypeName(req.validated.name)) {
        throw ApiError.forbidden('لا يمكن تعديل نوع المكان إلا للأنواع الثابتة');
      }

      const type = await placeTypesService.update(req.params.id, req.validated);
      return success(res, type);
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      throw ApiError.forbidden('لا يمكن حذف الأنواع الثابتة');
      await placeTypesService.remove(req.params.id);
      return success(res, { message: 'تم حذف نوع المكان' });
    } catch (err) { next(err); }
  },

  async getAttributeDefinitions(req, res, next) {
    try {
      const existingType = await placeTypesService.getById(req.params.id);
      if (!existingType || !isCanonicalTypeName(existingType.name)) {
        throw ApiError.forbidden('لا يمكن الوصول لتعريفات هذا النوع');
      }
      const defs = await placeTypesService.getAttributeDefinitions(req.params.id);
      return success(res, defs);
    } catch (err) { next(err); }
  },

  async addAttributeDefinition(req, res, next) {
    try {
      const existingType = await placeTypesService.getById(req.params.id);
      if (!existingType || !isCanonicalTypeName(existingType.name)) {
        throw ApiError.forbidden('لا يمكن إضافة تعريفات إلا للأنواع الثابتة');
      }
      const def = await placeTypesService.addAttributeDefinition(req.params.id, req.validated);
      return success(res, def, 201);
    } catch (err) { next(err); }
  },
};
