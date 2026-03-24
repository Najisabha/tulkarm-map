import { placeTypesRepo } from './placeTypes.repository.js';
import { ApiError } from '../../utils/ApiError.js';

export const placeTypesService = {
  async getAll() {
    return placeTypesRepo.findAll();
  },

  async create(data) {
    const { name } = data;
    const emoji = data.emoji ?? null;
    const color = data.color ?? null;
    const existing = await placeTypesRepo.findByName(name);
    if (existing) throw ApiError.conflict('نوع المكان موجود مسبقاً');
    return placeTypesRepo.create(name, emoji, color);
  },

  async update(id, payload) {
    const type = await placeTypesRepo.findById(id);
    if (!type) throw ApiError.notFound('نوع المكان غير موجود');
    const nextName = payload.name !== undefined ? payload.name : type.name;
    if (payload.name !== undefined && payload.name !== type.name) {
      const existing = await placeTypesRepo.findByName(nextName);
      if (existing && existing.id !== id) throw ApiError.conflict('هذا الاسم مستخدم مسبقاً');
    }
    return placeTypesRepo.update(id, {
      name: payload.name,
      emoji: payload.emoji,
      color: payload.color,
    });
  },

  async remove(id) {
    const type = await placeTypesRepo.findById(id);
    if (!type) throw ApiError.notFound('نوع المكان غير موجود');
    const hasPlaces = await placeTypesRepo.hasPlaces(id);
    if (hasPlaces) throw ApiError.conflict('لا يمكن حذف نوع مرتبط بأماكن موجودة. احذف الأماكن أولاً أو انقلها لنوع آخر.');
    return placeTypesRepo.remove(id);
  },

  async getAttributeDefinitions(typeId) {
    const type = await placeTypesRepo.findById(typeId);
    if (!type) throw ApiError.notFound('نوع المكان غير موجود');
    return placeTypesRepo.getAttributeDefinitions(typeId);
  },

  async addAttributeDefinition(typeId, data) {
    const type = await placeTypesRepo.findById(typeId);
    if (!type) throw ApiError.notFound('نوع المكان غير موجود');
    return placeTypesRepo.createAttributeDefinition(typeId, data);
  },
};
