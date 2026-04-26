import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LAYOUT } from '../../constants/layout';
import type { ApiUser } from '../../utils/admin/userHelpers';
import { isDefaultAdminEmail } from '../../utils/admin/userHelpers';
import { adminUsersStyles as styles } from './AdminUsers.styles';

export interface EditUserModalProps {
  visible: boolean;
  user: ApiUser | null;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  profileImageUrl: string | null;
  idCardImageUrl: string | null;
  verificationStatus: 'verified' | 'pending' | 'rejected';
  newPassword: string;
  confirmPassword: string;
  uploadingProfileImage: boolean;
  uploadingIdCardImage: boolean;
  saving: boolean;
  onChangeName: (text: string) => void;
  onChangeEmail: (text: string) => void;
  onChangePhone: (text: string) => void;
  onChangeDateOfBirth: (text: string) => void;
  onChangeVerificationStatus: (status: 'verified' | 'pending' | 'rejected') => void;
  onChangeNewPassword: (text: string) => void;
  onChangeConfirmPassword: (text: string) => void;
  onUploadProfileImage: () => void;
  onUploadIdCardImage: () => void;
  onRemoveProfileImage: () => void;
  onRemoveIdCardImage: () => void;
  onClose: () => void;
  onSave: () => void;
}

export function EditUserModal({
  visible,
  user,
  name,
  email,
  phone,
  dateOfBirth,
  profileImageUrl,
  idCardImageUrl,
  verificationStatus,
  newPassword,
  confirmPassword,
  uploadingProfileImage,
  uploadingIdCardImage,
  saving,
  onChangeName,
  onChangeEmail,
  onChangePhone,
  onChangeDateOfBirth,
  onChangeVerificationStatus,
  onChangeNewPassword,
  onChangeConfirmPassword,
  onUploadProfileImage,
  onUploadIdCardImage,
  onRemoveProfileImage,
  onRemoveIdCardImage,
  onClose,
  onSave,
}: EditUserModalProps) {
  const isDefault = isDefaultAdminEmail(user?.email);
  const [dobYear, setDobYear] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobDay, setDobDay] = useState('');

  useEffect(() => {
    const raw = String(dateOfBirth || '').trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    setDobYear(m?.[1] || '');
    setDobMonth(m?.[2] || '');
    setDobDay(m?.[3] || '');
  }, [dateOfBirth, visible]);

  const emitDob = (y: string, m: string, d: string) => {
    if (!y && !m && !d) {
      onChangeDateOfBirth('');
      return;
    }
    const mm = m ? String(Number(m)).padStart(2, '0') : '';
    const dd = d ? String(Number(d)).padStart(2, '0') : '';
    onChangeDateOfBirth(`${y}${mm ? `-${mm}` : ''}${dd ? `-${dd}` : ''}`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior={LAYOUT.keyboardBehavior} style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Text style={styles.modalCancel}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>تعديل المستخدم</Text>
            <TouchableOpacity onPress={() => void onSave()} disabled={saving}>
              {saving ? (
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
              value={name}
              onChangeText={onChangeName}
              placeholder="الاسم الكامل"
              placeholderTextColor="#9CA3AF"
              textAlign="right"
            />
            <Text style={styles.fieldLabel}>البريد الإلكتروني</Text>
            <TextInput
              style={[styles.fieldInput, isDefault && styles.fieldDisabled]}
              value={email}
              onChangeText={onChangeEmail}
              placeholder="example@mail.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isDefault}
              textAlign="right"
            />
            {isDefault ? (
              <Text style={styles.fieldHint}>بريد المدير الافتراضي ثابت لأسباب أمنية.</Text>
            ) : null}

            <Text style={styles.fieldLabel}>رقم الهاتف</Text>
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={onChangePhone}
              placeholder="مثال: 0599000000"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              textAlign="right"
            />

            <Text style={styles.fieldLabel}>تاريخ الميلاد</Text>
            <View style={styles.dobRow}>
              <TextInput
                style={[styles.fieldInput, styles.dobInput]}
                value={dobYear}
                onChangeText={(text) => {
                  const v = text.replace(/\D/g, '').slice(0, 4);
                  setDobYear(v);
                  emitDob(v, dobMonth, dobDay);
                }}
                placeholder="السنة"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                textAlign="center"
              />
              <TextInput
                style={[styles.fieldInput, styles.dobInput]}
                value={dobMonth}
                onChangeText={(text) => {
                  const v = text.replace(/\D/g, '').slice(0, 2);
                  setDobMonth(v);
                  emitDob(dobYear, v, dobDay);
                }}
                placeholder="الشهر"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                textAlign="center"
              />
              <TextInput
                style={[styles.fieldInput, styles.dobInput]}
                value={dobDay}
                onChangeText={(text) => {
                  const v = text.replace(/\D/g, '').slice(0, 2);
                  setDobDay(v);
                  emitDob(dobYear, dobMonth, v);
                }}
                placeholder="اليوم"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                textAlign="center"
              />
            </View>

            <Text style={styles.fieldLabel}>حالة الحساب</Text>
            <View style={styles.verifyRow}>
              <TouchableOpacity
                style={[styles.verifyChip, verificationStatus === 'verified' && styles.verifyChipActiveVerified]}
                onPress={() => onChangeVerificationStatus('verified')}
                disabled={saving}
              >
                <Text style={[styles.verifyChipText, verificationStatus === 'verified' && styles.verifyChipTextActiveVerified]}>
                  موثق
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.verifyChip, verificationStatus === 'pending' && styles.verifyChipActivePending]}
                onPress={() => onChangeVerificationStatus('pending')}
                disabled={saving}
              >
                <Text style={[styles.verifyChipText, verificationStatus === 'pending' && styles.verifyChipTextActivePending]}>
                  قيد الانتظار
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.verifyChip, verificationStatus === 'rejected' && styles.verifyChipActiveRejected]}
                onPress={() => onChangeVerificationStatus('rejected')}
                disabled={saving}
              >
                <Text style={[styles.verifyChipText, verificationStatus === 'rejected' && styles.verifyChipTextActiveRejected]}>
                  مرفوض
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>صورة الملف الشخصي</Text>
            <View style={styles.imageRow}>
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={styles.editImagePreview} />
              ) : (
                <View style={[styles.editImagePreview, styles.editImagePlaceholder]}>
                  <Text style={styles.editImagePlaceholderText}>لا توجد صورة</Text>
                </View>
              )}
              <View style={styles.imageActions}>
                <TouchableOpacity style={styles.inlineActionBtn} onPress={() => void onUploadProfileImage()} disabled={saving || uploadingProfileImage}>
                  <Text style={styles.inlineActionBtnText}>{uploadingProfileImage ? 'جاري الرفع...' : 'رفع صورة'}</Text>
                </TouchableOpacity>
                {profileImageUrl ? (
                  <TouchableOpacity style={[styles.inlineActionBtn, styles.inlineDangerBtn]} onPress={onRemoveProfileImage} disabled={saving}>
                    <Text style={styles.inlineDangerBtnText}>إزالة</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <Text style={styles.fieldLabel}>صورة الهوية</Text>
            <View style={styles.imageRow}>
              {idCardImageUrl ? (
                <Image source={{ uri: idCardImageUrl }} style={styles.editImagePreview} />
              ) : (
                <View style={[styles.editImagePreview, styles.editImagePlaceholder]}>
                  <Text style={styles.editImagePlaceholderText}>لا توجد صورة</Text>
                </View>
              )}
              <View style={styles.imageActions}>
                <TouchableOpacity style={styles.inlineActionBtn} onPress={() => void onUploadIdCardImage()} disabled={saving || uploadingIdCardImage}>
                  <Text style={styles.inlineActionBtnText}>{uploadingIdCardImage ? 'جاري الرفع...' : 'رفع صورة'}</Text>
                </TouchableOpacity>
                {idCardImageUrl ? (
                  <TouchableOpacity style={[styles.inlineActionBtn, styles.inlineDangerBtn]} onPress={onRemoveIdCardImage} disabled={saving}>
                    <Text style={styles.inlineDangerBtnText}>إزالة</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <Text style={styles.fieldLabel}>تغيير كلمة المرور</Text>
            <TextInput
              style={styles.fieldInput}
              value={newPassword}
              onChangeText={onChangeNewPassword}
              placeholder="كلمة المرور الجديدة"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              textAlign="right"
            />
            <TextInput
              style={styles.fieldInput}
              value={confirmPassword}
              onChangeText={onChangeConfirmPassword}
              placeholder="تأكيد كلمة المرور الجديدة"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              textAlign="right"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
