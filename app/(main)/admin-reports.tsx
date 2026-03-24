import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../../api/client';
import { LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { shadow } from '../../utils/shadowStyles';

const REASON_LABELS: Record<string, string> = {
  wrong_info: 'معلومات خاطئة',
  closed: 'المكان مغلق',
  duplicate: 'تكرار',
  inappropriate: 'محتوى غير لائق',
  other: 'أخرى',
};

interface Report {
  id: string;
  storeId: string;
  storeName: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
}

export default function AdminReportsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const res = await api.getReports();
      setReports(res.data || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const resolveReport = async (r: Report, status: 'resolved' | 'dismissed') => {
    try {
      await api.updateReport(r.id, { status });
      setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
      Alert.alert('✅ تم', status === 'resolved' ? 'تم حل الإبلاغ' : 'تم تجاهل الإبلاغ');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل التحديث');
    }
  };

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

  const filtered = filter === 'pending' ? reports.filter((r) => r.status === 'pending') : reports;
  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإبلاغات</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{pendingCount} قيد الانتظار</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'pending' && styles.filterBtnActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>قيد الانتظار</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>الكل</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>📋</Text>
                <Text style={styles.emptyStateText}>لا توجد إبلاغات</Text>
              </View>
            ) : (
              filtered.map((r) => (
                <View key={r.id} style={styles.reportCard}>
                  <Text style={styles.reportStore}>{r.storeName || 'مكان محذوف'}</Text>
                  <Text style={styles.reportReason}>{REASON_LABELS[r.reason] || r.reason}</Text>
                  {r.details && <Text style={styles.reportDetails}>{r.details}</Text>}
                  <Text style={styles.reportDate}>{new Date(r.createdAt).toLocaleDateString('ar')}</Text>
                  {r.status === 'pending' && (
                    <View style={styles.reportActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnResolve]}
                        onPress={() => resolveReport(r, 'resolved')}
                      >
                        <Text style={styles.actionBtnText}>حل</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDismiss]}
                        onPress={() => resolveReport(r, 'dismissed')}
                      >
                        <Text style={styles.actionBtnText}>تجاهل</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {r.status !== 'pending' && (
                    <View style={[styles.statusBadge, r.status === 'resolved' ? styles.statusResolved : styles.statusDismissed]}>
                      <Text style={styles.statusText}>{r.status === 'resolved' ? 'تم الحل' : 'تم التجاهل'}</Text>
                    </View>
                  )}
                </View>
              ))
            )}
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
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginRight: 12 },
  headerBadge: { backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  filterRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 16 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#fff', ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.05, radius: 4, elevation: 2 }) },
  filterBtnActive: { backgroundColor: '#2E86AB' },
  filterText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 24 },
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 6, elevation: 2 }),
  },
  reportStore: { fontSize: 16, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  reportReason: { fontSize: 14, color: '#6B7280', marginTop: 4, textAlign: 'right' },
  reportDetails: { fontSize: 13, color: '#9CA3AF', marginTop: 6, textAlign: 'right' },
  reportDate: { fontSize: 12, color: '#9CA3AF', marginTop: 8, textAlign: 'right' },
  reportActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  actionBtnResolve: { backgroundColor: '#D1FAE5' },
  actionBtnDismiss: { backgroundColor: '#F3F4F6' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 8 },
  statusResolved: { backgroundColor: '#D1FAE5' },
  statusDismissed: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateEmoji: { fontSize: 48, marginBottom: 12 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16 },
});
