/**
 * شريط الفئات وورقة الأماكن داخل فئة: اختيار التصنيف، شجرة التصنيفات من الخادم، وترتيب المسافات.
 */

import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapView } from '../../components/MapWrapper';
import { categoryService } from '../../services/categoryService';
import type { PlaceCategoryTreeItem } from '../../types/placeCategories';
import {
  storeMatchesCategoryDrill,
  type CategoryBrowseState,
} from '../../utils/map/categoryFilters';
import { haversineDistance, regionForBoundingBox } from '../../utils/map/geo';
import type { Store } from '../../utils/map/storeModel';
import { isValidPlaceTypeId } from '../../utils/map/storeModel';
import {
  needsPlaceCategoryTree,
} from '../../utils/placeTypeLabels';
import type { UserLocation, StoreWithDistance } from './types';

type MapViewRef = RefObject<MapView | null>;

type CategoryListItem = { id?: string; name?: string };

export function useMapCategoryExplorer(params: {
  mapRef: MapViewRef;
  stores: Store[];
  categoryList: CategoryListItem[];
  userLocation: UserLocation | null;
}) {
  const { mapRef, stores, categoryList, userLocation } = params;

  const categoryTreeLoadedForIdRef = useRef<string | null>(null);
  const placeCategoryTreeRef = useRef<PlaceCategoryTreeItem[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryBrowse, setCategoryBrowse] = useState<CategoryBrowseState | null>(null);
  const [placeCategoryTree, setPlaceCategoryTree] = useState<PlaceCategoryTreeItem[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  placeCategoryTreeRef.current = placeCategoryTree;

  /** مصدر واحد مع إدارة الفئات: أسماء الأنواع من الخادم فقط، بدون دمج أسماء خام من الأماكن. */
  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const c of categoryList) {
      if (c?.name?.trim()) names.add(c.name.trim());
    }
    const list = [...names];
    const countByCategory = new Map<string, number>();
    for (const s of stores) {
      const name = String(s?.category ?? '').trim();
      if (!name) continue;
      countByCategory.set(name, (countByCategory.get(name) ?? 0) + 1);
    }
    list.sort((a, b) => {
      const countDiff = (countByCategory.get(b) ?? 0) - (countByCategory.get(a) ?? 0);
      if (countDiff !== 0) return countDiff;
      return a.localeCompare(b, 'ar');
    });
    return list;
  }, [categoryList, stores]);

  useEffect(() => {
    if (!selectedCategory) return;
    if (categories.includes(selectedCategory)) return;
    categoryTreeLoadedForIdRef.current = null;
    setSelectedCategory(null);
    setCategoryBrowse(null);
    setPlaceCategoryTree([]);
    setTreeLoading(false);
  }, [selectedCategory, categories]);

  const withDistance = useCallback(
    (list: Store[]): StoreWithDistance[] =>
      list
        .map((s) => ({
          ...s,
          distance: userLocation
            ? haversineDistance(
                userLocation.latitude,
                userLocation.longitude,
                s.latitude,
                s.longitude,
              )
            : null,
        }))
        .sort((a, b) => {
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        }),
    [userLocation],
  );

  const categoryStores: StoreWithDistance[] = useMemo(() => {
    if (!selectedCategory) return [];
    let list = stores.filter((s) => s.category === selectedCategory);
    if (categoryBrowse) {
      list = list.filter((s) => storeMatchesCategoryDrill(s, selectedCategory, categoryBrowse));
    }
    return withDistance(list);
  }, [stores, selectedCategory, categoryBrowse, withDistance]);

  useEffect(() => {
    if (!selectedCategory || !categoryBrowse || categoryBrowse.step !== 'main') return;
    const id = categoryBrowse.placeTypeId;
    if (!isValidPlaceTypeId(id)) {
      setCategoryBrowse(null);
      setTreeLoading(false);
      return;
    }
    if (categoryTreeLoadedForIdRef.current === id && placeCategoryTreeRef.current.length > 0) {
      setTreeLoading(false);
      return;
    }
    let cancelled = false;
    setTreeLoading(true);
    void categoryService
      .getPlaceCategoryTree(id)
      .then((tree) => {
        if (cancelled) return;
        categoryTreeLoadedForIdRef.current = id;
        setPlaceCategoryTree(tree);
        if (tree.length === 0) setCategoryBrowse(null);
        setTreeLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPlaceCategoryTree([]);
        setCategoryBrowse(null);
        setTreeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, categoryBrowse]);

  const handleCategoryPress = useCallback(
    (cat: string) => {
      if (selectedCategory === cat) return;

      setSelectedCategory(cat);
      const pt = categoryList.find((c) => c.name === cat);
      const placeTypeId = pt?.id ?? '';
      if (needsPlaceCategoryTree(cat) && isValidPlaceTypeId(placeTypeId)) {
        setCategoryBrowse({ step: 'main', placeTypeId });
        setPlaceCategoryTree([]);
        setTreeLoading(true);
      } else {
        setCategoryBrowse(null);
        setPlaceCategoryTree([]);
        setTreeLoading(false);
      }

      const catStores = stores.filter((s) => s.category === cat);
      const region = regionForBoundingBox(
        catStores.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
      );
      if (region) mapRef.current?.animateToRegion(region, 600);
    },
    [stores, categoryList, selectedCategory, mapRef],
  );

  const clearCategorySheet = useCallback(() => {
    categoryTreeLoadedForIdRef.current = null;
    setSelectedCategory(null);
    setCategoryBrowse(null);
    setPlaceCategoryTree([]);
    setTreeLoading(false);
  }, []);

  const handleCategorySheetBack = useCallback(() => {
    setCategoryBrowse((prev) => {
      if (!prev) return null;
      if (prev.step === 'places') {
        const subs =
          placeCategoryTree.find((t) => t.main.id === prev.mainId)?.sub_categories ?? [];
        if (subs.length > 0) {
          return {
            step: 'sub',
            placeTypeId: prev.placeTypeId,
            mainId: prev.mainId,
            mainName: prev.mainName,
          };
        }
        return { step: 'main', placeTypeId: prev.placeTypeId };
      }
      if (prev.step === 'sub') return { step: 'main', placeTypeId: prev.placeTypeId };
      return prev;
    });
  }, [placeCategoryTree]);

  const onPickMainCategory = useCallback(
    (main: { id: string; name: string }) => {
      setCategoryBrowse((prev) => {
        if (!prev) return prev;
        const subs = placeCategoryTree.find((t) => t.main.id === main.id)?.sub_categories ?? [];
        if (subs.length > 0) {
          return {
            step: 'sub',
            placeTypeId: prev.placeTypeId,
            mainId: main.id,
            mainName: main.name,
          };
        }
        return {
          step: 'places',
          placeTypeId: prev.placeTypeId,
          mainId: main.id,
          mainName: main.name,
        };
      });
    },
    [placeCategoryTree],
  );

  const onPickSubCategory = useCallback((sub: { id: string; name: string }) => {
    setCategoryBrowse((prev) =>
      prev ? { ...prev, step: 'places', subId: sub.id, subName: sub.name } : prev,
    );
  }, []);

  const categorySheetSubtitle = useMemo(() => {
    if (!selectedCategory) return '';
    const distHint = userLocation ? ' · مرتّب حسب المسافة' : '';
    if (categoryBrowse?.step === 'main' && treeLoading) return 'جاري التحميل…';
    if (categoryBrowse?.step === 'main' && !treeLoading) {
      return `اختر التصنيف الرئيسي · ${placeCategoryTree.length} تصنيفاً رئيسياً`;
    }
    if (categoryBrowse?.step === 'sub') {
      return `اختر التصنيف الفرعي · ${categoryBrowse.mainName ?? ''} · ${categoryStores.length} مكان ضمن هذا القسم${distHint}`;
    }
    if (categoryBrowse?.step === 'places') {
      const path =
        categoryBrowse.subName && categoryBrowse.mainName
          ? `${categoryBrowse.mainName} › ${categoryBrowse.subName}`
          : categoryBrowse.mainName
            ? `${categoryBrowse.mainName}`
            : '';
      const prefix = path ? `${path} · ` : '';
      return `${prefix}${categoryStores.length} مكان${distHint}`;
    }
    return `${categoryStores.length} مكان${distHint}`;
  }, [
    selectedCategory,
    categoryBrowse,
    treeLoading,
    placeCategoryTree.length,
    categoryStores.length,
    userLocation,
  ]);

  return {
    categories,
    selectedCategory,
    setSelectedCategory,
    categoryBrowse,
    placeCategoryTree,
    treeLoading,
    categoryStores,
    categorySheetSubtitle,
    handleCategoryPress,
    clearCategorySheet,
    handleCategorySheetBack,
    onPickMainCategory,
    onPickSubCategory,
  };
}
