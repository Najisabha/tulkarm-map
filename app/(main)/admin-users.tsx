import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, loadTokens, ApiResponse, UserData } from '../../api/client';
import { LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { shadow } from '../../utils/shadowStyles';

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  created_at: string;
}

const DEFAULT_ADMIN_EMAIL = 'admin@tulkarm.com';

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

function userBadgeCount(n: number): string {
  if (n === 0) return 'لا مستخدمين';
  if (n === 1) return 'مستخدم واحد';
  if (n === 2) return 'مستخدمان';
  if (n >= 3 && n <= 10) return `${n} مستخدمين`;
  return `${n} مستخدماً`;
}

function avatarLetter(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return t.charAt(0).toUpperCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminUsersScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.isAdmin) {
      setLoading(false);
      return;
    }
    loadUsers();
  }, [authLoading, user?.isAdmin]);

  const loadUsers = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      await loadTokens();
      const res = (await api.getUsers()) as ApiResponse<UserData[]> & { users?: UserData[] };
      const raw = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.users)
          ? res.users
          : [];

      setUsers(
        raw.map((u) => ({
          ...u,
          role: u.role || 'user',
          isAdmin: u.role === 'admin',
        })) as ApiUser[]
      );
    } catch (e: unknown) {
      setUsers([]);
      setLoadError(e instanceof Error ? e.message : 'فشل تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (u: ApiUser) => {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
  };

  const closeEdit = () => {
    setEditUser(null);
    setEditName('');
    setEditEmail('');
    setSavingEdit(false);
  };

  const saveEdit = async () => {
    if (!editUser) return;
    const name = editName.trim();
    const email = editEmail.trim().toLowerCase();
    if (!name) {
      showMessage('تنبيه', 'يرجى إدخال الاسم');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      showMessage('تنبيه', 'صيغة البريد غير صحيحة');
      return;
    }
    const isDefault = editUser.email.toLowerCase() === DEFAULT_ADMIN_EMAIL;
    const payload: { name?: string; email?: string } = {};
    if (name !== editUser.name) payload.name = name;
    if (!isDefault && email !== editUser.email.toLowerCase()) payload.email = email;
    if (isDefault && email !== editUser.email.toLowerCase()) {
      showMessage('تنبيه', 'لا يمكن تغيير بريد المدير الافتراضي');
      return;
    }
    if (Object.keys(payload).length === 0) {
      closeEdit();
      return;
    }
    setSavingEdit(true);
    try {
      await api.updateUser(editUser.id, payload);
      setUsers((prev) =>
        prev.map((x) =>
          x.id === editUser.id ? { ...x, name, email: isDefault ? x.email : email } : x
        )
      );
      showMessage('تم', 'تم حفظ التعديلات');
      closeEdit();
    } catch (e: unknown) {
      showMessage('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleAdmin = async (u: ApiUser) => {
    if (u.email === DEFAULT_ADMIN_EMAIL) return;
    try {
      const newRole = u.isAdmin ? 'user' : 'admin';
      await api.updateUser(u.id, { role: newRole });
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, role: newRole, isAdmin: newRole === 'admin' } : x))
      );
      showMessage('تم', u.isAdmin ? 'تم إلغاء صلاحية المدير' : 'تم ترقية المستخدم لمدير');
    } catch (e: unknown) {
      showMessage('خطأ', e instanceof Error ? e.message : 'فشل التحديث');
    }
  };

  const handleDelete = async (u: ApiUser) => {
    if (u.email === DEFAULT_ADMIN_EMAIL) {
      showMessage('تنبيه', 'لا يمكن حذف حساب المدير الافتراضي');
      return;
    }
    const ok = await confirmAction('حذف المستخدم', `حذف "${u.name}" نهائياً؟`);
    if (!ok) return;
    try {
      await api.deleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      showMessage('تم', 'تم حذف المستخدم');
    } catch (e: unknown) {
      showMessage('خطأ', e instanceof Error ? e.message : 'فشل الحذف');
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

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

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : users;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة المستخدمين</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{userBadgeCount(users.length)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="بحث بالاسم أو البريد..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign="right"
          />
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color="#2E86AB" />
            <Text style={styles.loadingText}>جاري تحميل المستخدمين...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Text style={styles.errorHint}>تأكد أن الخادم يعمل ومسار /api/users متاحاً</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadUsers}>
              <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {filtered.map((u) => {
              const isDefault = u.email.toLowerCase() === DEFAULT_ADMIN_EMAIL;
              return (
                <View key={u.id} style={styles.userCard}>
                  <View style={styles.cardTop}>
                    <View style={[styles.avatar, u.isAdmin && styles.avatarAdmin]}>
                      <Text style={styles.avatarText}>{avatarLetter(u.name)}</Text>
                    </View>
                    <View style={styles.cardMain}>
                      <View style={styles.nameRow}>
                        <Text style={styles.userName} numberOfLines={2}>
                          {u.name}
                        </Text>
                        {u.isAdmin ? (
                          <View style={styles.rolePill}>
                            <Text style={styles.rolePillText}>مدير</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.userEmail} selectable>
                        {u.email}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.btn, styles.btnEdit]} onPress={() => openEdit(u)} activeOpacity={0.85}>
                      <Text style={styles.btnEditText}>✎ تعديل البيانات</Text>
                    </TouchableOpacity>
                    {!isDefault ? (
                      <>
                        <TouchableOpacity
                          style={[styles.btn, u.isAdmin ? styles.btnDemote : styles.btnPromote]}
                          onPress={() => void toggleAdmin(u)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.btnMutedText}>{u.isAdmin ? 'إلغاء المدير' : 'ترقية لمدير'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={() => void handleDelete(u)} activeOpacity={0.85}>
                          <Text style={styles.btnDeleteText}>حذف</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <Modal visible={!!editUser} animationType="slide" transparent onRequestClose={closeEdit}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={LAYOUT.keyboardBehavior} style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeEdit} disabled={savingEdit}>
                <Text style={styles.modalCancel}>إلغاء</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تعديل المستخدم</Text>
              <TouchableOpacity onPress={() => void saveEdit()} disabled={savingEdit}>
                {savingEdit ? (
                  <ActivityIndicator color="#2E86AB" />
                ) : (
                  <Text style={styles.modalSave}>حفظ</Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>الاسم</Text>
              <TextInput
                style={styles.fieldInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="الاسم الكامل"
                placeholderTextColor="#9CA3AF"
                textAlign="right"
              />
              <Text style={styles.fieldLabel}>البريد الإلكتروني</Text>
              <TextInput
                style={[styles.fieldInput, editUser?.email.toLowerCase() === DEFAULT_ADMIN_EMAIL && styles.fieldDisabled]}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="example@mail.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={editUser?.email.toLowerCase() !== DEFAULT_ADMIN_EMAIL}
                textAlign="right"
              />
              {editUser?.email.toLowerCase() === DEFAULT_ADMIN_EMAIL ? (
                <Text style={styles.fieldHint}>بريد المدير الافتراضي ثابت لأسباب أمنية.</Text>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8EEF2' },
  centered: { alignItems: 'center', justifyContent: 'center' },
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
  searchWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4, elevation: 2 }),
  },
  searchIcon: { fontSize: 18, marginLeft: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 48,
  },
  loadingBlock: { alignItems: 'center', paddingTop: 48, gap: 12 },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 8, fontSize: 15 },
  errorState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  errorText: { fontSize: 16, color: '#EF4444', textAlign: 'center', marginBottom: 8 },
  errorHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#2E86AB', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    ...shadow({ offset: { width: 0, height: 3 }, opacity: 0.07, radius: 10, elevation: 3 }),
  },
  cardTop: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EBF5FB',
    borderWidth: 2,
    borderColor: '#2E86AB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAdmin: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#1A3A5C' },
  cardMain: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8 },
  userName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'right',
    lineHeight: 24,
  },
  rolePill: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  rolePillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  userEmail: { fontSize: 14, color: '#6B7280', marginTop: 6, textAlign: 'right', lineHeight: 20 },
  actionRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  btn: {
    flexGrow: 1,
    minWidth: '28%',
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  btnEdit: { backgroundColor: '#EBF5FB', borderWidth: 1.5, borderColor: '#2E86AB' },
  btnEditText: { fontSize: 13, fontWeight: '800', color: '#2E86AB' },
  btnPromote: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#A7F3D0' },
  btnDemote: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' },
  btnMutedText: { fontSize: 13, fontWeight: '800', color: '#374151' },
  btnDelete: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  btnDeleteText: { fontSize: 13, fontWeight: '800', color: '#B91C1C' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: LAYOUT.modalHeaderTop,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  modalCancel: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1A3A5C' },
  modalSave: { color: '#2E86AB', fontSize: 16, fontWeight: '800' },
  modalBody: { padding: 20 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'right',
    marginBottom: 8,
    marginTop: 4,
  },
  fieldInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 6,
  },
  fieldDisabled: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  fieldHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginBottom: 8 },
});
