import { placeTypesService } from './placeTypes.service.js';
import { success } from '../../utils/response.js';

export const placeTypesController = {
  async getAll(_req, res, next) {
    try {
      const types = await placeTypesService.getAll();
      return success(res, types);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const type = await placeTypesService.create(req.validated);
      return success(res, type, 201);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const type = await placeTypesService.update(req.params.id, req.validated);
      return success(res, type);
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      await placeTypesService.remove(req.params.id);
      return success(res, { message: 'تم حذف نوع المكان' });
    } catch (err) { next(err); }
  },

  async getAttributeDefinitions(req, res, next) {
    try {
      const defs = await placeTypesService.getAttributeDefinitions(req.params.id);
      return success(res, defs);
    } catch (err) { next(err); }
  },

  async addAttributeDefinition(req, res, next) {
    try {
      const def = await placeTypesService.addAttributeDefinition(req.params.id, req.validated);
      return success(res, def, 201);
    } catch (err) { next(err); }
  },
};
