import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

const CATEGORIES_KEY = 'categories';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'تسوق', emoji: '🛍️', color: '#F59E0B' },
  { id: 'cat-2', name: 'مطاعم', emoji: '🍽️', color: '#EF4444' },
  { id: 'cat-3', name: 'صحة', emoji: '💊', color: '#10B981' },
  { id: 'cat-4', name: 'خدمات', emoji: '🔧', color: '#8B5CF6' },
  { id: 'cat-5', name: 'ترفيه', emoji: '🎭', color: '#EC4899' },
  { id: 'cat-6', name: 'تعليم', emoji: '📚', color: '#3B82F6' },
];

interface CategoryContextType {
  categories: Category[];
  addCategory: (cat: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<{ success: boolean; message?: string }>;
  getCategoryByName: (name: string) => Category | undefined;
}

const CategoryContext = createContext<CategoryContextType | null>(null);

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const json = await AsyncStorage.getItem(CATEGORIES_KEY);
      if (json) {
        const list = JSON.parse(json);
        if (Array.isArray(list) && list.length > 0) {
          setCategories(list);
        }
      }
    } catch {
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const saveCategories = async (list: Category[]) => {
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(list));
    setCategories(list);
  };

  const addCategory = async (cat: Omit<Category, 'id'>) => {
    const newCat: Category = {
      ...cat,
      id: `cat-${Date.now()}`,
    };
    await saveCategories([...categories, newCat]);
  };

  const updateCategory = async (id: string, updates: Partial<Omit<Category, 'id'>>) => {
    const list = categories.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    );
    await saveCategories(list);
  };

  const deleteCategory = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return { success: false, message: 'الفئة غير موجودة' };
    if (categories.length <= 1) {
      return { success: false, message: 'يجب وجود فئة واحدة على الأقل' };
    }
    await saveCategories(categories.filter((c) => c.id !== id));
    return { success: true };
  };

  const getCategoryByName = (name: string) =>
    categories.find((c) => c.name === name);

  return (
    <CategoryContext.Provider
      value={{
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryByName,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoryContext);
  if (!ctx) throw new Error('useCategories must be used within CategoryProvider');
  return ctx;
}
