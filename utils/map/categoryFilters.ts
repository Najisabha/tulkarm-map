import { parsedAttrFromStore, type Store } from './storeModel';

export type CategoryBrowseStep = 'main' | 'sub' | 'places';

export interface CategoryBrowseState {
  placeTypeId: string;
  step: CategoryBrowseStep;
  mainId?: string;
  mainName?: string;
  subId?: string;
  subName?: string;
}

function stripForCompare(s: string): string {
  return s
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return stripForCompare(a) === stripForCompare(b);
}

export function storeMatchesMainCategory(store: Store, mainId: string, mainName: string): boolean {
  if (store.mainCategoryId) {
    return store.mainCategoryId === mainId;
  }
  const legacy =
    store.mainCategory ??
    parsedAttrFromStore(store, 'main_category', 'store_type') ??
    null;
  return namesMatch(legacy, mainName);
}

export function storeMatchesSubCategory(store: Store, subId: string, subName: string): boolean {
  if (store.subCategoryId) {
    return store.subCategoryId === subId;
  }
  const legacy =
    store.subCategory ??
    parsedAttrFromStore(store, 'sub_category', 'store_category') ??
    null;
  return namesMatch(legacy, subName);
}

export function storeMatchesCategoryDrill(
  store: Store,
  selectedCategory: string | null,
  browse: CategoryBrowseState | null,
): boolean {
  if (!selectedCategory) return true;
  if (store.category !== selectedCategory) return false;
  if (!browse) return true;
  if (browse.step === 'main') return true;
  if (browse.step === 'sub') {
    if (!browse.mainId || !browse.mainName) return true;
    return storeMatchesMainCategory(store, browse.mainId, browse.mainName);
  }
  if (browse.step === 'places') {
    if (browse.mainId && browse.mainName) {
      if (!storeMatchesMainCategory(store, browse.mainId, browse.mainName)) return false;
    }
    if (browse.subId && browse.subName) {
      if (!storeMatchesSubCategory(store, browse.subId, browse.subName)) return false;
    }
    return true;
  }
  return true;
}
