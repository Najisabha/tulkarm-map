/**
 * منطق الفلاتر والعناوين في شاشة إدارة الأماكن.
 * يفصل اشتقاقات العرض عن ملف الشاشة الرئيسي.
 */

import { useMemo, useState } from 'react';
import { normalizePlaceTypeKind } from '../../utils/placeTypeLabels';
import { isActiveStore, isPendingStore } from '../../utils/map/storeStatus';

type KindFilter = 'all' | 'house' | 'store' | 'residentialComplex' | 'commercialComplex' | 'other';
type StatusFilter = 'all' | 'visible' | 'hidden';
type StoreLike = { name?: string; description?: string; category?: string; status?: string | null };

function parseKindFilter(raw?: string | string[]): KindFilter {
  const k = String(raw || 'all');
  if (k === 'house' || k === 'store' || k === 'residentialComplex' || k === 'commercialComplex' || k === 'other') {
    return k;
  }
  return 'all';
}

function matchKind(store: StoreLike, kindFilter: KindFilter): boolean {
  if (kindFilter === 'all') return true;
  return normalizePlaceTypeKind(String(store.category || '')) === kindFilter;
}

export function useAdminStoresFilters<T extends StoreLike>(stores: T[], rawKind?: string | string[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const kindFilter = useMemo(() => parseKindFilter(rawKind), [rawKind]);

  const screenTitle = useMemo(() => {
    if (kindFilter === 'house') return 'إدارة المنازل';
    if (kindFilter === 'store') return 'إدارة المتاجر';
    if (kindFilter === 'residentialComplex') return 'إدارة المجمعات السكنية';
    if (kindFilter === 'commercialComplex') return 'إدارة المجمعات التجارية';
    if (kindFilter === 'other') return 'إدارة الأماكن الأخرى';
    return 'إدارة الأماكن';
  }, [kindFilter]);

  const listTitle = useMemo(() => {
    if (kindFilter === 'house') return 'قائمة المنازل';
    if (kindFilter === 'store') return 'قائمة المتاجر';
    if (kindFilter === 'residentialComplex') return 'قائمة المجمعات السكنية';
    if (kindFilter === 'commercialComplex') return 'قائمة المجمعات التجارية';
    if (kindFilter === 'other') return 'قائمة الأماكن الأخرى';
    return 'قائمة الأماكن';
  }, [kindFilter]);

  const filterSubjectLabel = useMemo(() => {
    if (kindFilter === 'house') return 'المنازل';
    if (kindFilter === 'store') return 'المتاجر';
    if (kindFilter === 'residentialComplex') return 'المجمعات السكنية';
    if (kindFilter === 'commercialComplex') return 'المجمعات التجارية';
    if (kindFilter === 'other') return 'الأماكن الأخرى';
    return 'الأماكن';
  }, [kindFilter]);

  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list: T[] = stores.filter((s) => matchKind(s, kindFilter));
    if (statusFilter !== 'all') {
      list = list.filter((s) => (statusFilter === 'visible' ? isActiveStore(s) : isPendingStore(s)));
    }
    if (!q) return list;
    return list.filter((s) => {
      const name = String(s.name || '').toLowerCase();
      const desc = String(s.description || '').toLowerCase();
      const cat = String(s.category || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || cat.includes(q);
    });
  }, [stores, searchQuery, statusFilter, kindFilter]);

  const visibleCount = useMemo(
    () => stores.filter((s) => matchKind(s, kindFilter) && isActiveStore(s)).length,
    [stores, kindFilter],
  );

  const hiddenCount = useMemo(
    () => stores.filter((s) => matchKind(s, kindFilter) && isPendingStore(s)).length,
    [stores, kindFilter],
  );

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    kindFilter,
    screenTitle,
    listTitle,
    filterSubjectLabel,
    filteredStores,
    visibleCount,
    hiddenCount,
  };
}

