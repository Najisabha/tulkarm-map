/**
 * سجل أنواع الأماكن المُحمّل من الـ API — مصدر واحد للتطبيع والتسميات والأعلام.
 */

export type RegistryPlaceTypeKind =
  | 'house'
  | 'store'
  | 'residentialComplex'
  | 'commercialComplex'
  | 'other';

export interface PlaceTypeFlagsNormalized {
  productCategoryForm: boolean;
  phoneAsStoreNumber: boolean;
  disallowComplexUnitChild: boolean;
  needsCategoryTree: boolean;
}

/** صف متوافق مع استجابة GET /api/place-types بعد migrate-v8 */
export interface PlaceTypeRegistryRow {
  id: string;
  name: string;
  created_at?: string;
  emoji?: string | null;
  color?: string | null;
  sort_order?: number | null;
  kind?: string | null;
  singular_label?: string | null;
  plural_label?: string | null;
  ui_labels?: Record<string, unknown> | null;
  flags?: Record<string, unknown> | null;
  aliases?: string[] | null;
}

let cache: {
  rows: PlaceTypeRegistryRow[];
  byId: Map<string, PlaceTypeRegistryRow>;
  byNorm: Map<string, PlaceTypeRegistryRow>;
} | null = null;

export function stripArabicForCompare(s: string): string {
  return s
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normKey(s: string): string {
  return stripArabicForCompare(s).toLowerCase();
}

export function ingestPlaceTypesFromApi(rows: unknown) {
  const list = Array.isArray(rows) ? (rows as PlaceTypeRegistryRow[]) : [];
  const byId = new Map<string, PlaceTypeRegistryRow>();
  const byNorm = new Map<string, PlaceTypeRegistryRow>();

  for (const row of list) {
    if (!row?.id || !row?.name) continue;
    const id = String(row.id);
    byId.set(id, row);

    const register = (raw: string) => {
      const k = normKey(raw);
      if (k && !byNorm.has(k)) byNorm.set(k, row);
    };

    register(row.name);
    if (row.singular_label) register(String(row.singular_label));
    if (row.plural_label) register(String(row.plural_label));
    const aliases = Array.isArray(row.aliases) ? row.aliases : [];
    for (const a of aliases) register(String(a));
  }

  cache = { rows: list.filter((r) => r?.id && r?.name), byId, byNorm };
}

export function mergePlaceTypeIntoRegistry(row: PlaceTypeRegistryRow) {
  if (!row?.id) return;
  if (!cache) {
    ingestPlaceTypesFromApi([row]);
    return;
  }
  const rest = cache.rows.filter((r) => String(r.id) !== String(row.id));
  ingestPlaceTypesFromApi([...rest, row]);
}

export function removePlaceTypeFromRegistry(id: string) {
  if (!cache?.rows.length) return;
  ingestPlaceTypesFromApi(cache.rows.filter((r) => String(r.id) !== String(id)));
}

export function getPlaceTypesRegistrySnapshot() {
  return cache;
}

export function coalesceFlags(f: unknown): PlaceTypeFlagsNormalized {
  const o = f && typeof f === 'object' && !Array.isArray(f) ? (f as Record<string, unknown>) : {};
  return {
    productCategoryForm: Boolean(o.productCategoryForm),
    phoneAsStoreNumber: Boolean(o.phoneAsStoreNumber),
    disallowComplexUnitChild: Boolean(o.disallowComplexUnitChild),
    needsCategoryTree: Boolean(o.needsCategoryTree),
  };
}

export function resolvePlaceTypeRowById(id?: string | null): PlaceTypeRegistryRow | null {
  if (!id || !cache) return null;
  return cache.byId.get(String(id)) ?? null;
}

export function resolvePlaceTypeRowByName(name?: string | null): PlaceTypeRegistryRow | null {
  if (!name || !cache) return null;
  const n = normKey(String(name));
  if (!n) return null;
  const hit = cache.byNorm.get(n);
  if (hit) return hit;

  const normalized = stripArabicForCompare(String(name).trim());
  const en = String(name).trim().toLowerCase();
  if (en === 'parking' || en === 'carpark' || /\bcar\s*park\b/.test(en)) {
    for (const row of cache.rows) {
      const kn = normKey(row.name);
      if (kn.includes('موقف') || kn.includes('parking')) return row;
    }
  }

  let best: PlaceTypeRegistryRow | null = null;
  let bestLen = 0;
  for (const row of cache.rows) {
    const rn = stripArabicForCompare(row.name);
    if (rn.length >= 2 && normalized.includes(rn) && rn.length > bestLen) {
      best = row;
      bestLen = rn.length;
    }
  }
  if (best) return best;

  if (/\bresidential\b/.test(en) && /\bcomplex\b/.test(en)) {
    for (const row of cache.rows) {
      if (row.kind === 'residentialComplex') return row;
    }
  }
  if (/\bcommercial\b/.test(en) && /\bcomplex\b/.test(en)) {
    for (const row of cache.rows) {
      if (row.kind === 'commercialComplex') return row;
    }
  }
  if (!normalized.includes('مجمع') && (/\bstore\b/.test(en) || /\bshop\b/.test(en) || /\bmall\b/.test(en))) {
    for (const row of cache.rows) {
      if (row.kind === 'store') return row;
    }
  }
  if (
    !normalized.includes('مجمع') &&
    (/\bhouse\b/.test(en) || /\bhome\b/.test(en) || /\bvilla\b/.test(en) || /\bapartment\b/.test(en))
  ) {
    for (const row of cache.rows) {
      if (row.kind === 'house') return row;
    }
  }

  return null;
}

export function normalizeRegistryKind(kind?: string | null): RegistryPlaceTypeKind {
  const k = String(kind ?? '').trim();
  if (
    k === 'house' ||
    k === 'store' ||
    k === 'residentialComplex' ||
    k === 'commercialComplex' ||
    k === 'other'
  ) {
    return k;
  }
  return 'other';
}
