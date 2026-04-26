import { placeTypesService } from './placeTypes.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { success } from '../../utils/response.js';

export const placeTypesController = {
  async getAll(_req, res, next) {
    try {
      const types = await placeTypesService.getAll();
      return success(res, types);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const type = await placeTypesService.create(req.validated);
      return success(res, type, 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const typeId = req.params?.id;
      const existing = await placeTypesService.getById(typeId);
      if (!existing) throw ApiError.notFound('نوع المكان غير موجود');

      const type = await placeTypesService.update(req.params.id, req.validated);
      return success(res, type);
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const existing = await placeTypesService.getById(req.params.id);
      if (!existing) throw ApiError.notFound('نوع المكان غير موجود');
      await placeTypesService.remove(req.params.id);
      return success(res, { message: 'تم حذف نوع المكان' });
    } catch (err) {
      next(err);
    }
  },

  async getAttributeDefinitions(req, res, next) {
    try {
      const existingType = await placeTypesService.getById(req.params.id);
      if (!existingType) throw ApiError.notFound('نوع المكان غير موجود');
      const defs = await placeTypesService.getAttributeDefinitions(req.params.id);
      return success(res, defs);
    } catch (err) {
      next(err);
    }
  },

  async addAttributeDefinition(req, res, next) {
    try {
      const existingType = await placeTypesService.getById(req.params.id);
      if (!existingType) throw ApiError.notFound('نوع المكان غير موجود');
      const def = await placeTypesService.addAttributeDefinition(req.params.id, req.validated);
      return success(res, def, 201);
    } catch (err) {
      next(err);
    }
  },

  async updateAttributeDefinition(req, res, next) {
    try {
      const existingType = await placeTypesService.getById(req.params.id);
      if (!existingType) throw ApiError.notFound('نوع المكان غير موجود');
      const def = await placeTypesService.updateAttributeDefinition(
        req.params.id,
        req.params.defId,
        req.validated
      );
      return success(res, def);
    } catch (err) {
      next(err);
    }
  },

  async removeAttributeDefinition(req, res, next) {
    try {
      const existingType = await placeTypesService.getById(req.params.id);
      if (!existingType) throw ApiError.notFound('نوع المكان غير موجود');
      await placeTypesService.removeAttributeDefinition(req.params.id, req.params.defId);
      return success(res, { message: 'تم حذف تعريف الخاصية' });
    } catch (err) {
      next(err);
    }
  },
};
