/**
 * categoryService — خدمة التصنيفات الرئيسية والفرعية للأماكن.
 */

import { api } from '../api/client';
import { STATIC_PLACE_CATEGORIES_FALLBACK } from '../constants/placeCategoriesFallback';
import type { PlaceCategoryTreeItem } from '../types/placeCategories';

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

  /** جلب تصنيفات الأماكن الرئيسية (parent_id = null) لنوع مكان معين */
  async getPlaceMainCategories(placeTypeId: string): Promise<MainCategory[]> {
    const res = await api.getPlaceCategories(placeTypeId, null);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((c: any) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji ?? null,
      color: c.color ?? null,
    }));
  },

  /** جلب تصنيفات الأماكن الفرعية لتصنيف رئيسي */
  async getPlaceSubCategories(placeTypeId: string, mainCategoryId: string): Promise<SubCategory[]> {
    if (!mainCategoryId) return [];
    const res = await api.getPlaceCategories(placeTypeId, mainCategoryId);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((c: any) => ({
      id: c.id,
      mainCategoryId,
      name: c.name,
      emoji: c.emoji ?? null,
      color: c.color ?? null,
    }));
  },

  /**
   * جلب شجرة تصنيفات الأماكن لنوع مكان محدد:
   * - main_category
   *   - sub_categories[]
   *
   * API-first مع fallback عام موحّد داخل التطبيق عند عدم توفر الـ API.
   */
  async getPlaceCategoryTree(placeTypeId: string): Promise<PlaceCategoryTreeItem[]> {
    if (!placeTypeId) return STATIC_PLACE_CATEGORIES_FALLBACK;

    // 1) Try tree endpoint (single request)
    try {
      const res = await api.getPlaceCategoriesTree(placeTypeId);
      const list = Array.isArray(res.data) ? res.data : [];
      if (list.length > 0) {
        return list.map((main: any) => ({
          main: {
            id: main.id,
            name: main.name,
            emoji: main.emoji ?? null,
            color: main.color ?? null,
          },
          sub_categories: Array.isArray(main.children)
            ? main.children.map((c: any) => ({
                id: c.id,
                name: c.name,
                emoji: c.emoji ?? null,
                color: c.color ?? null,
              }))
            : [],
        }));
      }
    } catch {
      // continue to next strategy
    }

    // 2) Try building tree from main + sub calls
    try {
      const mains = await categoryService.getPlaceMainCategories(placeTypeId);
      if (!mains.length) return [];
      const subsByMain = await Promise.all(
        mains.map(async (m) => {
          try {
            const subs = await categoryService.getPlaceSubCategories(placeTypeId, m.id);
            return { mainId: m.id, subs };
          } catch {
            return { mainId: m.id, subs: [] as SubCategory[] };
          }
        })
      );
      const byId = new Map(subsByMain.map((x) => [x.mainId, x.subs]));
      return mains.map((m) => ({
        main: { id: m.id, name: m.name, emoji: m.emoji ?? null, color: m.color ?? null },
        sub_categories: (byId.get(m.id) ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          emoji: s.emoji ?? null,
          color: s.color ?? null,
        })),
      }));
    } catch {
      // fall through
    }

    // 3) Empty — no global fallback per-type
    return [];
  },
};
