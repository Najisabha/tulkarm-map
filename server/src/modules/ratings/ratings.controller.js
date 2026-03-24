import { ratingsService } from './ratings.service.js';
import { success, paginated } from '../../utils/response.js';

export const ratingsController = {
  async create(req, res, next) {
    try {
      const rating = await ratingsService.create(req.validated, req.user.id);
      return success(res, rating, 201);
    } catch (err) { next(err); }
  },

  async getByPlace(req, res, next) {
    try {
      const result = await ratingsService.getByPlace(req.params.placeId, req.validatedQuery);
      return paginated(res, result);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const rating = await ratingsService.update(req.params.id, req.validated, req.user.id);
      return success(res, rating);
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      await ratingsService.remove(req.params.id, req.user);
      return success(res, { message: 'تم حذف التقييم' });
    } catch (err) { next(err); }
  },
};
