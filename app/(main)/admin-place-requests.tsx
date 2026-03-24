import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoryContext';
import { useStores, Store } from '../../context/StoreContext';
import { api, PlaceData } from '../../api/client';
import { LAYOUT } from '../../constants/layout';
import { shadow } from '../../utils/shadowStyles';

function catEmoji(cats: { name: string; emoji: string }[], name: string) {
  return cats.find((c) => c.name === name)?.emoji || '📍';
}

function catColor(cats: { name: string; color: string }[], name: string) {
  return cats.find((c) => c.name === name)?.color || '#2E86AB';
}

function showMessage(title: string, message: string) {
  if (typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

function confirmAction(title: string, message: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`${title}\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'إلغاء', style: 'cancel', onPress: () => resolve(false) },
      { text: 'تأكيد', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  active: 'مفعّل',
  rejected: 'مرفوض',
};

/** حالة الطلب كما تُعرَّف في الـ API؛ أي قيمة غير صريحة تُعامل كمعلّق للمراجعة */
function normalizePlaceStatus(raw: unknown): 'pending' | 'active' | 'rejected' {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (s === 'active' || s === 'rejected' || s === 'pending') return s;
  return 'pending';
}

function toCoord(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function storeToPlaceData(s: Store): PlaceData {
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

export default function AdminPlaceRequestsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { categories } = useCategories();
  const { stores, loading, refreshStores } = useStores();

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const places = useMemo(() => stores.map(storeToPlaceData), [stores]);

  useFocusEffect(
    useCallback(() => {
      void refreshStores();
    }, [refreshStores])
  );

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

  const filtered = (statusFilter === 'all'
    ? places
    : places.filter((p) => normalizePlaceStatus(p.status) === statusFilter)
  ).filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      p.type_name.toLowerCase().includes(q);
  });

  const handleAccept = async (place: PlaceData) => {
    try {
      await api.updatePlace(place.id, { status: 'active' });
      await refreshStores();
      showMessage('✅ تم', 'تم تفعيل المكان');
    } catch (e: any) {
      showMessage('خطأ', e?.message || 'فشل التفعيل');
    }
  };

  const handleReject = async (place: PlaceData) => {
    const confirmed = await confirmAction(
      'رفض وحذف الطلب',
      `سيتم حذف طلب «${place.name}» نهائياً من قاعدة البيانات. المتابعة؟`
    );
    if (!confirmed) return;
    try {
      await api.deletePlace(place.id);
      await refreshStores();
      showMessage('تم', 'تم رفض الطلب وحذفه');
    } catch (e: any) {
      showMessage('خطأ', e?.message || 'فشل');
    }
  };

  const handleDelete = async (place: PlaceData) => {
    const confirmed = await confirmAction('حذف المكان', `حذف "${place.name}" نهائياً؟`);
    if (!confirmed) return;
    try {
      await api.deletePlace(place.id);
      await refreshStores();
      showMessage('تم', 'تم حذف المكان');
    } catch (e: any) {
      showMessage('خطأ', e?.message || 'فشل الحذف');
    }
  };

  const pendingCount = places.filter((p) => normalizePlaceStatus(p.status) === 'pending').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>طلبات إضافة الأماكن</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{pendingCount} قيد الانتظار</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <TextInput
            style={styles.searchBar}
            placeholder="بحث في الأماكن..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign="right"
          />
          <TouchableOpacity style={styles.refreshBtn} onPress={() => void refreshStores()}>
            <Text style={styles.refreshBtnText}>🔄</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
          {(['pending', 'active', 'rejected', 'all'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                {s === 'all' ? 'الكل' : STATUS_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color="#2E86AB" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>{searchQuery.trim() ? '🔍' : '📋'}</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery.trim()
                ? 'لا توجد نتائج للبحث'
                : statusFilter === 'all'
                  ? 'لا توجد أماكن'
                  : `لا توجد أماكن ${STATUS_LABELS[statusFilter] ?? ''}`}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {filtered.map((place) => {
              const phone = place.attributes?.find(a => a.key === 'phone')?.value;
              const st = normalizePlaceStatus(place.status);
              const isPending = st === 'pending';
              const typeColor = catColor(categories, place.type_name);
              return (
                <View key={place.id} style={[styles.requestCard, isPending && styles.requestCardPending]}>
                  <View style={styles.cardTop}>
                    <View style={[styles.typeIconCircle, { backgroundColor: typeColor + '22' }]}>
                      <Text style={styles.typeIconEmoji}>{catEmoji(categories, place.type_name)}</Text>
                    </View>
                    <View style={styles.cardMain}>
                      <View style={styles.requestHeader}>
                        <Text style={styles.requestName} numberOfLines={2}>{place.name}</Text>
                        <View style={[
                          styles.statusBadge,
                          st === 'pending' && styles.statusPending,
                          st === 'active' && styles.statusAccepted,
                          st === 'rejected' && styles.statusRejected,
                        ]}>
                          <Text style={styles.statusText}>{STATUS_LABELS[st] || place.status}</Text>
                        </View>
                      </View>
                      {place.description ? (
                        <Text style={styles.requestDesc} numberOfLines={2}>{place.description}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.chipsRow}>
                    <View style={[styles.chip, { borderColor: typeColor + '55' }]}>
                      <Text style={[styles.chipText, { color: typeColor }]}>{place.type_name}</Text>
                    </View>
                    {phone ? (
                      <View style={styles.chip}>
                        <Text style={styles.chipTextMuted} selectable>📞 {phone}</Text>
                      </View>
                    ) : null}
                    <View style={styles.chipMuted}>
                      <Text style={styles.chipCoords} selectable>
                        📌 {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actionSection}>
                    {isPending ? (
                      <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.actionBtn, styles.actionAccept]} onPress={() => void handleAccept(place)} activeOpacity={0.85}>
                          <Text style={styles.actionBtnTextLight}>✓ تفعيل</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.actionReject]} onPress={() => void handleReject(place)} activeOpacity={0.85}>
                          <Text style={styles.actionBtnTextDanger}>✕ رفض</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionEdit]}
                        onPress={() =>
                          router.push({
                            pathname: '/(main)/admin-stores',
                            params: { editStoreId: place.id },
                          })
                        }
                        activeOpacity={0.85}
                      >
                        <Text style={styles.actionBtnTextEdit}>✎ تعديل</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.actionDelete]} onPress={() => void handleDelete(place)} activeOpacity={0.85}>
                        <Text style={styles.actionBtnTextDanger}>🗑 حذف</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unauthorizedText: { fontSize: 20, color: '#EF4444', marginBottom: 16 },
  backLink: { color: '#2E86AB', fontSize: 16 },
  header: { backgroundColor: '#1A3A5C', paddingTop: LAYOUT.headerTop, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginRight: 12 },
  headerBadge: { backgroundColor: '#F59E0B', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: 16, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 12 },
  searchBar: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minHeight: 42,
  },
  refreshBtn: { backgroundColor: '#2E86AB', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, minHeight: 42, justifyContent: 'center' },
  refreshBtnText: { fontSize: 18 },
  filterScroll: { marginBottom: 16, maxHeight: 48 },
  filterRow: { flexDirection: 'row-reverse', gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  filterChip: { backgroundColor: '#E5E7EB', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, minHeight: 38, justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#2E86AB' },
  filterChipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 32, paddingTop: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateEmoji: { fontSize: 60, marginBottom: 16 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16, marginBottom: 16, textAlign: 'center' },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    ...shadow({ offset: { width: 0, height: 3 }, opacity: 0.07, radius: 10, elevation: 3 }),
  },
  requestCardPending: {
    borderWidth: 2,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  cardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 14,
  },
  typeIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconEmoji: { fontSize: 26 },
  cardMain: { flex: 1, minWidth: 0 },
  requestHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
  },
  requestName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'right',
    flex: 1,
    lineHeight: 24,
  },
  requestDesc: { fontSize: 14, color: '#6B7280', textAlign: 'right', marginTop: 6, lineHeight: 20 },
  chipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    maxWidth: '100%',
  },
  chipMuted: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipText: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
  chipTextMuted: { fontSize: 12, color: '#4B5563', fontWeight: '600', textAlign: 'right' },
  chipCoords: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, flexShrink: 0 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusAccepted: { backgroundColor: '#DCFCE7' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '800', color: '#374151' },
  actionSection: { marginTop: 16, gap: 10 },
  actionRow: { flexDirection: 'row-reverse', gap: 10 },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  actionAccept: {
    backgroundColor: '#10B981',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.2, radius: 4, elevation: 2 }),
  },
  actionReject: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
  actionEdit: { backgroundColor: '#EBF5FB', borderWidth: 1.5, borderColor: '#2E86AB' },
  actionDelete: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  actionBtnTextLight: { fontSize: 14, fontWeight: '800', color: '#fff' },
  actionBtnTextDanger: { fontSize: 14, fontWeight: '800', color: '#B91C1C' },
  actionBtnTextEdit: { fontSize: 14, fontWeight: '800', color: '#2E86AB' },
});
