import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AdminStats, api, ApiResponse } from '../../api/client';
import { AdminScreenIcon } from '../../components/admin/AdminScreenIcon';
import type { AdminDashboardIconName } from '../../components/admin/adminScreenIconTypes';
import { LAYOUT } from '../../constants/layout';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePlacesStore } from '../../stores/usePlacesStore';
import { normalizePlaceTypeKind } from '../../utils/placeTypeLabels';
import { shadow } from '../../utils/shadowStyles';

type StatCardDef = {
  label: string;
  value: string | number;
  icon: AdminDashboardIconName;
  webGlyph: string;
  iconColor: string;
  iconBg: string;
  alertWhenPositive?: boolean;
  onPress: () => void;
};

export default function AdminScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editStoreId?: string }>();
  const { user, logout, init } = useAuthStore();
  const { places, loadAll } = usePlacesStore();
  const stores = useMemo(
    () =>
      places.map((p) => ({
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
      })),
    [places]
  );
  const activePlacesCount = useMemo(
    () => stores.filter((s) => String(s.status || '').toLowerCase() === 'active').length,
    [stores]
  );
  const activeTypeCounts = useMemo(() => {
    const out = {
      house: 0,
      store: 0,
      residentialComplex: 0,
      commercialComplex: 0,
      other: 0,
    };
    for (const s of stores) {
      if (String(s.status || '').toLowerCase() !== 'active') continue;
      const kind = normalizePlaceTypeKind(String((s as any).category || ''));
      if (kind === 'house') out.house += 1;
      else if (kind === 'store') out.store += 1;
      else if (kind === 'residentialComplex') out.residentialComplex += 1;
      else if (kind === 'commercialComplex') out.commercialComplex += 1;
      else out.other += 1;
    }
    return out;
  }, [stores]);

  // Hydrate Zustand auth and load places for admin dashboards.
  useEffect(() => {
    void init();
  }, []);

  useEffect(() => {
    void loadAll(true);
  }, []);
  const [stats, setStats] = useState<Partial<AdminStats>>({});
  const [mainCategoriesCount, setMainCategoriesCount] = useState<number>(0);
  const statCards: StatCardDef[] = useMemo(
    () => [
      {
        label: 'المنازل',
        value: activeTypeCounts.house,
        icon: 'home',
        webGlyph: '🏠',
        iconColor: '#0369A1',
        iconBg: '#E0F2FE',
        onPress: () => router.push('/(main)/admin-stores?kind=house'),
      },
      {
        label: 'المتاجر',
        value: activeTypeCounts.store,
        icon: 'storefront',
        webGlyph: '🏪',
        iconColor: '#C2410C',
        iconBg: '#FFEDD5',
        onPress: () => router.push('/(main)/admin-stores?kind=store'),
      },
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
        label: 'أماكن أخرى',
        value: activeTypeCounts.other,
        icon: 'place',
        webGlyph: '📍',
        iconColor: '#4B5563',
        iconBg: '#F3F4F6',
        onPress: () => router.push('/(main)/admin-stores?kind=other'),
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
        label: 'التصنيفات الرئيسية',
        value: mainCategoriesCount,
        icon: 'category',
        webGlyph: '🏷️',
        iconColor: '#B45309',
        iconBg: '#FEF3C7',
        onPress: () => router.push('/(main)/admin-main-categories'),
      },
      {
        label: 'المستخدمون',
        value: stats.users ?? '-',
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
      mainCategoriesCount,
      router,
      stats.places,
      stats.pendingPlaceRequests,
      stats.pendingReports,
      stats.users,
    ]
  );

  useEffect(() => {
    if (!user?.isAdmin) return;
    const id = params.editStoreId;
    if (id) {
      router.replace({ pathname: '/(main)/admin-stores', params: { editStoreId: id } });
    }
  }, [user?.isAdmin, params.editStoreId, router]);

  useEffect(() => {
    if (user?.isAdmin) {
      api
        .getAdminStats()
        .then((res: ApiResponse<AdminStats>) => {
          if (res?.data && typeof res.data === 'object') setStats(res.data);
        })
        .catch(() => {});
    }
  }, [user?.isAdmin]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    api
      .getProductMainCategories()
      .then((res) => {
        const list = res?.data ?? [];
        setMainCategoriesCount(Array.isArray(list) ? list.length : 0);
      })
      .catch(() => setMainCategoriesCount(0));
  }, [user?.isAdmin]);

  if (!user?.isAdmin) {
    return (
      <View style={styles.unauthorized}>
        <Text style={styles.unauthorizedText}>⛔ غير مصرح لك بالوصول</Text>
        <TouchableOpacity onPress={() => router.replace('/(main)/map')}>
          <Text style={styles.backLink}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          لوحة الإدارة
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(main)/map')} accessibilityRole="button" accessibilityLabel="العودة للخريطة">
          <AdminScreenIcon name="arrow-forward" size={22} color="#fff" webGlyph="→" />
        </TouchableOpacity>
        <View style={styles.headerBadge}>
          <AdminScreenIcon name="verified-user" size={14} color="#fff" webGlyph="👑" />
          <Text style={styles.headerBadgeText}>مدير</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsSection}>
          <Text style={styles.statsTitle}>ملخص الإحصائيات</Text>
          <View style={styles.statsGrid}>
            {statCards.map((card) => {
              const n = typeof card.value === 'number' ? card.value : Number(card.value);
              const showAlert = card.alertWhenPositive && Number.isFinite(n) && n > 0;
              return (
                <TouchableOpacity
                  key={card.label}
                  style={[styles.statCard, showAlert && styles.statCardAlert]}
                  onPress={card.onPress}
                  activeOpacity={0.7}
                >
                  {showAlert ? <View style={styles.statAlertDot} /> : null}
                  <View style={[styles.statIconWrap, { backgroundColor: card.iconBg }]}>
                    <AdminScreenIcon name={card.icon} size={24} color={card.iconColor} webGlyph={card.webGlyph} />
                  </View>
                  <Text style={styles.statNumber}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>الإدارة</Text>
          <View style={styles.menuGridRow}>
            <TouchableOpacity style={styles.menuGridCell} onPress={() => router.push('/(main)/admin-activity')} activeOpacity={0.7}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <AdminScreenIcon name="history" size={26} color="#2563EB" webGlyph="📋" />
              </View>
              <Text style={styles.menuGridCellText}>سجل النشاط</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuGridCell} onPress={() => router.push('/(main)/admin-categories')} activeOpacity={0.7}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#FFFBEB' }]}>
                <AdminScreenIcon name="label" size={26} color="#D97706" webGlyph="🏷️" />
              </View>
              <Text style={styles.menuGridCellText}>أنواع الأماكن</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.menuGridRow}>
            <TouchableOpacity style={styles.menuGridCell} onPress={() => router.push('/(main)/admin-settings')} activeOpacity={0.7}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#F5F3FF' }]}>
                <AdminScreenIcon name="settings" size={26} color="#7C3AED" webGlyph="⚙️" />
              </View>
              <Text style={styles.menuGridCellText}>الإعدادات</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuGridCell} onPress={() => router.push('/(main)/admin-backup')} activeOpacity={0.7}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#F3E8FF' }]}>
                <AdminScreenIcon name="cloud-download" size={26} color="#9333EA" webGlyph="💾" />
              </View>
              <Text style={styles.menuGridCellText}>النسخ الاحتياطي</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.menuGridRow}>
            <TouchableOpacity
              style={[styles.menuGridCell, { flex: 1, marginHorizontal: 6 }]}
              onPress={() => router.push('/(main)/admin-classification-tree')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <AdminScreenIcon name="account-tree" size={26} color="#059669" webGlyph="🌳" />
              </View>
              <Text style={styles.menuGridCellText}>شجرة التصنيفات</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => { logout(); router.replace('/(main)/map'); }} activeOpacity={0.85}>
            <AdminScreenIcon name="logout" size={22} color="#fff" webGlyph="🚪" />
            <Text style={styles.logoutBtnText}>تسجيل الخروج</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8EEF2' },
  unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unauthorizedText: { fontSize: 20, color: '#EF4444', marginBottom: 16 },
  backLink: { color: '#2E86AB', fontSize: 16 },
  header: {
    backgroundColor: '#1A3A5C',
    paddingTop: LAYOUT.headerTop,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'right' },
  headerBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.15, radius: 6, elevation: 4 }),
  },
  logoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statsSection: { paddingHorizontal: 16, paddingTop: 16 },
  statsTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 10, textAlign: 'right' },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 124,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.1, radius: 8, elevation: 4 }),
  },
  statCardAlert: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFBFB',
  },
  statAlertDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: { fontSize: 28, fontWeight: '800', color: '#1A3A5C', textAlign: 'center' },
  statLabel: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center', lineHeight: 18 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  menuSection: { paddingHorizontal: 16, marginTop: 14 },
  menuTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12, textAlign: 'right' },
  menuGridRow: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    paddingTop: 0,
    marginBottom: 10,
    alignItems: 'stretch',
  },
  menuGridCell: {
    flex: 1,
    marginHorizontal: 6,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 10,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4, elevation: 2 }),
  },
  menuIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  menuGridCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});
