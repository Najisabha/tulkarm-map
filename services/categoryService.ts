/**
 * categoryService — خدمة التصنيفات الرئيسية والفرعية للأماكن.
 */

import { api } from '../api/client';

export interface MainCategory {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

export interface SubCategory {
  id: string;
  mainCategoryId: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

export interface PlaceTypeItem {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

export const categoryService = {
  /** جلب أنواع الأماكن (place_types) */
  async getPlaceTypes(): Promise<PlaceTypeItem[]> {
    const res = await api.getPlaceTypes();
    const types = res.data ?? [];
    return types.map((t) => ({
      id: t.id,
      name: t.name,
      emoji: t.emoji ?? null,
      color: t.color ?? null,
    }));
  },

  /** جلب التصنيفات الرئيسية للمنتجات */
  async getMainCategories(): Promise<MainCategory[]> {
    const res = await api.getProductMainCategories();
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji ?? null,
      color: c.arrow_color ?? null,
    }));
  },

  /** جلب التصنيفات الفرعية لتصنيف رئيسي معين */
  async getSubCategories(mainCategoryId: string): Promise<SubCategory[]> {
    if (!mainCategoryId) return [];
    const res = await api.getProductSubCategories(mainCategoryId);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((c: any) => ({
      id: c.id,
      mainCategoryId,
      name: c.name,
      emoji: c.emoji ?? null,
      color: c.arrow_color ?? null,
    }));
  },

  /** جلب تصنيفات الأماكن الرئيسية (parent_id = null) */
  async getPlaceMainCategories(): Promise<MainCategory[]> {
    const res = await api.getPlaceCategories(null);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((c: any) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji ?? null,
      color: c.color ?? null,
    }));
  },

  /** جلب تصنيفات الأماكن الفرعية لتصنيف رئيسي */
  async getPlaceSubCategories(mainCategoryId: string): Promise<SubCategory[]> {
    if (!mainCategoryId) return [];
    const res = await api.getPlaceCategories(mainCategoryId);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((c: any) => ({
      id: c.id,
      mainCategoryId,
      name: c.name,
      emoji: c.emoji ?? null,
      color: c.color ?? null,
    }));
  },
};
