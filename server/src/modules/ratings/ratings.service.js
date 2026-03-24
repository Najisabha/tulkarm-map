import { ratingsRepo } from './ratings.repository.js';
import { ApiError } from '../../utils/ApiError.js';

export const ratingsService = {
  async create({ place_id, rating, comment }, userId) {
    const existing = await ratingsRepo.findByPlaceAndUser(place_id, userId);
    if (existing) throw ApiError.conflict('لقد قمت بتقييم هذا المكان مسبقاً');

    return ratingsRepo.create({ placeId: place_id, userId, rating, comment });
  },

  async getByPlace(placeId, query) {
    return ratingsRepo.findByPlace(placeId, query);
  },

  async update(id, data, userId) {
    const existing = await ratingsRepo.findById(id);
    if (!existing) throw ApiError.notFound('التقييم غير موجود');
    if (existing.user_id !== userId) throw ApiError.forbidden('لا يمكنك تعديل هذا التقييم');

    return ratingsRepo.update(id, data);
  },

  async remove(id, user) {
    const existing = await ratingsRepo.findById(id);
    if (!existing) throw ApiError.notFound('التقييم غير موجود');
    if (user.role !== 'admin' && existing.user_id !== user.id) {
      throw ApiError.forbidden('لا يمكنك حذف هذا التقييم');
    }
    return ratingsRepo.softDelete(id);
  },
};
