import React from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PRESET_COLORS } from '../../constants/categoryColors';
import { adminCategoriesStyles as styles } from './AdminCategories.styles';

interface CategoryFormState {
  name: string;
  emoji: string;
  color: string;
}

interface AdminCategoryModalProps {
  visible: boolean;
  isEditing: boolean;
  form: CategoryFormState;
  onChange: (patch: Partial<CategoryFormState>) => void;
  onSave: () => void;
  onClose: () => void;
}

export function AdminCategoryModal({
  visible,
  isEditing,
  form,
  onChange,
  onSave,
  onClose,
}: AdminCategoryModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{isEditing ? 'تعديل الفئة' : 'إضافة فئة جديدة'}</Text>
          <Text style={styles.formLabel}>الاسم</Text>
          <TextInput
            style={[styles.formInput, { marginBottom: 12 }]}
            placeholder="مثال: صيدليات"
            value={form.name}
            onChangeText={(t) => onChange({ name: t })}
            textAlign="right"
          />
          <Text style={styles.formLabel}>الأيقونة (إيموجي)</Text>
          <TextInput
            style={[styles.formInput, { marginBottom: 12 }]}
            placeholder="📍"
            value={form.emoji}
            onChangeText={(t) => onChange({ emoji: t || '📍' })}
            textAlign="center"
          />
          <Text style={styles.formLabel}>اللون</Text>
          <View style={styles.colorRow}>
            {PRESET_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  form.color === c && styles.colorDotSelected,
                ]}
                onPress={() => onChange({ color: c })}
              />
            ))}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.confirmBtn} onPress={onSave}>
              <Text style={styles.confirmBtnText}>حفظ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
