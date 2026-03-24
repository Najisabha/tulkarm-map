import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../../api/client';
import { USE_API } from '../../api/config';
import { LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { shadow } from '../../utils/shadowStyles';

const ACTION_LABELS: Record<string, string> = {
  add: 'إضافة',
  update: 'تعديل',
  delete: 'حذف',
  accept: 'قبول',
  reject: 'رفض',
};

const ENTITY_LABELS: Record<string, string> = {
  category: 'فئة',
  store: 'متجر',
  place_request: 'طلب مكان',
};

interface LogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: { name?: string };
  createdAt: string;
}

export default function AdminActivityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_API) loadActivity();
    else setLoading(false);
  }, []);

  const loadActivity = async () => {
    try {
      const list = await api.getActivityLog();
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
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

  if (!USE_API) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>سجل النشاط</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>يتطلب اتصال الخادم</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل النشاط</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadActivity}>
          <Text style={styles.refreshBtnText}>🔄 تحديث</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.listContent}>
        {loading ? (
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        ) : entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📋</Text>
            <Text style={styles.emptyStateText}>لا يوجد سجل نشاط بعد</Text>
          </View>
        ) : (
          entries.map((e) => (
            <View key={e.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.logAction}>
                  {ACTION_LABELS[e.action] || e.action} {ENTITY_LABELS[e.entityType] || e.entityType}
                </Text>
                <Text style={styles.logDate}>{new Date(e.createdAt).toLocaleString('ar')}</Text>
              </View>
              {e.details?.name && (
                <Text style={styles.logDetails}>{e.details.name}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
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
  refreshBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  refreshBtnText: { color: '#fff', fontSize: 13 },
  content: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 24 },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4, elevation: 2 }),
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logAction: { fontSize: 14, fontWeight: '600', color: '#1F2937', textAlign: 'right' },
  logDate: { fontSize: 12, color: '#9CA3AF' },
  logDetails: { fontSize: 13, color: '#6B7280', marginTop: 6, textAlign: 'right' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyStateEmoji: { fontSize: 48, marginBottom: 12 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16 },
});
