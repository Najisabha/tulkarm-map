import type { Place } from '../../types/place';

/** Legacy Store shape used by the map screen; backed by Domain Place. */
export interface Store {
  id: string;
  name: string;
  description: string;
  category: string;
  type_name?: string;
  type_id?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  photos?: string[];
  videos?: string[];
  status?: string;
  avg_rating?: string;
  rating_count?: number;
  attributes?: { key: string; value: string; value_type: string }[];
  images?: { id: string; image_url: string; sort_order: number }[];
  createdAt: string;
  mainCategoryId?: string | null;
  subCategoryId?: string | null;
  mainCategory?: string | null;
  subCategory?: string | null;
  kind?: 'simple' | 'categorized' | 'house' | 'complex';
  complexType?: 'residential' | 'commercial' | null;
  floorsCount?: number;
  unitsPerFloor?: number;
}

export function placeToStore(p: Place): Store {
  const base: Store = {
    id: p.id,
    name: p.name,
    description: p.description || '',
    category: p.typeName,
    type_name: p.typeName,
    type_id: p.typeId,
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    phone: p.phoneNumber || undefined,
    photos: p.images?.map((img) => img.url) || [],
    status: p.status,
    avg_rating: String(p.avgRating ?? '0'),
    rating_count: p.ratingCount ?? 0,
    attributes: p.attributes?.map((a) => ({ key: a.key, value: a.value, value_type: a.valueType })),
    images: p.images?.map((img) => ({ id: img.id, image_url: img.url, sort_order: img.sortOrder })) || [],
    createdAt: p.createdAt,
    kind: p.kind,
    complexType: p.kind === 'complex' ? p.complexType : null,
    floorsCount: p.kind === 'complex' ? p.floorsCount : undefined,
    unitsPerFloor: p.kind === 'complex' ? p.unitsPerFloor : undefined,
  };
  if (p.kind === 'categorized') {
    return {
      ...base,
      mainCategoryId: p.mainCategoryId,
      subCategoryId: p.subCategoryId,
      mainCategory: p.mainCategory,
      subCategory: p.subCategory,
    };
  }
  return base;
}

/** Resolve a Store attribute that may be stored as plain text or JSON-wrapped. */
export function parsedAttrFromStore(store: Store, ...keys: string[]): string | undefined {
  const attrs = store.attributes || [];
  for (const key of keys) {
    const raw = attrs.find((a) => a.key === key)?.value;
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const v = (parsed as { v?: unknown; value?: unknown; val?: unknown }).v
          ?? (parsed as { value?: unknown }).value
          ?? (parsed as { val?: unknown }).val;
        if (v != null && String(v).trim()) return String(v).trim();
      }
    } catch {
      /* plain string */
    }
    if (String(raw).trim()) return String(raw).trim();
  }
  return undefined;
}

export function matchesQuery(
  store: { name: string; description?: string; category: string; phone?: string },
  q: string,
): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const phone = store.phone || '';
  return (
    store.name.toLowerCase().includes(query) ||
    (store.description || '').toLowerCase().includes(query) ||
    (store.category || '').toLowerCase().includes(query) ||
    phone.toLowerCase().includes(query)
  );
}

/**
 * Adapt a Store into the `place`-shaped object expected by
 * `PlaceCard` / `PlaceDetails`. The shape is intentionally loose (`any`) because
 * those consumers accept the full Place union; we only fill the fields they read.
 */
export function storeToPlaceViewModel(store: Store) {
  return {
    id: store.id,
    name: store.name,
    description: store.description || null,
    phoneNumber: store.phone ?? null,
    images:
      store.images?.map((img) => ({ id: img.id, url: img.image_url, sortOrder: img.sort_order })) ?? [],
    location: { latitude: store.latitude, longitude: store.longitude },
    typeId: store.type_id ?? '',
    typeName: store.type_name ?? store.category,
    kind: 'simple' as const,
    status: (store.status as any) ?? 'pending',
    avgRating: parseFloat(store.avg_rating ?? '0'),
    ratingCount: store.rating_count ?? 0,
    createdAt: store.createdAt,
    attributes:
      store.attributes?.map((a) => ({ key: a.key, value: a.value, valueType: a.value_type })) ?? [],
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPlaceTypeId(id: string): boolean {
  return typeof id === 'string' && UUID_RE.test(id.trim());
}

export async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function getCategoryStyle(
  categories: { name: string; emoji: string; color: string }[],
  name: string,
) {
  const c = categories.find((x) => x.name === name);
  return { emoji: c?.emoji ?? '📍', color: c?.color ?? '#2E86AB' };
}
