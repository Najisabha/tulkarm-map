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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { listComplexUnitNames, PlaceKind } from '../../types/place';
import { parseAttrUiOptions } from '../../utils/admin/categoryAdminHelpers';
import { CategoryItem, CategorySelector } from './CategorySelector';
import { LocationPicker } from './LocationPicker';
import { ReusableImagePicker } from './ReusableImagePicker';

interface AttributeDefinition {
  id: string;
  key: string;
  label: string;
  value_type: string;
  is_required: boolean;
  options?: unknown;
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
  /** عند true لا يُعرض حقل «رقم الهاتف» المنفصل (يُستخدم حقل رقم المكان كهاتف) */
  hidePhoneField?: boolean;
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseIntOr(s: string | undefined, fallback: number) {
  const n = parseInt((s ?? '').trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function NumberStepper({
  label,
  value,
  min,
  max,
  onChangeValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChangeValue: (next: number) => void;
}) {
  const decDisabled = value <= min;
  const incDisabled = value >= max;
  return (
    <View style={styles.stepperWrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.asterisk}> *</Text>
      </View>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={[styles.stepperBtn, decDisabled && styles.stepperBtnDisabled]}
          onPress={() => onChangeValue(clampInt(value - 1, min, max))}
          disabled={decDisabled}
          activeOpacity={0.8}
        >
          <Text style={styles.stepperBtnText}>-</Text>
        </TouchableOpacity>
        <View style={styles.stepperValueBox}>
          <Text style={styles.stepperValueText}>{value}</Text>
        </View>
        <TouchableOpacity
          style={[styles.stepperBtn, incDisabled && styles.stepperBtnDisabled]}
          onPress={() => onChangeValue(clampInt(value + 1, min, max))}
          disabled={incDisabled}
          activeOpacity={0.8}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
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
  hidePhoneField = false,
}: PlaceFormProps) {
  const setDynamic = (key: string, value: string) => {
    onChange({ dynamicValues: { ...formState.dynamicValues, [key]: value } });
  };

  const complexPreview = React.useMemo(() => {
    if (kind !== 'complex') return null;
    const floors = parseInt(formState.dynamicValues.floors_count || '');
    const units = parseInt(formState.dynamicValues.units_per_floor || '');
    if (!Number.isFinite(floors) || !Number.isFinite(units) || floors < 1 || units < 1) return null;
    const complexType = typeLabel === 'مجمّع سكني' ? 'residential' : 'commercial';
    const all = listComplexUnitNames(complexType, floors, units);
    return {
      complexType,
      total: all.length,
      sample: all.slice(0, 8).map((x) => x.name),
    };
  }, [kind, typeLabel, formState.dynamicValues.floors_count, formState.dynamicValues.units_per_floor]);

  return (
    <>
      {attrDefs.map((def) => {
        const ui = parseAttrUiOptions(def.options);
        const uiRole = ui.uiRole ?? 'dynamic';
        if (uiRole === 'place_location') {
          return (
            <View key={def.id} style={styles.fieldBlock}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{def.label || 'الموقع على الخريطة'}</Text>
                {def.is_required && <Text style={styles.asterisk}> *</Text>}
              </View>
              <LocationPicker latitude={latitude} longitude={longitude} />
            </View>
          );
        }
        if (uiRole === 'place_name') {
          return (
            <View key={def.id} style={styles.fieldBlock}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{def.label}</Text>
                {def.is_required && <Text style={styles.asterisk}> *</Text>}
              </View>
              <TextInput
                style={styles.input}
                placeholder={def.label}
                placeholderTextColor="#9CA3AF"
                value={formState.name}
                onChangeText={(v) => onChange({ name: v })}
                textAlign="right"
              />
            </View>
          );
        }
        if (uiRole === 'place_description') {
          return (
            <View key={def.id} style={styles.fieldBlock}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{def.label}</Text>
                {def.is_required && <Text style={styles.asterisk}> *</Text>}
              </View>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder={def.label}
                placeholderTextColor="#9CA3AF"
                value={formState.description}
                onChangeText={(v) => onChange({ description: v })}
                multiline
                textAlign="right"
              />
            </View>
          );
        }
        if (uiRole === 'place_phone') {
          if (hidePhoneField) return null;
          return (
            <View key={def.id} style={styles.fieldBlock}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{def.label}</Text>
                {def.is_required && <Text style={styles.asterisk}> *</Text>}
              </View>
              <TextInput
                style={styles.input}
                placeholder={def.label}
                placeholderTextColor="#9CA3AF"
                value={formState.phoneNumber}
                onChangeText={(v) => onChange({ phoneNumber: v })}
                keyboardType="phone-pad"
                textAlign="right"
              />
            </View>
          );
        }
        if (uiRole === 'place_photos') {
          const limit = ui.maxPhotos ?? maxPhotos;
          return (
            <View key={def.id} style={styles.fieldBlock}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>
                  {def.label} ({formState.photos.length}/{limit})
                </Text>
                {def.is_required && <Text style={styles.asterisk}> *</Text>}
              </View>
              <ReusableImagePicker
                photos={formState.photos}
                maxPhotos={limit}
                label={`إضافة ${def.label || photoLabel}`}
                onPhotosChange={(photos) => onChange({ photos })}
              />
            </View>
          );
        }
        return (
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
              placeholder={
                def.value_type === 'phone'
                  ? 'مثال: 059xxxxxxx'
                  : def.key === 'store_number'
                    ? 'أدخل الرقم'
                    : def.label
              }
              placeholderTextColor="#9CA3AF"
              value={formState.dynamicValues[def.key] || ''}
              onChangeText={(v) => setDynamic(def.key, v)}
              keyboardType={
                def.value_type === 'phone' ? 'phone-pad' : def.value_type === 'number' ? 'numeric' : 'default'
              }
              textAlign="right"
            />
          )}
        </View>
      );
      })}

      {/* fallback: لو غابت خصائص أساسية من الإدارة */}
      {!attrDefs.some((def) => (parseAttrUiOptions(def.options).uiRole ?? 'dynamic') === 'place_location') && (
        <LocationPicker latitude={latitude} longitude={longitude} />
      )}
      {!attrDefs.some((def) => (parseAttrUiOptions(def.options).uiRole ?? 'dynamic') === 'place_name') && (
        <>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{typeLabel === 'منزل' ? 'اسم صاحب المنزل' : `اسم ${typeLabel}`}</Text>
            <Text style={styles.asterisk}> *</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder={typeLabel === 'منزل' ? 'اسم صاحب المنزل' : `اسم ${typeLabel}`}
            placeholderTextColor="#9CA3AF"
            value={formState.name}
            onChangeText={(v) => onChange({ name: v })}
            textAlign="right"
          />
        </>
      )}
      {kind === 'complex' && (
        <>
          <View style={styles.complexRow}>
            <NumberStepper
              label="عدد الطوابق"
              value={parseIntOr(formState.dynamicValues.floors_count, 1)}
              min={1}
              max={200}
              onChangeValue={(n) => setDynamic('floors_count', String(n))}
            />
            <NumberStepper
              label="وحدات في كل طابق"
              value={parseIntOr(formState.dynamicValues.units_per_floor, 1)}
              min={1}
              max={500}
              onChangeValue={(n) => setDynamic('units_per_floor', String(n))}
            />
          </View>
          {complexPreview && (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>
                سيُنشأ {complexPreview.total} {complexPreview.complexType === 'residential' ? 'بيت' : 'وحدة'}
              </Text>
              <Text style={styles.previewText} numberOfLines={3}>
                {complexPreview.sample.join('، ')}
                {complexPreview.total > complexPreview.sample.length ? '…' : ''}
              </Text>
              {complexPreview.complexType === 'commercial' && (
                <Text style={styles.previewHint}>ملاحظة: لكل وحدة حقل unit_type (فارغ بالبداية) ويمكن تعديله لاحقاً.</Text>
              )}
            </View>
          )}
        </>
      )}
      {showPhotos &&
        !attrDefs.some((def) => (parseAttrUiOptions(def.options).uiRole ?? 'dynamic') === 'place_photos') && (
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
  complexRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
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

  stepperWrap: { flex: 1, minWidth: 0 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 10,
    marginBottom: 16,
    gap: 10,
  },
  stepperBtn: {
    width: 42,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  stepperBtnDisabled: { opacity: 0.45 },
  stepperBtnText: { fontSize: 20, fontWeight: '800', color: '#374151', lineHeight: 22 },
  stepperValueBox: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: { fontSize: 16, fontWeight: '800', color: '#111827' },

  previewBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 12,
    marginTop: -6,
    marginBottom: 16,
    gap: 6,
  },
  previewTitle: { fontSize: 13, fontWeight: '800', color: '#9A3412', textAlign: 'right' },
  previewText: { fontSize: 13, color: '#7C2D12', textAlign: 'right', lineHeight: 20 },
  previewHint: { fontSize: 12, color: '#9A3412', textAlign: 'right', lineHeight: 18 },
});
