import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../../api/client';
import { USE_API } from '../../api/config';
import { LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { shadow } from '../../utils/shadowStyles';

interface ApiUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (USE_API) loadUsers();
    else setLoading(false);
  }, []);

  const loadUsers = async () => {
    setLoadError(null);
    try {
      const list = await api.getUsers();
      setUsers(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setUsers([]);
      setLoadError(e?.message || 'فشل تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (u: ApiUser) => {
    if (u.email === 'admin@tulkarm.com') return;
    try {
      await api.updateUser(u.id, { isAdmin: !u.isAdmin });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isAdmin: !x.isAdmin } : x)));
      Alert.alert('✅ تم', u.isAdmin ? 'تم إلغاء صلاحية المدير' : 'تم ترقية المستخدم لمدير');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل التحديث');
    }
  };

  const handleDelete = async (u: ApiUser) => {
    if (u.email === 'admin@tulkarm.com') {
      Alert.alert('تنبيه', 'لا يمكن حذف حساب المدير الافتراضي');
      return;
    }
    Alert.alert('حذف المستخدم', `حذف "${u.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteUser(u.id);
            setUsers((prev) => prev.filter((x) => x.id !== u.id));
            Alert.alert('✅ تم', 'تم حذف المستخدم');
          } catch (e: any) {
            Alert.alert('خطأ', e?.message || 'فشل الحذف');
          }
        },
      },
    ]);
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
          <Text style={styles.headerTitle}>إدارة المستخدمين</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>يتطلب اتصال الخادم</Text>
        </View>
      </View>
    );
  }

  const q = searchQuery.trim().toLowerCase();
  const filtered = q ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة المستخدمين</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{users.length} مستخدم</Text>
        </View>
      </View>

      <View style={styles.content}>
        <TextInput
          style={styles.searchInput}
          placeholder="بحث بالاسم أو البريد..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          textAlign="right"
        />
        {loading ? (
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        ) : loadError ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Text style={styles.errorHint}>تأكد أن الخادم محدث ويحتوي على مسار /api/users</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadUsers}>
              <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filtered.map((u) => (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  {u.isAdmin && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>مدير</Text>
                    </View>
                  )}
                </View>
                <View style={styles.userActions}>
                  {u.email !== 'admin@tulkarm.com' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, u.isAdmin ? styles.actionBtnDemote : styles.actionBtnPromote]}
                        onPress={() => toggleAdmin(u)}
                      >
                        <Text style={styles.actionBtnText}>{u.isAdmin ? 'إلغاء المدير' : 'ترقية لمدير'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtnDel} onPress={() => handleDelete(u)}>
                        <Text style={styles.actionBtnTextDel}>حذف</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
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
  headerBadge: { backgroundColor: '#F59E0B', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 24 },
  errorState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  errorText: { fontSize: 16, color: '#EF4444', textAlign: 'center', marginBottom: 8 },
  errorHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#2E86AB', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.08, radius: 6, elevation: 2 }),
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  userEmail: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'right' },
  adminBadge: { backgroundColor: '#F59E0B', alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  adminBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  userActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  actionBtnPromote: { backgroundColor: '#D1FAE5' },
  actionBtnDemote: { backgroundColor: '#FEF3C7' },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  actionBtnDel: { backgroundColor: '#FEE2E2', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  actionBtnTextDel: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { color: '#9CA3AF', fontSize: 16 },
});
