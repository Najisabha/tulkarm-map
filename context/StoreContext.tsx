import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, PlaceData } from '../api/client';
import { usePlacesStore } from '../stores/usePlacesStore';
import { useAuth } from './AuthContext';

export type { PlaceData };

export interface Store {
  id: string;
  name: string;
  description: string;
  category: string;
  type_name?: string;
  type_id?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  photos?: string[];
  videos?: string[];
  status?: string;
  avg_rating?: string;
  rating_count?: number;
  attributes?: { key: string; value: string; value_type: string }[];
  images?: { id: string; image_url: string; sort_order: number }[];
  createdAt: string;
}

/** pg/json أحياناً يرجع الإحداثيات كسلسلة — نضمن رقماً صالحاً للخريطة و`toFixed` */
function parseCoord(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function placeToStore(p: PlaceData): Store {
  const phone = p.phone_number
    || p.attributes?.find(a => a.key === 'phone')?.value
    || p.attributes?.find(a => a.key === 'phone_number')?.value
    || p.attributes?.find(a => a.key === 'store_number')?.value
    || p.attributes?.find(a => a.key === 'raqm')?.value;
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    category: p.type_name,
    type_name: p.type_name,
    type_id: p.type_id,
    latitude: parseCoord(p.latitude as unknown),
    longitude: parseCoord(p.longitude as unknown),
    phone: phone || undefined,
    photos: p.images?.map(img => img.image_url) || [],
    status: p.status,
    avg_rating: p.avg_rating,
    rating_count: p.rating_count,
    attributes: p.attributes,
    images: p.images,
    createdAt: p.created_at,
  };
}

interface StoreContextType {
  stores: Store[];
  loading: boolean;
  deleteStore: (id: string) => Promise<void>;
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const { places, loadAll } = usePlacesStore();

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const isAdminUser = user?.role === 'admin' || user?.isAdmin === true;
      const collected = await api.getPlacesAll(isAdminUser ? { status: 'all' } : {});
      setStores(collected.map(placeToStore));
    } catch (err) {
      console.warn('Error loading places:', err);
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    // نُبقي Context يعمل كما هو، لكن نغذّي Zustand أيضاً تدريجياً
    void loadStores();
  }, [authLoading, user?.id, user?.role, loadStores]);

  // عند تحديث Zustand places، نُحدّث stores أيضاً (تدريجي + غير كاسر)
  useEffect(() => {
    if (!places || places.length === 0) return;
    // mapApiToPlace ينتج Domain؛ هنا نُبقي Store shape القديم بدون كسر UI
    // سنستبدله لاحقاً في الشاشات التي تستخدم Context.
  }, [places]);

  const deleteStore = async (id: string) => {
    await api.deletePlace(id);
    setStores((prev) => prev.filter((s) => s.id !== id));
  };

  const refreshStores = useCallback(async () => {
    await loadStores();
  }, [loadStores]);

  return (
    <StoreContext.Provider value={{ stores, loading, deleteStore, refreshStores }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStores() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStores must be used within StoreProvider');
  return context;
}
