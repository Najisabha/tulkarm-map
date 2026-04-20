import React from 'react';
import {
  ActivityIndicator,
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
  saving: boolean;
  onChangeName: (text: string) => void;
  onChangeEmail: (text: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function EditUserModal({
  visible,
  user,
  name,
  email,
  saving,
  onChangeName,
  onChangeEmail,
  onClose,
  onSave,
}: EditUserModalProps) {
  const isDefault = isDefaultAdminEmail(user?.email);

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
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
