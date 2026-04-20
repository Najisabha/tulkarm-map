import type { PlaceData } from '../../api/client';
import type { Store } from '../../context/StoreContext';

export type PlaceRequestStatus = 'pending' | 'active' | 'rejected';
export type PlaceRequestFilter = 'all' | PlaceRequestStatus;

export interface CategoryItem {
  name: string;
  emoji: string;
  color: string;
}

export const STATUS_LABELS: Record<PlaceRequestStatus, string> = {
  pending: 'قيد الانتظار',
  active: 'مفعّل',
  rejected: 'مرفوض',
};

export function catEmoji(cats: CategoryItem[], name: string) {
  return cats.find((c) => c.name === name)?.emoji || '📍';
}

export function catColor(cats: CategoryItem[], name: string) {
  return cats.find((c) => c.name === name)?.color || '#2E86AB';
}

export function normalizePlaceStatus(raw: unknown): PlaceRequestStatus {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (s === 'active' || s === 'rejected' || s === 'pending') return s;
  return 'pending';
}

function toCoord(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function storeToPlaceData(s: Store): PlaceData {
  const status = normalizePlaceStatus(s.status);
  return {
    id: s.id,
    name: s.name,
    description: s.description || null,
    type_name: s.type_name || s.category,
    type_id: s.type_id || '',
    latitude: toCoord(s.latitude),
    longitude: toCoord(s.longitude),
    status,
    avg_rating: s.avg_rating ?? '0',
    rating_count: Number(s.rating_count ?? 0),
    attributes: s.attributes || [],
    images: s.images || [],
    created_at: s.createdAt,
  };
}
