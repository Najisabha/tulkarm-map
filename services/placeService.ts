/**
 * placeService — طبقة وسيطة بين UI وapi/client.ts
 * تتحمّل مسؤولية التحويل بين PlaceData (API) و Place (Domain).
 */

import { api } from '../api/client';
import { mapApiToPlace, mapFormToPayload, Place, CreatePlacePayload, ComplexType, PlaceAttribute } from '../types/place';

export const placeService = {
  /** جلب جميع الأماكن (جميع الصفحات) */
  async getAll(isAdmin = false): Promise<Place[]> {
    const data = await api.getPlacesAll(isAdmin ? { status: 'all' } : {});
    return data.map(mapApiToPlace);
  },

  /** جلب مكان واحد بالمعرّف */
  async getById(id: string): Promise<Place> {
    const res = await api.getPlace(id);
    return mapApiToPlace(res.data);
  },

  /** إنشاء مكان جديد (طلب مراجعة) */
  async create(form: {
    name: string;
    description?: string;
    typeId: string;
    latitude: number;
    longitude: number;
    phoneNumber?: string;
    attributes?: PlaceAttribute[];
    imageUrls?: string[];
    complexKind?: ComplexType;
    floorsCount?: number;
    unitsPerFloor?: number;
  }): Promise<Place> {
    const payload = mapFormToPayload(form);
    const res = await api.createPlace(payload);
    return mapApiToPlace(res.data);
  },

  /** إنشاء مكان من لوحة الإدارة (نشر مباشر) */
  async createFromAdmin(form: {
    name: string;
    description?: string;
    typeId: string;
    latitude: number;
    longitude: number;
    phoneNumber?: string;
    attributes?: PlaceAttribute[];
    imageUrls?: string[];
    complexKind?: ComplexType;
    floorsCount?: number;
    unitsPerFloor?: number;
  }): Promise<Place> {
    const payload = mapFormToPayload(form);
    const res = await api.createPlaceFromAdmin(payload);
    return mapApiToPlace(res.data);
  },

  /** تحديث مكان */
  async update(id: string, data: Record<string, any>): Promise<Place> {
    const res = await api.updatePlace(id, data);
    return mapApiToPlace(res.data);
  },

  /** حذف مكان */
  async delete(id: string): Promise<void> {
    await api.deletePlace(id);
  },
};
