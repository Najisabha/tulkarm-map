/**
 * PlaceForm — نموذج ديناميكي يتغيّر حسب نوع المكان.
 * يُستخدم داخل AddPlaceModal ويمكن تضمينه في أي شاشة أخرى.
 *
 * الأنواع:
 *  - simple       → حقول أساسية فقط
 *  - categorized  → تصنيف رئيسي + فرعي + رقم + صور
 *  - house        → رقم المنزل
 *  - complex      → عدد الطوابق + وحدات/طابق
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PlaceKind } from '../../types/place';
import { CategoryItem, CategorySelector } from './CategorySelector';
import { LocationPicker } from './LocationPicker';
import { ReusableImagePicker } from './ReusableImagePicker';

interface AttributeDefinition {
  id: string;
  key: string;
  label: string;
  value_type: string;
  is_required: boolean;
}

export interface PlaceFormState {
  name: string;
  description: string;
  phoneNumber: string;
  dynamicValues: Record<string, string>;
  photos: string[];
}

interface PlaceFormProps {
  kind: PlaceKind;
  /** تسمية نوع المكان (مفرد)، مثل "منزل" أو "متجر تجاري" */
  typeLabel: string;
  attrDefs: AttributeDefinition[];
  formState: PlaceFormState;
  latitude: number;
  longitude: number;

  // التصنيفات
  mainCategories: CategoryItem[];
  subCategories: CategoryItem[];
  loadingCategories: boolean;
  mainCategoryLabel: string;
  subCategoryLabel: string;
  photoLabel: string;
  showMainList: boolean;
  showSubList: boolean;
  selectedMainColor: string;

  // أحداث
  onChange: (updates: Partial<PlaceFormState>) => void;
  onOpenMainList: () => void;
  onCloseMainList: () => void;
  onMainSelect: (name: string, id: string, color: string) => void;
  onOpenSubList: () => void;
  onCloseSubList: () => void;
  onSubSelect: (name: string) => void;
  onLoadSubCategories: (mainId: string) => void;

  /** هل يُظهر صندوق إضافة الصور؟ */
  showPhotos?: boolean;
  maxPhotos?: number;
}

export function PlaceForm({
  kind,
  typeLabel,
  attrDefs,
  formState,
  latitude,
  longitude,
  mainCategories,
  subCategories,
  loadingCategories,
  mainCategoryLabel,
  subCategoryLabel,
  photoLabel,
  showMainList,
  showSubList,
  selectedMainColor,
  onChange,
  onOpenMainList,
  onCloseMainList,
  onMainSelect,
  onOpenSubList,
  onCloseSubList,
  onSubSelect,
  showPhotos = false,
  maxPhotos = 3,
}: PlaceFormProps) {
  const setDynamic = (key: string, value: string) => {
    onChange({ dynamicValues: { ...formState.dynamicValues, [key]: value } });
  };

  const nameLabel =
    typeLabel === 'منزل' ? 'اسم المنزل'
    : typeLabel === 'متجر تجاري' ? 'اسم المتجر'
    : typeLabel === 'مجمّع سكني' ? 'اسم المجمّع'
    : typeLabel === 'مجمّع تجاري' ? 'اسم المجمّع التجاري'
    : 'اسم المكان';

  return (
    <>
      {/* إحداثيات */}
      <LocationPicker latitude={latitude} longitude={longitude} />

      {/* اسم المكان */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{nameLabel}</Text>
        <Text style={styles.asterisk}> *</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder={nameLabel}
        placeholderTextColor="#9CA3AF"
        value={formState.name}
        onChangeText={(v) => onChange({ name: v })}
        textAlign="right"
      />

      {/* الوصف */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>الوصف</Text>
      </View>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="وصف مختصر (اختياري)"
        placeholderTextColor="#9CA3AF"
        value={formState.description}
        onChangeText={(v) => onChange({ description: v })}
        multiline
        textAlign="right"
      />

      {/* رقم الهاتف (مشترك لجميع الأنواع) */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>رقم الهاتف</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="رقم الهاتف (اختياري)"
        placeholderTextColor="#9CA3AF"
        value={formState.phoneNumber}
        onChangeText={(v) => onChange({ phoneNumber: v })}
        keyboardType="phone-pad"
        textAlign="right"
      />

      {/* حقول خاصة بالمجمعات */}
      {kind === 'complex' && (
        <>
          <View style={styles.labelRow}>
            <Text style={styles.label}>عدد الطوابق</Text>
            <Text style={styles.asterisk}> *</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="مثال: 5"
            placeholderTextColor="#9CA3AF"
            value={formState.dynamicValues.floors_count || ''}
            onChangeText={(v) => setDynamic('floors_count', v)}
            keyboardType="numeric"
            textAlign="right"
          />
          <View style={styles.labelRow}>
            <Text style={styles.label}>وحدات في كل طابق</Text>
            <Text style={styles.asterisk}> *</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="مثال: 4"
            placeholderTextColor="#9CA3AF"
            value={formState.dynamicValues.units_per_floor || ''}
            onChangeText={(v) => setDynamic('units_per_floor', v)}
            keyboardType="numeric"
            textAlign="right"
          />
        </>
      )}

      {/* حقول ديناميكية (من attrDefs) */}
      {attrDefs.map((def) => (
        <View key={def.id} style={styles.fieldBlock}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{def.label}</Text>
            {def.is_required && <Text style={styles.asterisk}> *</Text>}
          </View>

          {def.key === 'store_type' ? (
            <CategorySelector
              mainCategories={mainCategories}
              subCategories={subCategories}
              selectedMain={formState.dynamicValues.store_type || ''}
              selectedSub={formState.dynamicValues.store_category || ''}
              selectedMainColor={selectedMainColor}
              loading={loadingCategories}
              mainLabel={mainCategoryLabel}
              subLabel={subCategoryLabel}
              showMainList={showMainList}
              showSubList={showSubList}
              onOpenMainList={onOpenMainList}
              onCloseMainList={onCloseMainList}
              onMainSelect={onMainSelect}
              onOpenSubList={onOpenSubList}
              onCloseSubList={onCloseSubList}
              onSubSelect={onSubSelect}
            />
          ) : def.key === 'store_category' ? (
            // يُرسم داخل CategorySelector — لا نُظهره هنا مرة ثانية
            null
          ) : def.value_type === 'boolean' ? (
            <TouchableOpacity
              style={[
                styles.boolToggle,
                formState.dynamicValues[def.key] === 'true' && styles.boolToggleActive,
              ]}
              onPress={() =>
                setDynamic(def.key, formState.dynamicValues[def.key] === 'true' ? 'false' : 'true')
              }
            >
              <Text style={styles.boolToggleText}>
                {formState.dynamicValues[def.key] === 'true' ? '✅ نعم' : '❌ لا'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TextInput
              style={styles.input}
              placeholder={def.key === 'store_number' ? 'أدخل الرقم' : def.label}
              placeholderTextColor="#9CA3AF"
              value={formState.dynamicValues[def.key] || ''}
              onChangeText={(v) => setDynamic(def.key, v)}
              keyboardType={def.value_type === 'number' ? 'numeric' : 'default'}
              textAlign="right"
            />
          )}
        </View>
      ))}

      {/* صندوق الصور */}
      {showPhotos && (
        <>
          <View style={styles.labelRow}>
            <Text style={styles.label}>
              {photoLabel} ({formState.photos.length}/{maxPhotos})
            </Text>
          </View>
          <ReusableImagePicker
            photos={formState.photos}
            maxPhotos={maxPhotos}
            label={`إضافة ${photoLabel}`}
            onPhotosChange={(photos) => onChange({ photos })}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fieldBlock: { width: '100%', marginBottom: 0 },
  labelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    width: '100%',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  label: {
    flexShrink: 1,
    maxWidth: '100%',
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
    lineHeight: 22,
  },
  asterisk: { fontSize: 14, fontWeight: '700', color: '#DC2626', lineHeight: 22 },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    color: '#1F2937',
  },
  textarea: { minHeight: 80 },
  boolToggle: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  boolToggleActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  boolToggleText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
