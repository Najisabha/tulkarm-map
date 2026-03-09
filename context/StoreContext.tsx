import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Store {
  id: string;
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  phone?: string;
  createdAt: string;
}

interface StoreContextType {
  stores: Store[];
  addStore: (store: Omit<Store, 'id' | 'createdAt'>) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

const DEFAULT_STORES: Store[] = [
  {
    id: 'store-001',
    name: 'سوق طولكرم المركزي',
    description: 'السوق الرئيسي في وسط المدينة',
    category: 'تسوق',
    latitude: 32.3104,
    longitude: 35.0288,
    phone: '09-2671234',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'store-002',
    name: 'مطعم فلسطين',
    description: 'أشهى المأكولات الفلسطينية الأصيلة',
    category: 'مطاعم',
    latitude: 32.3118,
    longitude: 35.0301,
    phone: '09-2675678',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'store-003',
    name: 'صيدلية الشفاء',
    description: 'صيدلية متكاملة على مدار الساعة',
    category: 'صحة',
    latitude: 32.3095,
    longitude: 35.0275,
    phone: '09-2679012',
    createdAt: new Date().toISOString(),
  },
];

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const storesJson = await AsyncStorage.getItem('stores');
      if (storesJson) {
        setStores(JSON.parse(storesJson));
      } else {
        await AsyncStorage.setItem('stores', JSON.stringify(DEFAULT_STORES));
        setStores(DEFAULT_STORES);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      setStores(DEFAULT_STORES);
    }
  };

  const addStore = async (storeData: Omit<Store, 'id' | 'createdAt'>) => {
    const newStore: Store = {
      ...storeData,
      id: `store-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updatedStores = [...stores, newStore];
    await AsyncStorage.setItem('stores', JSON.stringify(updatedStores));
    setStores(updatedStores);
  };

  const deleteStore = async (id: string) => {
    const updatedStores = stores.filter((s) => s.id !== id);
    await AsyncStorage.setItem('stores', JSON.stringify(updatedStores));
    setStores(updatedStores);
  };

  const refreshStores = async () => {
    await loadStores();
  };

  return (
    <StoreContext.Provider value={{ stores, addStore, deleteStore, refreshStores }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStores() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStores must be used within StoreProvider');
  return context;
}
