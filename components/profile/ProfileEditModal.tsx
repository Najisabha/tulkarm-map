import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../../api/client';
import { type AuthUser, useAuthStore } from '../../stores/useAuthStore';

interface ProfileEditModalProps {
  visible: boolean;
  user: AuthUser;
  onClose: () => void;
}

export function ProfileEditModal({ visible, user, onClose }: ProfileEditModalProps) {
  const { updateProfile } = useAuthStore();
  const [name] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phoneNumber || '');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [idCardImageUrl, setIdCardImageUrl] = useState(user.idCardImageUrl || '');
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);
  const [deletingId, setDeletingId] = useState(false);
  const [showImageActions, setShowImageActions] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPhone(user.phoneNumber || '');
    const rawDob = String(user.dateOfBirth || '').trim();
    const match = rawDob.match(/^(\d{4})-(\d{2})-(\d{2})/);
    setBirthYear(match?.[1] || '');
    setBirthMonth(match?.[2] || '');
    setBirthDay(match?.[3] || '');
    setIdCardImageUrl(user.idCardImageUrl || '');
    setShowImageActions(false);
    setShowImageViewer(false);
    setError(null);
  }, [visible, user]);

  const canSave = useMemo(
    () => user.name.trim().length >= 2 && !saving && !uploadingId && !deletingId,
    [deletingId, saving, uploadingId, user.name]
  );

  const accountStatus = useMemo(() => {
    if (user.verificationStatus === 'verified') {
      return { label: 'موثق', style: styles.accountStatusVerified, textStyle: styles.accountStatusVerifiedText };
    }
    if (user.verificationStatus === 'rejected') {
      return { label: 'مرفوض', style: styles.accountStatusRejected, textStyle: styles.accountStatusRejectedText };
    }
    if (user.verificationStatus === 'pending') {
      return { label: 'قيد الانتظار', style: styles.accountStatusPending, textStyle: styles.accountStatusPendingText };
    }
    return { label: 'قيد الانتظار', style: styles.accountStatusPending, textStyle: styles.accountStatusPendingText };
  }, [user.verificationStatus]);

  const pickIdCardImage = async () => {
    try {
      setError(null);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('يجب منح إذن الوصول للصور لاختيار صورة الهوية.');
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
      setUploadingId(true);
      const upload = await api.uploadBase64(`data:${mime};base64,${asset.base64}`);
      setIdCardImageUrl(upload.data.url);
    } catch (err: any) {
      setError(err?.message || 'فشل رفع صورة الهوية.');
    } finally {
      setUploadingId(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setError(null);
    const y = birthYear.trim();
    const m = birthMonth.trim();
    const d = birthDay.trim();
    const anyDobPart = !!(y || m || d);
    if (anyDobPart) {
      if (!/^\d{4}$/.test(y)) {
        setError('سنة الميلاد يجب أن تكون 4 أرقام.');
        return;
      }
      if (!/^\d{1,2}$/.test(m) || Number(m) < 1 || Number(m) > 12) {
        setError('شهر الميلاد يجب أن يكون بين 1 و 12.');
        return;
      }
      if (!/^\d{1,2}$/.test(d) || Number(d) < 1 || Number(d) > 31) {
        setError('يوم الميلاد يجب أن يكون بين 1 و 31.');
        return;
      }
    }
    const dateOfBirth = anyDobPart
      ? `${y}-${String(Number(m)).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`
      : null;
    setSaving(true);
    const result = await updateProfile({
      name: name.trim(),
      phone_number: phone.trim() || null,
      date_of_birth: dateOfBirth,
      id_card_image_url: idCardImageUrl || null,
      profile_image_url: user.profileImageUrl || null,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    onClose();
  };

  const handleOpenIdImage = () => {
    if (!idCardImageUrl) return;
    setShowImageViewer(true);
    setShowImageActions(false);
  };

  const handleEditIdImage = async () => {
    setShowImageActions(false);
    await pickIdCardImage();
  };

  const deleteIdCardImage = () => {
    const previousImageUrl = idCardImageUrl;
    Alert.alert(
      'تأكيد الحذف',
      'هل أنت متأكد من حذف صورة الهوية بشكل نهائي؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setError(null);
              setShowImageActions(false);
              setShowImageViewer(false);
              setDeletingId(true);
              setIdCardImageUrl('');
              const y = birthYear.trim();
              const m = birthMonth.trim();
              const d = birthDay.trim();
              const hasDob = !!(y || m || d);
              const normalizedDob = hasDob
                ? `${y}-${String(Number(m || '0')).padStart(2, '0')}-${String(Number(d || '0')).padStart(2, '0')}`
                : null;
              const result = await updateProfile({
                name: name.trim(),
                phone_number: phone.trim() || null,
                date_of_birth: normalizedDob,
                id_card_image_url: null,
                profile_image_url: user.profileImageUrl || null,
              });
              setDeletingId(false);
              if (!result.success) {
                setIdCardImageUrl(previousImageUrl);
                setError(result.message);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>البيانات الشخصية</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>إغلاق</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.label}>الاسم الكامل</Text>
              <TextInput value={name} editable={false} style={[styles.input, styles.disabledInput]} />

              <Text style={styles.label}>البريد الإلكتروني</Text>
              <TextInput value={user.email || ''} editable={false} style={[styles.input, styles.disabledInput]} />

              <Text style={styles.label}>رقم الهاتف</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="مثال: 0590000000"
                keyboardType="phone-pad"
                style={styles.input}
              />

              <Text style={styles.label}>تاريخ الميلاد</Text>
              <View style={styles.dobRow}>
                <View style={styles.dobItem}>
                  <Text style={styles.dobItemLabel}>اليوم</Text>
                  <TextInput
                    value={birthDay}
                    onChangeText={setBirthDay}
                    placeholder="DD"
                    keyboardType="number-pad"
                    maxLength={2}
                    style={[styles.input, styles.dobInput]}
                  />
                </View>
                <View style={styles.dobItem}>
                  <Text style={styles.dobItemLabel}>الشهر</Text>
                  <TextInput
                    value={birthMonth}
                    onChangeText={setBirthMonth}
                    placeholder="MM"
                    keyboardType="number-pad"
                    maxLength={2}
                    style={[styles.input, styles.dobInput]}
                  />
                </View>
                <View style={styles.dobItem}>
                  <Text style={styles.dobItemLabel}>السنة</Text>
                  <TextInput
                    value={birthYear}
                    onChangeText={setBirthYear}
                    placeholder="YYYY"
                    keyboardType="number-pad"
                    maxLength={4}
                    style={[styles.input, styles.dobInput]}
                  />
                </View>
              </View>

              <Text style={styles.label}>صورة الهوية</Text>
              <View style={styles.accountStatusWrap}>
                <Text style={styles.accountStatusLabel}>حالة الحساب</Text>
                <View style={[styles.accountStatusBadge, accountStatus.style]}>
                  <Text style={[styles.accountStatusBadgeText, accountStatus.textStyle]}>{accountStatus.label}</Text>
                </View>
              </View>
              {uploadingId || deletingId ? <ActivityIndicator color="#2E86AB" style={styles.uploadingLoader} /> : null}
              {idCardImageUrl ? (
                <>
                  <TouchableOpacity onPress={() => setShowImageActions((prev) => !prev)} activeOpacity={0.8}>
                    <Image source={{ uri: idCardImageUrl }} style={styles.idCardPreview} />
                  </TouchableOpacity>
                  {showImageActions ? (
                    <View style={styles.imageActionsRow}>
                      <TouchableOpacity style={styles.imageActionBtn} onPress={handleOpenIdImage}>
                        <Text style={styles.imageActionBtnText}>فتح الصورة</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.imageActionBtn} onPress={() => void handleEditIdImage()}>
                        <Text style={styles.imageActionBtnText}>تعديل الصورة</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.imageActionBtn, styles.deleteActionBtn]} onPress={deleteIdCardImage}>
                        <Text style={[styles.imageActionBtnText, styles.deleteActionBtnText]}>حذف الصورة</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={() => void handleSave()}
              disabled={!canSave}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>حفظ البيانات</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showImageViewer} transparent animationType="fade" onRequestClose={() => setShowImageViewer(false)}>
        <View style={styles.viewerBackdrop}>
          <Image source={{ uri: idCardImageUrl }} style={styles.viewerImage} resizeMode="contain" />
          <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setShowImageViewer(false)}>
            <Text style={styles.viewerCloseBtnText}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  closeBtnText: { color: '#374151', fontWeight: '700', fontSize: 12 },
  content: { paddingBottom: 12, gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  dobRow: { flexDirection: 'row-reverse', gap: 8 },
  dobItem: { flex: 1, minWidth: 0 },
  dobItemLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
  },
  dobInput: { textAlign: 'center', writingDirection: 'ltr', paddingHorizontal: 8 },
  disabledInput: { backgroundColor: '#F9FAFB', color: '#6B7280' },
  accountStatusWrap: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountStatusLabel: { color: '#334155', fontWeight: '700', fontSize: 13 },
  accountStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  accountStatusBadgeText: { fontSize: 12, fontWeight: '800' },
  accountStatusVerified: { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
  accountStatusVerifiedText: { color: '#166534' },
  accountStatusPending: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  accountStatusPendingText: { color: '#92400E' },
  accountStatusRejected: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  accountStatusRejectedText: { color: '#B91C1C' },
  uploadingLoader: { marginTop: 8 },
  idCardPreview: {
    marginTop: 10,
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  imageActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  imageActionBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  imageActionBtnText: { color: '#0F172A', fontSize: 13, fontWeight: '700' },
  deleteActionBtn: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  deleteActionBtnText: { color: '#B91C1C' },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  viewerImage: {
    width: '100%',
    height: '85%',
  },
  viewerCloseBtn: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: '#1F2937',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  viewerCloseBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  errorText: { color: '#B91C1C', fontSize: 13, marginTop: 8, fontWeight: '600' },
  saveBtn: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#1A3A5C',
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
