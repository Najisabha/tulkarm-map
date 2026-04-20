/**
 * منطق شاشة طلبات إضافة الأماكن:
 * - تحويل stores إلى requests
 * - الفلترة والبحث
 * - القبول/الرفض/الحذف
 */

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api, type PlaceData } from '../../api/client';
import { confirmAction, showMessage } from '../../utils/admin/feedback';
import {
  normalizePlaceStatus,
  storeToPlaceData,
  type PlaceRequestFilter,
} from '../../utils/admin/placeRequestsHelpers';
import type { Store } from '../../context/StoreContext';

export function useAdminPlaceRequests(params: {
  stores: Store[];
  refreshStores: () => Promise<void>;
}) {
  const { stores, refreshStores } = params;

  const [statusFilter, setStatusFilter] = useState<PlaceRequestFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const places = useMemo(() => stores.map(storeToPlaceData), [stores]);

  useFocusEffect(
    useCallback(() => {
      void refreshStores();
    }, [refreshStores]),
  );

  const filteredPlaces = useMemo(
    () =>
      (statusFilter === 'all'
        ? places
        : places.filter((p) => normalizePlaceStatus(p.status) === statusFilter)
      ).filter((p) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          p.type_name.toLowerCase().includes(q)
        );
      }),
    [places, searchQuery, statusFilter],
  );

  const pendingCount = useMemo(
    () => places.filter((p) => normalizePlaceStatus(p.status) === 'pending').length,
    [places],
  );

  const handleAccept = useCallback(
    async (place: PlaceData) => {
      try {
        await api.updatePlace(place.id, { status: 'active' });
        await refreshStores();
        showMessage('✅ تم', 'تم تفعيل المكان');
      } catch (e: any) {
        showMessage('خطأ', e?.message || 'فشل التفعيل');
      }
    },
    [refreshStores],
  );

  const handleReject = useCallback(
    async (place: PlaceData) => {
      const confirmed = await confirmAction(
        'رفض وحذف الطلب',
        `سيتم حذف طلب «${place.name}» نهائياً من قاعدة البيانات. المتابعة؟`,
      );
      if (!confirmed) return;
      try {
        await api.deletePlace(place.id);
        await refreshStores();
        showMessage('تم', 'تم رفض الطلب وحذفه');
      } catch (e: any) {
        showMessage('خطأ', e?.message || 'فشل');
      }
    },
    [refreshStores],
  );

  const handleDelete = useCallback(
    async (place: PlaceData) => {
      const confirmed = await confirmAction('حذف المكان', `حذف "${place.name}" نهائياً؟`);
      if (!confirmed) return;
      try {
        await api.deletePlace(place.id);
        await refreshStores();
        showMessage('تم', 'تم حذف المكان');
      } catch (e: any) {
        showMessage('خطأ', e?.message || 'فشل الحذف');
      }
    },
    [refreshStores],
  );

  return {
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    filteredPlaces,
    pendingCount,
    handleAccept,
    handleReject,
    handleDelete,
  };
}

