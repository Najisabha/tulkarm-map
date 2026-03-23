import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useStores } from '../../context/StoreContext';
import { useCategories } from '../../context/CategoryContext';
import { shadow } from '../../utils/shadowStyles';

export default function AdminScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editStoreId?: string }>();
  const { user } = useAuth();
  const { categories } = useCategories();
  const { stores, placeRequests } = useStores();

  useEffect(() => {
    if (!user?.isAdmin) return;
    const id = params.editStoreId;
    if (id) {
      router.replace({ pathname: '/(main)/admin-stores', params: { editStoreId: id } });
    }
  }, [user?.isAdmin, params.editStoreId]);

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
          <Text style={styles.statNumber}>
            {placeRequests.filter((r) => r.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>طلبات الأماكن</Text>
        </TouchableOpacity>
      </View>
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
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
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
});
