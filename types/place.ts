/**
 * Domain layer for the "Place" entity.
 *
 * Reading shape (GET)  — PlaceData.images[]   = {id, image_url, sort_order}[]
 * Writing shape (POST) — CreatePlacePayload.image_urls = string[] (base64/URLs)
 *
 * New server columns (phone_number, complex_kind, floors_count, units_per_floor,
 * main_category_id, sub_category_id) are read if present; all fall back to
 * matching keys inside the `attributes[]` array for backward compatibility.
 */

import type { PlaceData } from '../api/client';
import { normalizePlaceTypeKind } from '../utils/placeTypeLabels';

// ─── Enums / scalar types ────────────────────────────────────────────────────

export type PlaceKind = 'simple' | 'categorized' | 'house' | 'complex';
// Server currently uses `active`; original brief used `approved`.
// Keep both accepted and normalize where needed.
export type PlaceStatus = 'pending' | 'active' | 'approved' | 'rejected';
export type ComplexType = 'residential' | 'commercial';

// ─── Sub-types ───────────────────────────────────────────────────────────────

export interface PlaceImage {
  id: string;
  url: string;
  sortOrder: number;
}

export interface PlaceAttribute {
  key: string;
  value: string;
  valueType: string;
}

export interface PlaceLocation {
  latitude: number;
  longitude: number;
}

// ─── Domain base ─────────────────────────────────────────────────────────────

export interface PlaceBase {
  id: string;
  name: string;
  description: string | null;
  phoneNumber: string | null;
  images: PlaceImage[];
  location: PlaceLocation;
  typeId: string;
  typeName: string;
  kind: PlaceKind;
  status: PlaceStatus;
  avgRating: number;
  ratingCount: number;
  createdAt: string;
  createdBy?: string;
  /** Raw attributes kept for consumers that need unstructured access */
  attributes: PlaceAttribute[];
}

// ─── Specific domain types ────────────────────────────────────────────────────

/** Simple place — no categories (mosque, parking, hospital …) */
export interface SimplePlace extends PlaceBase {
  kind: 'simple';
}

/** Categorized place — has main_category / sub_category (store, restaurant …) */
export interface CategorizedPlace extends PlaceBase {
  kind: 'categorized';
  mainCategory: string | null;
  /** ID of the place_categories row (new column); null on old records */
  mainCategoryId: string | null;
  subCategory: string | null;
  subCategoryId: string | null;
}

/** A single house / unit inside a residential complex */
export interface HousePlace extends PlaceBase {
  kind: 'house';
  houseNumber: string | null;
}

/** Residential or commercial complex */
export interface ComplexPlace extends PlaceBase {
  kind: 'complex';
  complexType: ComplexType;
  floorsCount: number;
  unitsPerFloor: number;
}

export type Place = SimplePlace | CategorizedPlace | HousePlace | ComplexPlace;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Returns the first non-empty value found among the given attribute keys,
 * searching the raw attributes array.
 * Handles both plain string values and `{v,t}` / `{value}` encoded objects.
 */
function getAttrValue(
  attrs: PlaceData['attributes'],
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const hit = attrs?.find((a) => a.key === key);
    if (!hit) continue;
    const raw = hit.value;
    if (!raw) continue;
    // Attribute stored as JSON object (legacy encoding)
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const candidate =
          parsed.v ?? parsed.value ?? parsed.val ?? null;
        if (candidate !== null && candidate !== undefined) {
          return String(candidate);
        }
      }
    } catch {
      // plain string — use as-is
    }
    return raw;
  }
  return null;
}

function deriveKind(p: PlaceData, attrs: PlaceData['attributes']): PlaceKind {
  const tk = String(p.type_kind ?? '').trim();
  if (tk === 'house') return 'house';
  if (tk === 'store') return 'categorized';
  if (tk === 'residentialComplex' || tk === 'commercialComplex') return 'complex';
  const flags = p.type_flags && typeof p.type_flags === 'object' ? (p.type_flags as Record<string, unknown>) : null;
  if (flags?.needsCategoryTree === true || flags?.productCategoryForm === true) return 'categorized';

  const serverKind = normalizePlaceTypeKind(p.type_name ?? '');
  switch (serverKind) {
    case 'house': return 'house';
    case 'store': return 'categorized';
    case 'residentialComplex':
    case 'commercialComplex': return 'complex';
    case 'other':
    default: {
      const attrKind = getAttrValue(attrs, 'place_kind', 'kind');
      if (attrKind === 'categorized') return 'categorized';
      if (attrKind === 'house') return 'house';
      if (attrKind === 'complex') return 'complex';
      return 'simple';
    }
  }
}

// ─── Mapper: API → Domain ─────────────────────────────────────────────────────

/** Converts a raw API PlaceData object into a strongly-typed Domain Place. */
export function mapApiToPlace(p: PlaceData): Place {
  const attrs = p.attributes ?? [];
  const kind = deriveKind(p, attrs);

  // phone_number: new column first, then attributes (keys: phone, phone_number, raqm)
  const phoneNumber =
    p.phone_number ??
    getAttrValue(attrs, 'phone', 'phone_number', 'raqm') ??
    null;

  const base: PlaceBase = {
    id: p.id,
    name: p.name,
    description: p.description,
    phoneNumber,
    images: (p.images ?? []).map((img) => ({
      id: img.id,
      url: img.image_url,
      sortOrder: img.sort_order,
    })),
    location: {
      latitude: parseNumber(p.latitude),
      longitude: parseNumber(p.longitude),
    },
    typeId: p.type_id,
    typeName: p.type_name,
    kind,
    status:
      (String(p.status || '').toLowerCase() === 'approved'
        ? 'active'
        : (p.status as PlaceStatus)) ?? 'pending',
    avgRating: parseNumber(p.avg_rating),
    ratingCount: p.rating_count ?? 0,
    createdAt: p.created_at,
    createdBy: p.created_by,
    attributes: attrs.map((a) => ({
      key: a.key,
      value: a.value,
      valueType: a.value_type,
    })),
  };

  if (kind === 'categorized') {
    // Priority: new place_categories IDs → attribute text values (legacy keys)
    const mainCategoryId = p.main_category_id ?? null;
    const subCategoryId = p.sub_category_id ?? null;
    const mainCategory =
      getAttrValue(attrs, 'main_category', 'store_type') ?? null;
    const subCategory =
      getAttrValue(attrs, 'sub_category', 'store_category') ?? null;
    return {
      ...base,
      kind,
      mainCategoryId,
      mainCategory,
      subCategoryId,
      subCategory,
    } as CategorizedPlace;
  }

  if (kind === 'house') {
    // house_number covers both residential complex units and standalone houses
    const houseNumber =
      getAttrValue(attrs, 'house_number', 'unit_number') ?? null;
    return { ...base, kind, houseNumber } as HousePlace;
  }

  if (kind === 'complex') {
    // complexType: new column → attribute → infer from type_name
    const rawComplexKind: string | null =
      p.complex_kind ??
      getAttrValue(attrs, 'complex_type', 'complex_kind') ??
      null;
    let complexType: ComplexType;
    if (rawComplexKind === 'residential' || rawComplexKind === 'commercial') {
      complexType = rawComplexKind;
    } else {
      const tk = String(p.type_kind ?? '').trim();
      if (tk === 'residentialComplex') complexType = 'residential';
      else if (tk === 'commercialComplex') complexType = 'commercial';
      else {
        const tn = p.type_name ?? '';
        complexType =
          normalizePlaceTypeKind(tn) === 'residentialComplex' ? 'residential' : 'commercial';
      }
    }

    // floorsCount / unitsPerFloor: new columns → attributes
    const floorsCount =
      p.floors_count ??
      parseNumber(getAttrValue(attrs, 'floors_count', 'floor_count'), 1);
    const unitsPerFloor =
      p.units_per_floor ??
      parseNumber(getAttrValue(attrs, 'units_per_floor', 'houses_per_floor', 'units'), 1);

    return {
      ...base,
      kind,
      complexType,
      floorsCount,
      unitsPerFloor,
    } as ComplexPlace;
  }

  return { ...base, kind: 'simple' } as SimplePlace;
}

// ─── Write payload types ──────────────────────────────────────────────────────

/** The shape sent to the API on POST /places or PATCH /places/:id */
export interface CreatePlacePayload {
  name: string;
  description?: string;
  type_id: string;
  latitude: number;
  longitude: number;
  phone_number?: string;
  attributes?: { key: string; value: string; value_type?: string }[];
  image_urls?: string[];
  complex_kind?: ComplexType;
  floors_count?: number;
  units_per_floor?: number;
}

// ─── Mapper: Form inputs → API payload ───────────────────────────────────────

/**
 * Converts raw form fields into the payload accepted by the API.
 * Use this when building a new place from user input.
 *
 * New fields (phone, complex shape) are sent both as top-level columns
 * (for servers that already have the migration) AND packed into `attributes`
 * (for backward compatibility with older deployments).
 */
export function mapFormToPayload(form: {
  name: string;
  description?: string;
  typeId: string;
  latitude: number;
  longitude: number;
  phoneNumber?: string;
  attributes?: PlaceAttribute[];
  imageUrls?: string[];
  complexKind?: ComplexType;
  floorsCount?: number;
  unitsPerFloor?: number;
  mainCategory?: string;
  subCategory?: string;
}): CreatePlacePayload {
  const extraAttrs: { key: string; value: string; value_type?: string }[] = [];

  // Pack new fields into attributes so the server can store them even without
  // new columns (graceful degradation / backward compat).
  if (form.phoneNumber?.trim()) {
    extraAttrs.push({ key: 'phone', value: form.phoneNumber.trim(), value_type: 'text' });
  }
  if (form.complexKind) {
    extraAttrs.push({ key: 'complex_type', value: form.complexKind, value_type: 'text' });
  }
  if (form.floorsCount !== undefined) {
    extraAttrs.push({ key: 'floors_count', value: String(form.floorsCount), value_type: 'number' });
  }
  if (form.unitsPerFloor !== undefined) {
    extraAttrs.push({ key: 'units_per_floor', value: String(form.unitsPerFloor), value_type: 'number' });
  }
  if (form.mainCategory) {
    extraAttrs.push({ key: 'main_category', value: form.mainCategory, value_type: 'text' });
  }
  if (form.subCategory) {
    extraAttrs.push({ key: 'sub_category', value: form.subCategory, value_type: 'text' });
  }

  const baseAttrs = (form.attributes ?? []).map((a) => ({
    key: a.key,
    value: a.value,
    value_type: a.valueType,
  }));

  // Merge: extra attrs first (lower priority so caller's explicit attrs win)
  const mergedAttrs = mergeAttrs(extraAttrs, baseAttrs);

  return {
    name: form.name.trim(),
    description: form.description?.trim() || undefined,
    type_id: form.typeId,
    latitude: form.latitude,
    longitude: form.longitude,
    // Top-level columns (for servers with v2 migration)
    phone_number: form.phoneNumber?.trim() || undefined,
    complex_kind: form.complexKind,
    floors_count: form.floorsCount,
    units_per_floor: form.unitsPerFloor,
    attributes: mergedAttrs.length ? mergedAttrs : undefined,
    image_urls: form.imageUrls?.length ? form.imageUrls : undefined,
  };
}

// ─── Mapper: Domain Place → API payload ──────────────────────────────────────

/**
 * Converts a fully-hydrated Domain Place back into an API write payload.
 * Useful when cloning or editing an existing place.
 *
 * @param place  Domain Place object
 * @param imageUrls  New base64/URL array to upload (pass existing URLs to keep)
 */
export function mapDomainToCreatePlacePayload(
  place: Place,
  imageUrls: string[] = [],
): CreatePlacePayload {
  const extraAttrs: { key: string; value: string; value_type?: string }[] = [];

  if (place.phoneNumber) {
    extraAttrs.push({ key: 'phone', value: place.phoneNumber, value_type: 'text' });
  }

  if (place.kind === 'categorized') {
    const cp = place as CategorizedPlace;
    if (cp.mainCategory) {
      extraAttrs.push({ key: 'main_category', value: cp.mainCategory, value_type: 'text' });
    }
    if (cp.subCategory) {
      extraAttrs.push({ key: 'sub_category', value: cp.subCategory, value_type: 'text' });
    }
  }

  if (place.kind === 'house') {
    const hp = place as HousePlace;
    if (hp.houseNumber) {
      extraAttrs.push({ key: 'house_number', value: hp.houseNumber, value_type: 'text' });
    }
  }

  if (place.kind === 'complex') {
    const cx = place as ComplexPlace;
    extraAttrs.push({ key: 'complex_type', value: cx.complexType, value_type: 'text' });
    extraAttrs.push({ key: 'floors_count', value: String(cx.floorsCount), value_type: 'number' });
    extraAttrs.push({ key: 'units_per_floor', value: String(cx.unitsPerFloor), value_type: 'number' });
  }

  // Preserve original attributes that aren't overridden
  const originalAttrs = place.attributes.map((a) => ({
    key: a.key,
    value: a.value,
    value_type: a.valueType,
  }));

  const mergedAttrs = mergeAttrs(extraAttrs, originalAttrs);

  const payload: CreatePlacePayload = {
    name: place.name,
    description: place.description ?? undefined,
    type_id: place.typeId,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
    phone_number: place.phoneNumber ?? undefined,
    attributes: mergedAttrs.length ? mergedAttrs : undefined,
    image_urls: imageUrls.length ? imageUrls : undefined,
  };

  if (place.kind === 'complex') {
    const cx = place as ComplexPlace;
    payload.complex_kind = cx.complexType;
    payload.floors_count = cx.floorsCount;
    payload.units_per_floor = cx.unitsPerFloor;
  }

  return payload;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Merges two attribute arrays.  `primary` keys win; `secondary` entries whose
 * key is not already in `primary` are appended.
 */
function mergeAttrs(
  primary: { key: string; value: string; value_type?: string }[],
  secondary: { key: string; value: string; value_type?: string }[],
): { key: string; value: string; value_type?: string }[] {
  const seen = new Set(primary.map((a) => a.key));
  return [
    ...primary,
    ...secondary.filter((a) => !seen.has(a.key)),
  ];
}

// ─── Unit naming helpers (for future auto-create complex units) ───────────────

/**
 * Generates the default name for a unit inside a complex.
 * Pattern: "وحدة {floor}-{unit}" for commercial, "بيت {floor}-{unit}" for residential.
 */
export function complexUnitName(
  complexType: ComplexType,
  floor: number,
  unit: number,
): string {
  const label = complexType === 'residential' ? 'بيت' : 'وحدة';
  return `${label} ${floor}-${unit}`;
}

/**
 * Returns an array of all unit names for a complex.
 * Useful for dry-running the auto-create logic without touching the DB.
 */
export function listComplexUnitNames(
  complexType: ComplexType,
  floorsCount: number,
  unitsPerFloor: number,
): { floor: number; unit: number; name: string }[] {
  const result: { floor: number; unit: number; name: string }[] = [];
  for (let f = 1; f <= floorsCount; f++) {
    for (let u = 1; u <= unitsPerFloor; u++) {
      result.push({ floor: f, unit: u, name: complexUnitName(complexType, f, u) });
    }
  }
  return result;
}
