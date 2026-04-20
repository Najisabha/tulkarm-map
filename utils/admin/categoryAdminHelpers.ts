import { normalizePlaceTypeKind } from '../placeTypeLabels';
import type { Category } from '../../context/CategoryContext';

export interface AttrDef {
  id: string;
  key: string;
  label: string;
  value_type: string;
  is_required: boolean;
  options?: unknown;
}

export type AttrUiRole =
  | 'dynamic'
  | 'place_location'
  | 'place_name'
  | 'place_description'
  | 'place_phone'
  | 'place_photos';

export const ATTR_UI_ROLE_KEYS: Record<Exclude<AttrUiRole, 'dynamic'>, string> = {
  place_location: 'place_location',
  place_name: 'place_name',
  place_description: 'place_description',
  place_phone: 'place_phone',
  place_photos: 'place_photos',
};

export interface AttrUiOptions {
  uiRole?: AttrUiRole;
  sortOrder?: number;
  maxPhotos?: number;
}

export function parseAttrUiOptions(options: unknown): AttrUiOptions {
  if (!options || typeof options !== 'object') return {};
  const raw = options as Record<string, unknown>;
  const roleRaw = String(raw.uiRole ?? '').trim();
  const uiRole: AttrUiRole | undefined =
    roleRaw === 'dynamic' ||
    roleRaw === 'place_location' ||
    roleRaw === 'place_name' ||
    roleRaw === 'place_description' ||
    roleRaw === 'place_phone' ||
    roleRaw === 'place_photos'
      ? roleRaw
      : undefined;
  const sortOrderRaw = Number(raw.sortOrder);
  const maxPhotosRaw = Number(raw.maxPhotos);
  return {
    uiRole,
    sortOrder: Number.isFinite(sortOrderRaw) ? sortOrderRaw : undefined,
    maxPhotos: Number.isFinite(maxPhotosRaw) ? maxPhotosRaw : undefined,
  };
}

export const VALUE_TYPES = [
  { value: 'string', label: 'نص' },
  { value: 'number', label: 'رقم' },
  { value: 'boolean', label: 'نعم/لا' },
  { value: 'date', label: 'تاريخ' },
  { value: 'phone', label: 'هاتف' },
  { value: 'json', label: 'JSON' },
];

export function resolveFilterKind(params: Record<string, unknown> | null | undefined): string {
  const p = params ?? {};
  const raw = p.filterKind ?? p.filterkind ?? p.filter_kind ?? 'all';
  return String(raw ?? 'all').toLowerCase();
}

export function filterVisibleCategories(categories: Category[], filterKind: string): Category[] {
  if (filterKind !== 'store') return categories;
  return categories.filter((c) => {
    const kind = normalizePlaceTypeKind(c.name);
    return kind === 'store' || kind === 'commercialComplex';
  });
}
