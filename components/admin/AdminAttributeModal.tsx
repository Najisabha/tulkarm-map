import React from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { VALUE_TYPES } from '../../utils/admin/categoryAdminHelpers';
import { adminCategoriesStyles as styles } from './AdminCategories.styles';

interface AttrFormState {
  key: string;
  label: string;
  value_type: string;
  is_required: boolean;
  uiRole: string;
  sortOrder: string;
  maxPhotos: string;
}

/** مفاتيح الحقول المعرّفة مسبقاً (تطابق ATTR_UI_ROLE_KEYS في الإدارة) */
const PRESET_KEY_BY_ROLE: Record<string, string> = {
  place_location: 'place_location',
  place_name: 'place_name',
  place_description: 'place_description',
  place_phone: 'place_phone',
  place_photos: 'place_photos',
};

interface AdminAttributeModalProps {
  visible: boolean;
  isEditing: boolean;
  form: AttrFormState;
  onChange: (patch: Partial<AttrFormState>) => void;
  onSave: () => void;
  onClose: () => void;
}

export function AdminAttributeModal({
  visible,
  isEditing,
  form,
  onChange,
  onSave,
  onClose,
}: AdminAttributeModalProps) {
  const ROLE_OPTIONS = [
    { value: 'dynamic', label: 'حقل ديناميكي' },
    { value: 'place_location', label: 'الموقع' },
    { value: 'place_name', label: 'اسم المكان' },
    { value: 'place_description', label: 'الوصف' },
    { value: 'place_phone', label: 'الهاتف' },
    { value: 'place_photos', label: 'الصور' },
  ];
  /** لا يُسمح بالتحويل إلى ديناميكي جديد؛ يبقى مفعّلاً فقط عند تعديل خاصية ديناميكية قائمة */
  const roleOptionDisabled = (value: string) => value === 'dynamic' && form.uiRole !== 'dynamic';
  const isDynamic = form.uiRole === 'dynamic';
  const isPhotosRole = form.uiRole === 'place_photos';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{isEditing ? 'تعديل الخاصية' : 'إضافة خاصية جديدة'}</Text>

          <Text style={styles.formLabel}>نوع الحقل</Text>
          <View style={styles.valueTypeRow}>
            {ROLE_OPTIONS.map((rt) => {
              const disabled = roleOptionDisabled(rt.value);
              const active = form.uiRole === rt.value;
              return (
                <TouchableOpacity
                  key={rt.value}
                  disabled={disabled}
                  style={[
                    styles.valueTypeChip,
                    active && styles.valueTypeChipActive,
                    disabled && styles.valueTypeChipDisabled,
                  ]}
                  onPress={() => {
                    if (!disabled) onChange({ uiRole: rt.value });
                  }}
                >
                  <Text
                    style={[
                      styles.valueTypeChipText,
                      active && styles.valueTypeChipTextActive,
                      disabled && !active && styles.valueTypeChipTextDisabled,
                    ]}
                  >
                    {rt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.formLabel}>المفتاح (key) *</Text>
          <TextInput
            style={[styles.formInput, { marginBottom: 12 }]}
            placeholder="phone"
            value={isDynamic ? form.key : (PRESET_KEY_BY_ROLE[form.uiRole] ?? '')}
            onChangeText={(t) => onChange({ key: t.replace(/\s/g, '_').toLowerCase() })}
            textAlign="left"
            autoCapitalize="none"
            editable={isDynamic}
          />

          <Text style={styles.formLabel}>العنوان (اسم الحقل) *</Text>
          <TextInput
            style={[styles.formInput, { marginBottom: 12 }]}
            placeholder="رقم الهاتف"
            value={form.label}
            onChangeText={(t) => onChange({ label: t })}
            textAlign="right"
          />

          {isDynamic && (
            <>
              <Text style={styles.formLabel}>نوع القيمة</Text>
              <View style={styles.valueTypeRow}>
                {VALUE_TYPES.map((vt) => (
                  <TouchableOpacity
                    key={vt.value}
                    style={[
                      styles.valueTypeChip,
                      form.value_type === vt.value && styles.valueTypeChipActive,
                    ]}
                    onPress={() => onChange({ value_type: vt.value })}
                  >
                    <Text
                      style={[
                        styles.valueTypeChipText,
                        form.value_type === vt.value && styles.valueTypeChipTextActive,
                      ]}
                    >
                      {vt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.formLabel}>ترتيب العرض (sortOrder)</Text>
          <TextInput
            style={[styles.formInput, { marginBottom: 12 }]}
            placeholder="مثال: 100"
            value={form.sortOrder}
            onChangeText={(t) => onChange({ sortOrder: t.replace(/[^\d-]/g, '') })}
            keyboardType="numeric"
            textAlign="left"
          />

          {isPhotosRole && (
            <>
              <Text style={styles.formLabel}>الحد الأقصى للصور</Text>
              <TextInput
                style={[styles.formInput, { marginBottom: 12 }]}
                placeholder="3"
                value={form.maxPhotos}
                onChangeText={(t) => onChange({ maxPhotos: t.replace(/[^\d]/g, '') })}
                keyboardType="numeric"
                textAlign="left"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.requiredToggle, form.is_required && styles.requiredToggleActive]}
            onPress={() => onChange({ is_required: !form.is_required })}
          >
            <Text style={styles.requiredToggleText}>
              {form.is_required ? '✅ مطلوب (إجباري)' : '❌ اختياري'}
            </Text>
          </TouchableOpacity>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.confirmBtn} onPress={onSave}>
              <Text style={styles.confirmBtnText}>{isEditing ? 'حفظ' : 'إضافة'}</Text>
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
