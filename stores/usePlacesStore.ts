/**
 * usePlacesStore — Zustand store لإدارة قائمة الأماكن.
 * يستهلكه المكوّنات الجديدة مباشرةً. StoreContext الموجود يبقى
 * للشاشات القديمة دون تغيير.
 */

import { create } from 'zustand';
import { placeService } from '../services/placeService';
import { Place, CreatePlacePayload, ComplexType, PlaceAttribute } from '../types/place';
import { api } from '../api/client';

interface PlacesState {
  places: Place[];
  loading: boolean;
  error: string | null;
  lastFetchedAsAdmin: boolean | null;

  loadAll: (isAdmin?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  getById: (id: string) => Place | undefined;
  deletePlace: (id: string) => Promise<void>;
  createPlace: (form: {
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
  }) => Promise<Place>;
  clearError: () => void;
}

export const usePlacesStore = create<PlacesState>((set, get) => ({
  places: [],
  loading: false,
  error: null,
  lastFetchedAsAdmin: null,

  loadAll: async (isAdmin = false) => {
    set({ loading: true, error: null });
    try {
      const places = await placeService.getAll(isAdmin);
      set({ places, loading: false, lastFetchedAsAdmin: isAdmin });
    } catch (err: any) {
      set({ loading: false, error: err?.message || 'فشل تحميل الأماكن' });
    }
  },

  refresh: async () => {
    const { lastFetchedAsAdmin } = get();
    await get().loadAll(lastFetchedAsAdmin ?? false);
  },

  getById: (id) => get().places.find((p) => p.id === id),

  deletePlace: async (id) => {
    await api.deletePlace(id);
    set({ places: get().places.filter((p) => p.id !== id) });
  },

  createPlace: async (form) => {
    const place = await placeService.create(form);
    set({ places: [place, ...get().places] });
    return place;
  },

  clearError: () => set({ error: null }),
}));
