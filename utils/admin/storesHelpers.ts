import type { CategoryItem } from '../../components/places/CategorySelector';
import type { Store } from '../../context/StoreContext';
import { categoryService } from '../../services/categoryService';

export function storeToDomainPlace(store: Store): any {
  const phone = store.attributes?.find((a) => a.key === 'phone')?.value ?? store.phone ?? null;
  return {
    id: store.id,
    name: store.name,
    description: store.description || null,
    phoneNumber: phone,
    images: store.images?.map((img) => ({ id: img.id, url: img.image_url, sortOrder: img.sort_order })) ?? [],
    location: { latitude: store.latitude, longitude: store.longitude },
    typeId: store.type_id ?? '',
    typeName: store.type_name ?? store.category,
    kind: 'simple',
    status: (store.status as any) ?? 'pending',
    avgRating: parseFloat(store.avg_rating ?? '0'),
    ratingCount: Number(store.rating_count ?? 0),
    createdAt: store.createdAt,
    attributes: store.attributes?.map((a) => ({ key: a.key, value: a.value, valueType: a.value_type })) ?? [],
  };
}

export function findSubCategoryNameInMap(
  mainToSubs: Record<string, CategoryItem[]>,
  subId: string
): string | undefined {
  for (const subs of Object.values(mainToSubs)) {
    const hit = subs.find((s) => s.id === subId);
    if (hit) return hit.name;
  }
  return undefined;
}

export async function fetchPlaceCategoryTreeData(placeTypeId: string): Promise<{
  mains: CategoryItem[];
  map: Record<string, CategoryItem[]>;
}> {
  const tree = await categoryService.getPlaceCategoryTree(placeTypeId);
  const mains: CategoryItem[] = tree.map((t) => ({
    id: t.main.id,
    name: t.main.name,
    emoji: t.main.emoji ?? null,
    color: t.main.color ?? null,
  }));
  const map: Record<string, CategoryItem[]> = {};
  for (const t of tree) {
    map[t.main.id] = (t.sub_categories || []).map((s) => ({
      id: s.id,
      name: s.name,
      emoji: s.emoji ?? null,
      color: s.color ?? null,
    }));
  }
  return { mains, map };
}

export function catEmoji(cats: { name: string; emoji: string }[], name: string) {
  return cats.find((c) => c.name === name)?.emoji || '\u{1F4CD}';
}

export function catColor(cats: { name: string; color: string }[], name: string) {
  return cats.find((c) => c.name === name)?.color || '#2E86AB';
}

export function isPublishedStore(s: Store) {
  return String(s.status || '').toLowerCase() === 'active';
}

