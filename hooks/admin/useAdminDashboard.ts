/**
 * لوحة الإدارة: اشتقاق الإحصائيات وبطاقات الواجهة مع عزل منطق التحميل.
 * الهدف: جعل `admin.tsx` ملف عرض فقط وسهل القراءة.
 */
 
import type { Router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import type { AdminStats } from '../../api/client';
import { api } from '../../api/client';
import type { AdminStatCardDef } from '../../components/admin/AdminStatGrid';
import type { Store } from '../../utils/map/storeModel';
import { isActiveStore } from '../../utils/map/storeStatus';
import { normalizePlaceTypeKind } from '../../utils/placeTypeLabels';

type ActiveTypeCounts = {
  residentialComplex: number;
  commercialComplex: number;
};

function countActiveTypes(stores: Store[]): { activePlacesCount: number; activeTypeCounts: ActiveTypeCounts } {
  const out: ActiveTypeCounts = {
    residentialComplex: 0,
    commercialComplex: 0,
  };

  let activePlacesCount = 0;
  for (const s of stores) {
    if (!isActiveStore(s)) continue;
    activePlacesCount += 1;
    const kind = normalizePlaceTypeKind(String(s.category || ''));
    if (kind === 'residentialComplex') out.residentialComplex += 1;
    else if (kind === 'commercialComplex') out.commercialComplex += 1;
  }
  return { activePlacesCount, activeTypeCounts: out };
}
 
export function useAdminDashboard(params: {
  router: Router;
  editStoreId?: string;
  isAdmin: boolean;
  stores: Store[];
}) {
  const { router, editStoreId, isAdmin, stores } = params;
 
  const { activePlacesCount, activeTypeCounts } = useMemo(() => countActiveTypes(stores), [stores]);

  const [stats, setStats] = useState<Partial<AdminStats>>({});

  const statCards: AdminStatCardDef[] = useMemo(
    () => [
      {
        label: 'المجمعات السكنية',
        value: activeTypeCounts.residentialComplex,
        icon: 'apartment',
        webGlyph: '🏢',
        iconColor: '#047857',
        iconBg: '#D1FAE5',
        onPress: () => router.push('/(main)/admin-stores?kind=residentialComplex'),
      },
      {
        label: 'المجمعات التجارية',
        value: activeTypeCounts.commercialComplex,
        icon: 'business',
        webGlyph: '🏬',
        iconColor: '#6D28D9',
        iconBg: '#EDE9FE',
        onPress: () => router.push('/(main)/admin-stores?kind=commercialComplex'),
      },
      {
        label: 'إجمالي الأماكن المنشورة',
        value: stats.places ?? activePlacesCount,
        icon: 'map',
        webGlyph: '🗺️',
        iconColor: '#1D4ED8',
        iconBg: '#DBEAFE',
        onPress: () => router.push('/(main)/admin-stores?kind=all'),
      },
      {
        label: 'المستخدمون',
        value: stats.users ?? 0,
        icon: 'people',
        webGlyph: '👥',
        iconColor: '#0E7490',
        iconBg: '#CFFAFE',
        onPress: () => router.push('/(main)/admin-users'),
      },
      {
        label: 'طلبات إضافة الأماكن',
        value: stats.pendingPlaceRequests ?? 0,
        icon: 'playlist-add',
        webGlyph: '📥',
        iconColor: '#B91C1C',
        iconBg: '#FEE2E2',
        alertWhenPositive: true,
        onPress: () => router.push('/(main)/admin-place-requests'),
      },
      {
        label: 'الإبلاغات',
        value: stats.pendingReports ?? 0,
        icon: 'flag',
        webGlyph: '🚩',
        iconColor: '#BE123C',
        iconBg: '#FFE4E6',
        alertWhenPositive: true,
        onPress: () => router.push('/(main)/admin-reports'),
      },
    ],
    [
      activeTypeCounts,
      activePlacesCount,
      router,
      stats.places,
      stats.pendingPlaceRequests,
      stats.pendingReports,
      stats.users,
    ],
  );
 
  const quickMenuRows = useMemo(
    () => [
      [
        {
          label: 'سجل النشاط',
          icon: 'history' as const,
          webGlyph: '📋',
          iconColor: '#2563EB',
          iconBg: '#EFF6FF',
          onPress: () => router.push('/(main)/admin-activity'),
        },
        {
          label: 'أنواع الأماكن',
          icon: 'label' as const,
          webGlyph: '🏷️',
          iconColor: '#D97706',
          iconBg: '#FFFBEB',
          onPress: () => router.push('/(main)/admin-categories'),
        },
      ],
      [
        {
          label: 'الإعدادات',
          icon: 'settings' as const,
          webGlyph: '⚙️',
          iconColor: '#7C3AED',
          iconBg: '#F5F3FF',
          onPress: () => router.push('/(main)/admin-settings'),
        },
        {
          label: 'شجرة التصنيفات',
          icon: 'account-tree' as const,
          webGlyph: '🌳',
          iconColor: '#059669',
          iconBg: '#ECFDF5',
          onPress: () => router.push('/(main)/admin-classification-tree'),
        },
      ],
    ],
    [router],
  );
 
  useEffect(() => {
    if (!isAdmin) return;
    if (!editStoreId) return;
    router.replace({ pathname: '/(main)/admin-stores', params: { editStoreId } });
  }, [isAdmin, editStoreId, router]);
 
  useEffect(() => {
    if (!isAdmin) return;
    api
      .getAdminStats()
      .then((res) => {
        if (res?.data && typeof res.data === 'object') setStats(res.data);
      })
      .catch(() => {});
  }, [isAdmin]);

  return { statCards, quickMenuRows };
}

