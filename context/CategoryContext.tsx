import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, PlaceType } from '../api/client';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

function typeToCategory(pt: PlaceType): Category {
  return {
    id: pt.id,
    name: pt.name,
    emoji: pt.emoji && String(pt.emoji).trim() !== '' ? String(pt.emoji) : '\u{1F4CD}',
    color: pt.color && String(pt.color).trim() !== '' ? String(pt.color) : '#2E86AB',
  };
}

interface CategoryContextType {
  categories: Category[];
  loading: boolean;
  addCategory: (cat: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<{ success: boolean; message?: string }>;
  getCategoryByName: (name: string) => Category | undefined;
  refreshCategories: () => Promise<void>;
}

const CategoryContext = createContext<CategoryContextType | null>(null);

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await api.getPlaceTypes();
      const raw = (res as any)?.data ?? res;
      const list = Array.isArray(raw) ? raw : [];
      setCategories(list.map((row: PlaceType) => typeToCategory(row)));
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (cat: Omit<Category, 'id'>) => {
    const res = await api.createPlaceType(cat.name, { emoji: cat.emoji, color: cat.color });
    if (res?.data) {
      setCategories((prev) => [...prev, typeToCategory(res.data)]);
    }
  };

  const updateCategory = async (id: string, updates: Partial<Omit<Category, 'id'>>) => {
    const prev = categories.find((c) => c.id === id);
    if (!prev) return;

    const nextName = updates.name !== undefined ? updates.name.trim() : prev.name;
    const nextEmoji = updates.emoji !== undefined ? updates.emoji : prev.emoji;
    const nextColor = updates.color !== undefined ? updates.color : prev.color;

    const nameChanged = updates.name !== undefined && nextName !== prev.name;
    const emojiChanged = updates.emoji !== undefined && nextEmoji !== prev.emoji;
    const colorChanged = updates.color !== undefined && nextColor !== prev.color;

    if (!nameChanged && !emojiChanged && !colorChanged) return;

    const patch: { name?: string; emoji?: string; color?: string } = {};
    if (nameChanged) patch.name = nextName;
    if (emojiChanged) patch.emoji = nextEmoji;
    if (colorChanged) patch.color = nextColor;

    try {
      const res = await api.updatePlaceType(id, patch);
      if (res?.data) {
        setCategories((prevList) =>
          prevList.map((c) => (c.id === id ? typeToCategory(res.data as PlaceType) : c))
        );
      } else {
        setCategories((prevList) =>
          prevList.map((c) => (c.id === id ? { ...c, name: nextName, emoji: nextEmoji, color: nextColor } : c))
        );
      }
    } catch {
      setCategories((prevList) =>
        prevList.map((c) => (c.id === id ? { ...c, name: nextName, emoji: nextEmoji, color: nextColor } : c))
      );
    }
  };

  const deleteCategory = async (id: string) => {
    if (categories.length <= 1) {
      return { success: false, message: '\u064A\u062C\u0628 \u0648\u062C\u0648\u062F \u0646\u0648\u0639 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644' };
    }
    try {
      await api.deletePlaceType(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message };
    }
  };

  const getCategoryByName = (name: string) =>
    categories.find((c) => c.name === name);

  const refreshCategories = async () => {
    await loadCategories();
  };

  return (
    <CategoryContext.Provider
      value={{
        categories,
        loading,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryByName,
        refreshCategories,
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
