import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, type PlaceData } from '../../api/client';
import { AdminSubHeader } from '../../components/admin/AdminSubHeader';
import { ChangePasswordModal } from '../../components/profile/ChangePasswordModal';
import { ProfileEditModal } from '../../components/profile/ProfileEditModal';
import { useAuthStore } from '../../stores/useAuthStore';
import { normalizePlaceStatus, STATUS_LABELS, type PlaceRequestStatus } from '../../utils/admin/placeRequestsHelpers';
import * as ImagePicker from 'expo-image-picker';

function statusChipStyle(status: PlaceRequestStatus) {
  if (status === 'active') return { bg: '#DCFCE7', color: '#166534' };
  if (status === 'rejected') return { bg: '#FEE2E2', color: '#B91C1C' };
  return { bg: '#FEF3C7', color: '#92400E' };
}

export default function UserModificationsScreen() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuthStore();
  const [items, setItems] = useState<PlaceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarUploadInFlightRef = useRef(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const loadMyPlaces = useCallback(async (isRefresh = false) => {
    if (!user || user.id === 'guest') {
      setLoading(false);
      return;
    }

    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const PAGE_LIMIT = 100;
      let page = 1;
      let totalPages = 1;
      const collected: PlaceData[] = [];

      do {
        const res = await api.getMyPlaces({ page, limit: PAGE_LIMIT });
        const batch = Array.isArray(res?.data) ? res.data : [];
        if (batch.length === 0) break;
        collected.push(...batch);
        totalPages = Math.max(1, res.meta?.totalPages ?? 1);
        page += 1;
      } while (page <= totalPages);

      setItems(collected);
    } catch (err: any) {
      setError(err?.message || 'تعذّر تحميل بيانات التعديلات.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void loadMyPlaces();
  }, [loadMyPlaces]);

  const userPlacesCount = useMemo(() => items.length, [items]);
  const memberSince = useMemo(() => {
    if (!user?.createdAt) return '-';
    const d = new Date(user.createdAt);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
  }, [user?.createdAt]);

  const birthDateDisplay = useMemo(() => {
    const raw = String(user?.dateOfBirth || '').trim();
    if (!raw) return 'غير مضاف بعد';
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    return raw;
  }, [user?.dateOfBirth]);

  const initials = useMemo(() => {
    if (!user?.name?.trim()) return '؟';
    const parts = user.name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0)).join('').toUpperCase();
  }, [user?.name]);

  const pickProfileImage = useCallback(async () => {
    if (!user) return;
    if (avatarUploadInFlightRef.current) return;
    try {
      avatarUploadInFlightRef.current = true;
      setAvatarLoading(true);
      setError(null);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('يجب منح إذن الوصول للصور لتغيير الصورة الشخصية.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        setError('تعذّر قراءة الصورة. حاول صورة أخرى.');
        return;
      }
      const mime = asset.mimeType || 'image/jpeg';
      const upload = await api.uploadBase64(`data:${mime};base64,${asset.base64}`);
      const save = await updateProfile({
        name: user.name,
        phone_number: user.phoneNumber || null,
        date_of_birth: user.dateOfBirth || null,
        id_card_image_url: user.idCardImageUrl || null,
        profile_image_url: upload.data.url,
      });
      if (!save.success) {
        setError(save.message);
      }
    } catch (err: any) {
      setError(err?.message || 'فشل تحديث الصورة الشخصية.');
    } finally {
      avatarUploadInFlightRef.current = false;
      setAvatarLoading(false);
    }
  }, [updateProfile, user]);

  if (!user || user.id === 'guest') {
    return (
      <View style={styles.container}>
        <AdminSubHeader title="تعديلات" onBack={() => router.back()} />
        <View style={styles.centerBox}>
          <Text style={styles.centerTitle}>يجب تسجيل الدخول للوصول إلى التعديلات</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(main)/map')}>
            <Text style={styles.backBtnText}>العودة إلى الخريطة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminSubHeader title="تعديلات" onBack={() => router.back()} badgeText={`${userPlacesCount} مكان`} />

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Pressable
            onPress={() => void pickProfileImage()}
            disabled={avatarLoading}
            style={[styles.avatarWrap, avatarLoading && styles.avatarWrapDisabled]}
          >
            {user.profileImageUrl ? (
              <Image source={{ uri: user.profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              {avatarLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.cameraText}>📷</Text>}
            </View>
          </Pressable>

          <View style={styles.profileMeta}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName}>{user.name || '-'}</Text>
              {user.verificationStatus === 'verified' ? (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>✓</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.profileEmail}>{user.email || '-'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.personalDataBtn} onPress={() => setShowProfileModal(true)}>
          <Text style={styles.personalDataBtnText}>البيانات الشخصية</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userPlacesCount}</Text>
            <Text style={styles.statLabel}>عدد التعديلات</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{memberSince}</Text>
            <Text style={styles.statLabel}>عضو منذ</Text>
          </View>
        </View>

        <View style={styles.profileDetails}>
          <Text style={styles.profileLine}>رقم الهاتف: {user.phoneNumber || 'غير مضاف بعد'}</Text>
          <Text style={styles.profileLine}>
            تاريخ الميلاد: <Text style={styles.profileDateValue}>{birthDateDisplay}</Text>
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2E86AB" />
          <Text style={styles.helperText}>جاري تحميل طلباتك...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadMyPlaces()}>
            <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadMyPlaces(true)} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>لا توجد تعديلات حالياً</Text>
              <Text style={styles.helperText}>عند إضافة مكان جديد سيظهر هنا مباشرة.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = normalizePlaceStatus(item.status);
            const chip = statusChipStyle(status);
            return (
              <View style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
                    <Text style={[styles.statusText, { color: chip.color }]}>{STATUS_LABELS[status]}</Text>
                  </View>
                </View>
                <Text style={styles.itemType} numberOfLines={1}>
                  {item.type_name || 'غير مصنّف'}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.changePasswordBtn} onPress={() => setShowChangePasswordModal(true)}>
          <Text style={styles.changePasswordBtnText}>تغيير كلمة المرور</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => void logout()}>
          <Text style={styles.logoutBtnText}>الخروج من الحساب</Text>
        </TouchableOpacity>
      </View>

      <ProfileEditModal visible={showProfileModal} user={user} onClose={() => setShowProfileModal(false)} />
      <ChangePasswordModal visible={showChangePasswordModal} onClose={() => setShowChangePasswordModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  profileCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { position: 'relative' },
  avatarWrapDisabled: { opacity: 0.75 },
  avatarImage: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#E5E7EB' },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { fontSize: 28, fontWeight: '800', color: '#1D4ED8' },
  cameraBadge: {
    position: 'absolute',
    left: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A3A5C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cameraText: { color: '#fff', fontSize: 12 },
  profileMeta: { flex: 1 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadgeText: { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  profileEmail: { marginTop: 4, color: '#64748B', fontSize: 13 },
  personalDataBtn: {
    marginTop: 14,
    backgroundColor: '#1A3A5C',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  personalDataBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  changePasswordBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    alignItems: 'center',
  },
  changePasswordBtnText: { color: '#1D4ED8', fontSize: 13, fontWeight: '800' },
  logoutBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutBtnText: { color: '#DC2626', fontSize: 13, fontWeight: '800' },
  statsRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  statLabel: { marginTop: 3, fontSize: 12, color: '#64748B' },
  profileDetails: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileLine: { fontSize: 13, color: '#334155', marginBottom: 4 },
  profileDateValue: { writingDirection: 'ltr' },
  listContent: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  itemType: { marginTop: 6, color: '#6B7280', fontSize: 13 },
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontWeight: '700', fontSize: 12 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  centerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  helperText: { marginTop: 8, fontSize: 13, color: '#6B7280', textAlign: 'center' },
  errorText: { color: '#B91C1C', textAlign: 'center', fontSize: 14, fontWeight: '600' },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#1A3A5C',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  emptyBox: { paddingTop: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  backBtn: {
    marginTop: 12,
    backgroundColor: '#1A3A5C',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
