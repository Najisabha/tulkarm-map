import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { USE_API } from '../api/config';

export interface Store {
  id: string;
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  phone?: string;
  photos?: string[];
  videos?: string[];
  createdAt: string;
}

export interface PlaceRequest {
  id: string;
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  phone?: string;
  photos?: string[];
  videos?: string[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

const PLACE_REQUESTS_KEY = 'place_requests';
const LEGACY_SEED_IDS = new Set(['store-001', 'store-002', 'store-003']);
const LEGACY_SEED_CLEARED_KEY = 'stores_legacy_seed_cleared';

interface StoreContextType {
  stores: Store[];
  placeRequests: PlaceRequest[];
  addStore: (store: Omit<Store, 'id' | 'createdAt'>) => Promise<void>;
  updateStore: (id: string, updates: Partial<Omit<Store, 'id' | 'createdAt'>>) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
  updateStoresCategory: (oldName: string, newName: string) => Promise<void>;
  updatePlaceRequestsCategory: (oldName: string, newName: string) => Promise<void>;
  addPlaceRequest: (req: Omit<PlaceRequest, 'id' | 'status' | 'createdAt'>) => Promise<void>;
  updatePlaceRequest: (id: string, updates: Partial<Omit<PlaceRequest, 'id' | 'createdAt'>>) => Promise<void>;
  acceptPlaceRequest: (id: string, overrides?: Partial<Omit<Store, 'id' | 'createdAt'>>) => Promise<void>;
  rejectPlaceRequest: (id: string) => Promise<void>;
  deletePlaceRequest: (id: string) => Promise<void>;
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [placeRequests, setPlaceRequests] = useState<PlaceRequest[]>([]);

  useEffect(() => {
    loadStores();
    loadPlaceRequests();
  }, []);

  const loadPlaceRequests = async () => {
    try {
      if (USE_API) {
        const list = await api.getPlaceRequests();
        setPlaceRequests(list as PlaceRequest[]);
        return;
      }
      const json = await AsyncStorage.getItem(PLACE_REQUESTS_KEY);
      setPlaceRequests(json ? JSON.parse(json) : []);
    } catch {
      setPlaceRequests([]);
    }
  };

  const loadStores = async () => {
    try {
      if (USE_API) {
        const list = await api.getStores();
        setStores(list);
        return;
      }
      const storesJson = await AsyncStorage.getItem('stores');
      if (storesJson) {
        let list: Store[] = JSON.parse(storesJson);
        const seedCleared = await AsyncStorage.getItem(LEGACY_SEED_CLEARED_KEY);
        if (!seedCleared) {
          const next = list.filter((s) => !LEGACY_SEED_IDS.has(s.id));
          if (next.length !== list.length) {
            await AsyncStorage.setItem('stores', JSON.stringify(next));
          }
          await AsyncStorage.setItem(LEGACY_SEED_CLEARED_KEY, '1');
          list = next;
        }
        setStores(list);
      } else {
        await AsyncStorage.setItem('stores', JSON.stringify([]));
        await AsyncStorage.setItem(LEGACY_SEED_CLEARED_KEY, '1');
        setStores([]);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      setStores([]);
    }
  };

  const addStore = async (storeData: Omit<Store, 'id' | 'createdAt'>) => {
    if (USE_API) {
      const newStore = await api.addStore(storeData);
      setStores((prev) => [newStore as Store, ...prev]);
      return;
    }
    const newStore: Store = {
      ...storeData,
      id: `store-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updatedStores = [...stores, newStore];
    await AsyncStorage.setItem('stores', JSON.stringify(updatedStores));
    setStores(updatedStores);
  };

  const updateStore = async (id: string, updates: Partial<Omit<Store, 'id' | 'createdAt'>>) => {
    if (USE_API) {
      const updated = await api.updateStore(id, updates);
      setStores((prev) => prev.map((s) => (s.id === id ? (updated as Store) : s)));
      return;
    }
    const updated = stores.map((s) => (s.id === id ? { ...s, ...updates } : s));
    await AsyncStorage.setItem('stores', JSON.stringify(updated));
    setStores(updated);
  };

  const deleteStore = async (id: string) => {
    if (USE_API) {
      await api.deleteStore(id);
      setStores((prev) => prev.filter((s) => s.id !== id));
      return;
    }
    const updatedStores = stores.filter((s) => s.id !== id);
    await AsyncStorage.setItem('stores', JSON.stringify(updatedStores));
    setStores(updatedStores);
  };

  const updateStoresCategory = async (oldName: string, newName: string) => {
    if (USE_API) {
      await api.updateStoresCategory(oldName, newName);
      setStores((prev) =>
        prev.map((s) => (s.category === oldName ? { ...s, category: newName } : s))
      );
      return;
    }
    const updated = stores.map((s) =>
      s.category === oldName ? { ...s, category: newName } : s
    );
    await AsyncStorage.setItem('stores', JSON.stringify(updated));
    setStores(updated);
  };

  const updatePlaceRequestsCategory = async (oldName: string, newName: string) => {
    if (USE_API) {
      await api.updatePlaceRequestsCategory(oldName, newName);
      setPlaceRequests((prev) =>
        prev.map((r) => (r.category === oldName ? { ...r, category: newName } : r))
      );
      return;
    }
    const updated = placeRequests.map((r) =>
      r.category === oldName ? { ...r, category: newName } : r
    );
    await AsyncStorage.setItem(PLACE_REQUESTS_KEY, JSON.stringify(updated));
    setPlaceRequests(updated);
  };

  const refreshStores = async () => {
    await loadStores();
  };

  const addPlaceRequest = async (req: Omit<PlaceRequest, 'id' | 'status' | 'createdAt'>) => {
    if (USE_API) {
      const newReq = await api.addPlaceRequest(req);
      setPlaceRequests((prev) => [newReq as PlaceRequest, ...prev]);
      return;
    }
    const newReq: PlaceRequest = {
      ...req,
      id: `pr-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const updated = [...placeRequests, newReq];
    await AsyncStorage.setItem(PLACE_REQUESTS_KEY, JSON.stringify(updated));
    setPlaceRequests(updated);
  };

  const acceptPlaceRequest = async (id: string, overrides?: Partial<Omit<Store, 'id' | 'createdAt'>>) => {
    if (USE_API) {
      await api.acceptPlaceRequest(id, overrides);
      setPlaceRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'accepted' as const } : r))
      );
      await loadStores();
      return;
    }
    const req = placeRequests.find((r) => r.id === id);
    if (!req) return;
    await addStore({
      name: overrides?.name ?? req.name,
      description: overrides?.description ?? req.description,
      category: overrides?.category ?? req.category,
      phone: overrides?.phone ?? req.phone,
      latitude: overrides?.latitude ?? req.latitude,
      longitude: overrides?.longitude ?? req.longitude,
      photos: overrides?.photos ?? req.photos,
      videos: overrides?.videos ?? req.videos,
    });
    const updated = placeRequests.map((r) =>
      r.id === id ? { ...r, status: 'accepted' as const } : r
    );
    await AsyncStorage.setItem(PLACE_REQUESTS_KEY, JSON.stringify(updated));
    setPlaceRequests(updated);
  };

  const rejectPlaceRequest = async (id: string) => {
    if (USE_API) {
      await api.rejectPlaceRequest(id);
      setPlaceRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r))
      );
      return;
    }
    const updated = placeRequests.map((r) =>
      r.id === id ? { ...r, status: 'rejected' as const } : r
    );
    await AsyncStorage.setItem(PLACE_REQUESTS_KEY, JSON.stringify(updated));
    setPlaceRequests(updated);
  };

  const updatePlaceRequest = async (id: string, updates: Partial<Omit<PlaceRequest, 'id' | 'createdAt'>>) => {
    if (USE_API) {
      const updated = await api.updatePlaceRequest(id, updates);
      setPlaceRequests((prev) =>
        prev.map((r) => (r.id === id ? (updated as PlaceRequest) : r))
      );
      return;
    }
    const updated = placeRequests.map((r) => (r.id === id ? { ...r, ...updates } : r));
    await AsyncStorage.setItem(PLACE_REQUESTS_KEY, JSON.stringify(updated));
    setPlaceRequests(updated);
  };

  const deletePlaceRequest = async (id: string) => {
    if (USE_API) {
      await api.deletePlaceRequest(id);
      setPlaceRequests((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    const updated = placeRequests.filter((r) => r.id !== id);
    await AsyncStorage.setItem(PLACE_REQUESTS_KEY, JSON.stringify(updated));
    setPlaceRequests(updated);
  };

  return (
    <StoreContext.Provider
      value={{
        stores,
        placeRequests,
        addStore,
        updateStore,
        deleteStore,
        updateStoresCategory,
        updatePlaceRequestsCategory,
        addPlaceRequest,
        updatePlaceRequest,
        acceptPlaceRequest,
        rejectPlaceRequest,
        deletePlaceRequest,
        refreshStores,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStores() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStores must be used within StoreProvider');
  return context;
}
