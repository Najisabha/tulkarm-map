import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { USE_API } from '../api/config';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

const CATEGORIES_KEY = 'categories';

interface CategoryContextType {
  categories: Category[];
  addCategory: (cat: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<{ success: boolean; message?: string }>;
  getCategoryByName: (name: string) => Category | undefined;
}

const CategoryContext = createContext<CategoryContextType | null>(null);

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      if (USE_API) {
        const list = await api.getCategories();
        setCategories(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            emoji: c.emoji,
            color: c.color,
          }))
        );
        return;
      }
      const json = await AsyncStorage.getItem(CATEGORIES_KEY);
      if (json) {
        const list = JSON.parse(json);
        if (Array.isArray(list) && list.length > 0) {
          setCategories(list);
        }
      }
    } catch {
      setCategories([]);
    }
  };

  const saveCategories = async (list: Category[]) => {
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(list));
    setCategories(list);
  };

  const addCategory = async (cat: Omit<Category, 'id'>) => {
    if (USE_API) {
      const newCat = await api.addCategory({
        name: cat.name,
        emoji: cat.emoji,
        color: cat.color,
      });
      setCategories((prev) => [
        ...prev,
        { id: newCat.id, name: newCat.name, emoji: newCat.emoji, color: newCat.color },
      ]);
      return;
    }
    const newCat: Category = {
      ...cat,
      id: `cat-${Date.now()}`,
    };
    await saveCategories([...categories, newCat]);
  };

  const updateCategory = async (id: string, updates: Partial<Omit<Category, 'id'>>) => {
    if (USE_API) {
      const updated = await api.updateCategory(id, updates) as Category;
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
      );
      return;
    }
    const list = categories.map((c) => (c.id === id ? { ...c, ...updates } : c));
    await saveCategories(list);
  };

  const deleteCategory = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return { success: false, message: 'الفئة غير موجودة' };
    if (categories.length <= 1) {
      return { success: false, message: 'يجب وجود فئة واحدة على الأقل' };
    }
    if (USE_API) {
      try {
        await api.deleteCategory(id);
        setCategories((prev) => prev.filter((c) => c.id !== id));
        return { success: true };
      } catch (e: any) {
        return { success: false, message: e?.message };
      }
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
