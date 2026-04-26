/**
 * تسميات وقواعد أنواع الأماكن — تُقرأ من السجل الديناميكي (قاعدة البيانات عبر API).
 */

import {
  coalesceFlags,
  getPlaceTypesRegistrySnapshot,
  normalizeRegistryKind,
  resolvePlaceTypeRowByName,
  type PlaceTypeRegistryRow,
  type RegistryPlaceTypeKind,
} from './placeTypesRegistry';

export type PlaceTypeKind = RegistryPlaceTypeKind;

/** اسم النوع كما في عمود place_types.name */
export type CanonicalPlaceTypeName = string;

/** @deprecated لا توجد قائمة ثابتة — استخدم listOrderedPlaceTypeNamesFromRegistry */
export const CANONICAL_PLACE_TYPE_NAMES: readonly string[] = [];

export function listOrderedPlaceTypeNamesFromRegistry(): string[] {
  const snap = getPlaceTypesRegistrySnapshot();
  if (!snap?.rows.length) return [];
  return [...snap.rows]
    .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100) || a.name.localeCompare(b.name, 'ar'))
    .map((r) => r.name);
}

function readUi(row: PlaceTypeRegistryRow | null): Record<string, unknown> {
  if (!row?.ui_labels || typeof row.ui_labels !== 'object') return {};
  return row.ui_labels as Record<string, unknown>;
}

/** تسمية من ui_labels (مثل nameFieldLabel، descriptionFieldLabel) */
export function getPlaceFormFieldLabel(typeName: string, uiKey: string): string {
  const row = resolvePlaceTypeRowByName(typeName);
  const ui = readUi(row);
  const v = ui[uiKey];
  return v != null ? String(v).trim() : '';
}

function readAttrLabels(row: PlaceTypeRegistryRow | null): Record<string, string> {
  const ui = readUi(row);
  const raw = ui.attrLabels;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && String(v).trim()) out[k] = String(v).trim();
  }
  return out;
}

export function usesProductCategoryFieldsForPlaceType(name?: string | null): boolean {
  const row = resolvePlaceTypeRowByName(name);
  if (!row) return false;
  return coalesceFlags(row.flags).productCategoryForm;
}

export function usesPlacePhoneAsStoreNumberField(name?: string | null): boolean {
  const row = resolvePlaceTypeRowByName(name);
  if (!row) return false;
  return coalesceFlags(row.flags).phoneAsStoreNumber;
}

export function getPlaceTypeProductCategoryFieldLabels(name?: string | null): {
  main: string;
  sub: string;
  number: string;
  photos: string;
} | null {
  const row = resolvePlaceTypeRowByName(name);
  if (!row) return null;
  const ui = readUi(row);
  const mainEx = ui.mainCategoryLabel != null ? String(ui.mainCategoryLabel).trim() : '';
  const subEx = ui.subCategoryLabel != null ? String(ui.subCategoryLabel).trim() : '';
  const phoneEx = ui.phoneFieldLabel != null ? String(ui.phoneFieldLabel).trim() : '';
  const photosEx = ui.photosLabel != null ? String(ui.photosLabel).trim() : '';
  if (mainEx && subEx && phoneEx && photosEx) {
    return { main: mainEx, sub: subEx, number: phoneEx, photos: photosEx };
  }
  return null;
}

export function getAddPlaceModalPhotoLabel(name?: string | null): string | null {
  const row = resolvePlaceTypeRowByName(name);
  if (!row) return null;
  const fromProduct = getPlaceTypeProductCategoryFieldLabels(name);
  if (fromProduct?.photos) return fromProduct.photos;
  const ui = readUi(row);
  const ph = ui.photosLabel != null ? String(ui.photosLabel).trim() : '';
  return ph || null;
}

export function resolveCanonicalPlaceTypeKey(name?: string | null): CanonicalPlaceTypeName | null {
  const row = resolvePlaceTypeRowByName(name);
  return row?.name ?? null;
}

export function isDisallowedComplexUnitChildTypeName(name?: string | null): boolean {
  const row = resolvePlaceTypeRowByName(name);
  if (!row) return false;
  return coalesceFlags(row.flags).disallowComplexUnitChild;
}

export function normalizePlaceTypeKind(name?: string | null): PlaceTypeKind {
  const row = resolvePlaceTypeRowByName(name);
  if (row?.kind) return normalizeRegistryKind(row.kind);
  return 'other';
}

export function needsPlaceCategoryTree(typeName: string): boolean {
  const row = resolvePlaceTypeRowByName(typeName);
  if (!row) return false;
  const f = coalesceFlags(row.flags);
  const k = normalizeRegistryKind(row.kind);
  return f.needsCategoryTree || k === 'store' || f.productCategoryForm;
}

export function getPlaceTypeDisplayName(name?: string | null): string {
  const t = String(name ?? '').trim();
  if (!t) {
    const snap = getPlaceTypesRegistrySnapshot();
    const fallback = snap?.rows.find((r) => normalizeRegistryKind(r.kind) === 'other');
    return fallback?.singular_label?.trim() || fallback?.name || '';
  }
  const row = resolvePlaceTypeRowByName(name);
  if (row) {
    const s = row.singular_label?.trim();
    if (s) return s;
    return row.name;
  }
  return t;
}

export function getPlaceTypePluralLabel(name?: string | null): string {
  const t = String(name ?? '').trim();
  if (!t) return '';
  const row = resolvePlaceTypeRowByName(name);
  if (row) {
    const p = row.plural_label?.trim();
    if (p) return p;
    const s = row.singular_label?.trim();
    if (s) return s;
    return row.name;
  }
  return t;
}

/** تسميات حقول ديناميكية من ui_labels.attrLabels (مفتاح = key الحقل) */
export function getPlaceTypeAttrLabelsForKeys(typeName: string): Record<string, string> {
  const row = resolvePlaceTypeRowByName(typeName);
  return readAttrLabels(row);
}

export function isGovStyleCategoryFields(typeName: string): boolean {
  const row = resolvePlaceTypeRowByName(typeName);
  if (!row) return false;
  const ui = readUi(row);
  const f = coalesceFlags(row.flags);
  if (f.productCategoryForm) return false;
  return (
    Boolean(ui.mainCategoryLabel) &&
    f.needsCategoryTree &&
    normalizeRegistryKind(row.kind) === 'other'
  );
}

export function getGovExtraLocationFieldLabel(typeName: string): string | null {
  const row = resolvePlaceTypeRowByName(typeName);
  if (!row) return null;
  const ui = readUi(row);
  const loc = ui.locationFieldLabel != null ? String(ui.locationFieldLabel).trim() : '';
  return loc || null;
}
