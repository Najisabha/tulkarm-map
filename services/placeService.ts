/**
 * placeService — طبقة وسيطة بين UI وapi/client.ts
 * تتحمّل مسؤولية التحويل بين PlaceData (API) و Place (Domain).
 */

import { api } from '../api/client';
import { ComplexType, mapApiToPlace, mapFormToPayload, Place, PlaceAttribute } from '../types/place';

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
    // If this is a complex, auto-generate its units (idempotent on the server).
    if (payload.complex_kind && payload.floors_count && payload.units_per_floor) {
      try {
        await api.generateComplexUnits(res.data.id, {
          floors_count: payload.floors_count,
          units_per_floor: payload.units_per_floor,
        });
      } catch {
        // Non-blocking: place creation succeeded; units can be generated later via admin.
      }
    }
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
    if (payload.complex_kind && payload.floors_count && payload.units_per_floor) {
      try {
        await api.generateComplexUnits(res.data.id, {
          floors_count: payload.floors_count,
          units_per_floor: payload.units_per_floor,
        });
      } catch {
        // Non-blocking
      }
    }
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

  // ── Complex helpers (optional callers) ────────────────────────────────────
  async getComplex(placeId: string): Promise<{ complex: any; units: any[] }> {
    const res = await api.getComplex(placeId);
    return res.data;
  },
  async generateUnits(placeId: string, floorsCount: number, unitsPerFloor: number): Promise<any[]> {
    const res = await api.generateComplexUnits(placeId, { floors_count: floorsCount, units_per_floor: unitsPerFloor });
    return res.data.units;
  },
  async linkUnitPlace(unitId: string, childPlaceId: string | null): Promise<any> {
    const res = await api.linkComplexUnitPlace(unitId, childPlaceId);
    return res.data;
  },
};
