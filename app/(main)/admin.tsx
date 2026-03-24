import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, AdminStats, ApiResponse } from '../../api/client';
import { LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoryContext';
import { useStores } from '../../context/StoreContext';
import { shadow } from '../../utils/shadowStyles';

export default function AdminScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editStoreId?: string }>();
  const { user, logout } = useAuth();
  const { categories } = useCategories();
  const { stores } = useStores();
  const activePlacesCount = useMemo(
    () => stores.filter((s) => String(s.status || '').toLowerCase() === 'active').length,
    [stores]
  );
  const [stats, setStats] = useState<Partial<AdminStats>>({});

  useEffect(() => {
    if (!user?.isAdmin) return;
    const id = params.editStoreId;
    if (id) {
      router.replace({ pathname: '/(main)/admin-stores', params: { editStoreId: id } });
    }
  }, [user?.isAdmin, params.editStoreId]);

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

  if (!user?.isAdmin) {
    return (
      <View style={styles.unauthorized}>
        <Text style={styles.unauthorizedText}>⛔ غير مصرح لك بالوصول</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة الإدارة</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>👑 مدير</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.statsRow, styles.statsRowFirst]}>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-stores')} activeOpacity={0.7}>
            <Text style={styles.statNumber}>{stats.places ?? activePlacesCount}</Text>
            <Text style={styles.statLabel}>الأماكن المنشورة</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-categories')} activeOpacity={0.7}>
            <Text style={styles.statNumber}>{stats.placeTypes ?? categories.length}</Text>
            <Text style={styles.statLabel}>أنواع الأماكن</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-users')} activeOpacity={0.7}>
            <Text style={styles.statNumber}>{stats.users ?? '-'}</Text>
            <Text style={styles.statLabel}>المستخدمون</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-reports')} activeOpacity={0.7}>
            <Text style={styles.statNumber}>{stats.pendingReports ?? 0}</Text>
            <Text style={styles.statLabel}>الإبلاغات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-place-requests')} activeOpacity={0.7}>
            <Text style={styles.statNumber}>{stats.pendingPlaceRequests ?? 0}</Text>
            <Text style={styles.statLabel}>طلبات إضافة الأماكن</Text>
          </TouchableOpacity>
          <View style={styles.statColumnSpacer} />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>الإدارة</Text>
          <View style={styles.menuGridRow}>
            <TouchableOpacity style={styles.menuGridCell} onPress={() => router.push('/(main)/admin-reports')} activeOpacity={0.7}>
              <Text style={styles.menuGridCellText}>⚠️ الإبلاغات</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuGridCell} onPress={() => router.push('/(main)/admin-activity')} activeOpacity={0.7}>
              <Text style={styles.menuGridCellText}>📋 سجل النشاط</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.menuGridRow}>
            <TouchableOpacity style={styles.menuGridCell} onPress={() => router.push('/(main)/admin-settings')} activeOpacity={0.7}>
              <Text style={styles.menuGridCellText}>⚙️ الإعدادات</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuGridCell} onPress={() => router.push('/(main)/admin-backup')} activeOpacity={0.7}>
              <Text style={styles.menuGridCellText}>💾 النسخ الاحتياطي</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => { logout(); router.replace('/(main)/map'); }}>
            <Text style={styles.logoutBtnText}>🚪 تسجيل الخروج</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.15, radius: 6, elevation: 4 }),
  },
  logoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'stretch',
  },
  statsRowFirst: { paddingTop: 20 },
  statCard: {
    flex: 1,
    marginHorizontal: 6,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.1, radius: 8, elevation: 4 }),
  },
  statColumnSpacer: {
    flex: 1,
    marginHorizontal: 6,
    minHeight: 110,
  },
  statNumber: { fontSize: 36, fontWeight: '800', color: '#2E86AB', textAlign: 'center' },
  statLabel: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  menuSection: { paddingHorizontal: 20, marginTop: 8 },
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
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4, elevation: 2 }),
  },
  menuGridCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});
