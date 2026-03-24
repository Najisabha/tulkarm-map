import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../api/client';
import { USE_API } from '../../api/config';
import { useAuth } from '../../context/AuthContext';
import { useStores } from '../../context/StoreContext';
import { useCategories } from '../../context/CategoryContext';
import { LAYOUT } from '../../constants/layout';
import { shadow } from '../../utils/shadowStyles';

export default function AdminScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editStoreId?: string }>();
  const { user, logout } = useAuth();
  const { categories } = useCategories();
  const { stores, placeRequests } = useStores();
  const [stats, setStats] = useState<{
    users?: number;
    pendingReports?: number;
    storesThisMonth?: number;
    requestsThisWeek?: number;
  }>({});

  useEffect(() => {
    if (!user?.isAdmin) return;
    const id = params.editStoreId;
    if (id) {
      router.replace({ pathname: '/(main)/admin-stores', params: { editStoreId: id } });
    }
  }, [user?.isAdmin, params.editStoreId]);

  useEffect(() => {
    if (USE_API && user?.isAdmin) {
      api.getAdminStats().then(setStats).catch(() => {});
    }
  }, [USE_API, user?.isAdmin]);

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

  const pendingPlaceRequests = placeRequests.filter((r) => r.status === 'pending').length;

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
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-stores')} activeOpacity={0.7}>
            <Text style={styles.statNumber}>{stores.length}</Text>
            <Text style={styles.statLabel}>إجمالي المتاجر</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-categories')} activeOpacity={0.7}>
            <Text style={styles.statNumber}>{categories.length}</Text>
            <Text style={styles.statLabel}>الفئات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-place-requests')} activeOpacity={0.7}>
            <Text style={styles.statNumber}>{pendingPlaceRequests}</Text>
            <Text style={styles.statLabel}>طلبات الأماكن</Text>
          </TouchableOpacity>
        </View>

        {USE_API && (
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-users')} activeOpacity={0.7}>
              <Text style={styles.statNumber}>{stats.users ?? '-'}</Text>
              <Text style={styles.statLabel}>المستخدمون</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(main)/admin-reports')} activeOpacity={0.7}>
              <Text style={styles.statNumber}>{stats.pendingReports ?? '-'}</Text>
              <Text style={styles.statLabel}>الإبلاغات</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statCard} activeOpacity={0.7}>
              <Text style={styles.statNumber}>{stats.storesThisMonth ?? '-'}</Text>
              <Text style={styles.statLabel}>متاجر هذا الشهر</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>الإدارة</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(main)/admin-users')}>
            <Text style={styles.menuItemText}>👥 إدارة المستخدمين</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(main)/admin-reports')}>
            <Text style={styles.menuItemText}>⚠️ الإبلاغات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(main)/admin-activity')}>
            <Text style={styles.menuItemText}>📋 سجل النشاط</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(main)/admin-settings')}>
            <Text style={styles.menuItemText}>⚙️ الإعدادات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(main)/admin-backup')}>
            <Text style={styles.menuItemText}>💾 النسخ الاحتياطي</Text>
          </TouchableOpacity>
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
    padding: 20,
    alignItems: 'flex-start',
  },
  statCard: {
    flex: 1,
    marginHorizontal: 6,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: 110,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.1, radius: 8, elevation: 4 }),
  },
  statNumber: { fontSize: 36, fontWeight: '800', color: '#2E86AB', textAlign: 'center' },
  statLabel: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  menuSection: { paddingHorizontal: 20, marginTop: 8 },
  menuTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12, textAlign: 'right' },
  menuItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4, elevation: 2 }),
  },
  menuItemText: { fontSize: 15, fontWeight: '600', color: '#374151', textAlign: 'right' },
});
