import React from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLOR_PRESETS } from '../../utils/admin/classificationTreeHelpers';
import { adminClassificationTreeStyles as styles } from './AdminClassificationTree.styles';

interface ClassificationFormState {
  name: string;
  emoji: string;
  color: string;
  sort_order: string;
}

interface AdminClassificationModalProps {
  visible: boolean;
  editingItem: boolean;
  hasParent: boolean;
  form: ClassificationFormState;
  onClose: () => void;
  onChange: (patch: Partial<ClassificationFormState>) => void;
  onSave: () => void;
}

export function AdminClassificationModal({
  visible,
  editingItem,
  hasParent,
  form,
  onClose,
  onChange,
  onSave,
}: AdminClassificationModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {editingItem ? 'تعديل التصنيف' : hasParent ? 'إضافة تصنيف فرعي' : 'إضافة تصنيف رئيسي'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="اسم التصنيف"
            placeholderTextColor="#9CA3AF"
            value={form.name}
            onChangeText={(t) => onChange({ name: t })}
            textAlign="right"
          />
          <View style={styles.row2}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="اللون (#hex)"
              placeholderTextColor="#9CA3AF"
              value={form.color}
              onChangeText={(t) => onChange({ color: t })}
              autoCapitalize="none"
              textAlign="right"
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="إيموجي (اختياري)"
              placeholderTextColor="#9CA3AF"
              value={form.emoji}
              onChangeText={(t) => onChange({ emoji: t })}
              textAlign="right"
            />
          </View>
          <View style={styles.presetRow}>
            {COLOR_PRESETS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, form.color === c && styles.colorDotActive]}
                onPress={() => onChange({ color: c })}
              />
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="ترتيب (اختياري)"
            placeholderTextColor="#9CA3AF"
            value={form.sort_order}
            onChangeText={(t) => onChange({ sort_order: t })}
            keyboardType="numeric"
            textAlign="right"
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={onClose}>
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.modalSave]} onPress={onSave}>
              <Text style={styles.modalSaveText}>حفظ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
