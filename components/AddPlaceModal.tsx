import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, PlaceType } from '../api/client';
import { shadow } from '../utils/shadowStyles';
import {
  CANONICAL_PLACE_TYPE_NAMES,
  getPlaceTypeDisplayName,
  getPlaceTypePluralLabel,
  getPlaceTypeProductCategoryFieldLabels,
  normalizePlaceTypeKind,
  resolveCanonicalPlaceTypeKey,
  usesProductCategoryFieldsForPlaceType,
} from '../utils/placeTypeLabels';
import { isInsideTulkarm } from '../utils/tulkarmGovernorate';
import { validatePlaceForm } from '../utils/placeFormValidation';
import { PlaceKind } from '../types/place';
import { ErrorBanner } from './places/ErrorBanner';
import { CategoryItem } from './places/CategorySelector';
import { PlaceForm, PlaceFormState } from './places/PlaceForm';

const MAX_PHOTOS = 3;

const TYPE_PICKER_MAX_H = Math.min(Dimensions.get('window').height * 0.62, 520);
const TYPE_GRID_H_PAD = 16;
const TYPE_GRID_GAP = 12;
const TYPE_CARD_WIDTH =
  (Dimensions.get('window').width - TYPE_GRID_H_PAD * 2 - TYPE_GRID_GAP) / 2;

interface AttributeDefinition {
  id: string;
  key: string;
  label: string;
  value_type: string;
  is_required: boolean;
  options?: any;
}

interface PlaceTypeUI {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface AddPlaceModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    type_id: string;
    type_name: string;
    latitude: number;
    longitude: number;
    photos?: string[];
    videos?: string[];
    dynamicAttributes?: { key: string; value: string; value_type?: string }[];
    phoneNumber?: string;
  }) => Promise<void>;
  latitude: number;
  longitude: number;
  submitSuccessTitle?: string;
  submitSuccessMessage?: string;
}

const DEFAULT_SUCCESS_TITLE = '✅ تم';
const DEFAULT_SUCCESS_MESSAGE = 'تم إضافة المكان بنجاح';

export function AddPlaceModal({
  visible,
  onClose,
  onSubmit,
  latitude,
  longitude,
  submitSuccessTitle,
  submitSuccessMessage,
}: AddPlaceModalProps) {
  const [step, setStep] = useState<'type' | 'form' | 'success'>('type');
  const [placeTypes, setPlaceTypes] = useState<PlaceTypeUI[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedType, setSelectedType] = useState<PlaceTypeUI | null>(null);
  const [attrDefs, setAttrDefs] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // حالة النموذج موحّدة
  const [formState, setFormState] = useState<PlaceFormState>({
    name: '',
    description: '',
    phoneNumber: '',
    dynamicValues: {},
    photos: [],
  });

  // حالة التصنيفات
  const [mainCategories, setMainCategories] = useState<CategoryItem[]>([]);
  const [subCategories, setSubCategories] = useState<CategoryItem[]>([]);
  const [selectedMainCategoryColor, setSelectedMainCategoryColor] = useState('#2E86AB');
  const [showMainCategoryList, setShowMainCategoryList] = useState(false);
  const [showSubCategoryList, setShowSubCategoryList] = useState(false);
  const [loadingProductCategories, setLoadingProductCategories] = useState(false);

  const selectedTypeSingularLabel = selectedType
    ? getPlaceTypeDisplayName(selectedType.name)
    : 'مكان';
  const productCategoryFormLabels = selectedType
    ? getPlaceTypeProductCategoryFieldLabels(selectedType.name)
    : null;
  const placeKind: PlaceKind = selectedType
    ? (() => {
        const k = normalizePlaceTypeKind(selectedType.name);
        if (k === 'house') return 'house';
        if (k === 'store' || usesProductCategoryFieldsForPlaceType(selectedType.name)) return 'categorized';
        if (k === 'residentialComplex' || k === 'commercialComplex') return 'complex';
        return 'simple';
      })()
    : 'simple';

  const showPhotos =
    selectedTypeSingularLabel === 'منزل' ||
    selectedTypeSingularLabel === 'متجر تجاري' ||
    !!productCategoryFormLabels;

  const photoLabel = selectedTypeSingularLabel === 'منزل'
    ? 'صور المنزل'
    : selectedTypeSingularLabel === 'متجر تجاري'
      ? 'صور المتجر'
      : productCategoryFormLabels?.photos ?? 'صور المكان';

  // ─── تحميل الأنواع ───────────────────────────────────────────────────────────

  const loadPlaceTypes = async () => {
    setLoadingTypes(true);
    try {
      const res = await api.getPlaceTypes();
      const apiTypes: PlaceType[] = res.data || [];
      const seen = new Set<string>();
      const list: PlaceTypeUI[] = [];
      for (const t of apiTypes) {
        if (seen.has(t.name)) continue;
        seen.add(t.name);
        list.push({ id: t.id, name: t.name, emoji: t.emoji || '📍', color: t.color || '#2E86AB' });
      }
      const sortRank = (name: string) => {
        const key = resolveCanonicalPlaceTypeKey(name);
        if (!key) return 1000;
        const idx = (CANONICAL_PLACE_TYPE_NAMES as readonly string[]).indexOf(key);
        return idx >= 0 ? idx : 999;
      };
      list.sort((a, b) => {
        const d = sortRank(a.name) - sortRank(b.name);
        return d !== 0 ? d : a.name.localeCompare(b.name, 'ar');
      });
      setPlaceTypes(list);
    } catch {
      setPlaceTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  };

  const getFixedAttrDefsForType = (typeName: string): AttributeDefinition[] => {
    const trimmedName = typeName?.trim() ?? '';
    const kind = normalizePlaceTypeKind(trimmedName);
    const uid = (s: string) => `fixed-${trimmedName.replace(/\s+/g, '_')}-${s}`;

    const productFieldLabels = getPlaceTypeProductCategoryFieldLabels(trimmedName);
    if (productFieldLabels) {
      return [
        { id: uid('store_type'), key: 'store_type', label: productFieldLabels.main, value_type: 'string', is_required: true },
        { id: uid('store_category'), key: 'store_category', label: productFieldLabels.sub, value_type: 'string', is_required: true },
        { id: uid('store_number'), key: 'store_number', label: productFieldLabels.number, value_type: 'string', is_required: true },
      ];
    }

    switch (kind) {
      case 'house':
        return [{ id: uid('house_number'), key: 'house_number', label: 'رقم المنزل', value_type: 'string', is_required: true }];
      case 'store':
        return [
          { id: uid('store_type'), key: 'store_type', label: 'التصنيف الرئيسي\u200c للمتجر', value_type: 'string', is_required: true },
          { id: uid('store_category'), key: 'store_category', label: 'التصنيف الفرعي\u200c للمتجر', value_type: 'string', is_required: true },
          { id: uid('store_number'), key: 'store_number', label: 'رقم المتجر', value_type: 'string', is_required: true },
        ];
      case 'residentialComplex':
        return [
          { id: uid('complex_number'), key: 'complex_number', label: 'رقم المجمع', value_type: 'string', is_required: true },
          { id: uid('location_text'), key: 'location_text', label: 'مكان المجمع', value_type: 'string', is_required: true },
        ];
      case 'commercialComplex':
        return [
          { id: uid('complex_number'), key: 'complex_number', label: 'رقم المجمع التجاري', value_type: 'string', is_required: true },
          { id: uid('location_text'), key: 'location_text', label: 'مكان المجمع التجاري', value_type: 'string', is_required: true },
        ];
      default:
        return [{ id: uid('location_text'), key: 'location_text', label: 'وصف الموقع', value_type: 'string', is_required: false }];
    }
  };

  const reset = () => {
    setStep('type');
    setSelectedType(null);
    setAttrDefs([]);
    setFormState({ name: '', description: '', phoneNumber: '', dynamicValues: {}, photos: [] });
    setSubCategories([]);
    setShowMainCategoryList(false);
    setShowSubCategoryList(false);
    setFormError(null);
  };

  useEffect(() => {
    if (!visible) return;
    reset();
    void loadPlaceTypes();
  }, [visible]);

  const handleClose = () => { reset(); onClose(); };

  const handleSelectType = (type: PlaceTypeUI) => {
    setSelectedType(type);
    setFormState((prev) => ({ ...prev, dynamicValues: {}, photos: [] }));
    setSubCategories([]);
    setShowMainCategoryList(false);
    setShowSubCategoryList(false);
    setAttrDefs(getFixedAttrDefsForType(type.name));
    if (normalizePlaceTypeKind(type.name) === 'store' || usesProductCategoryFieldsForPlaceType(type.name)) {
      void loadMainProductCategories();
    }
    setStep('form');
  };

  const loadMainProductCategories = async () => {
    try {
      setLoadingProductCategories(true);
      const res = await api.getProductMainCategories();
      const list = Array.isArray(res.data) ? res.data : [];
      setMainCategories(
        list.map((x) => ({ id: x.id, name: x.name, emoji: x.emoji ?? null, color: x.arrow_color ?? null }))
      );
    } catch {
      setMainCategories([]);
    } finally {
      setLoadingProductCategories(false);
    }
  };

  const loadSubProductCategories = async (mainId: string) => {
    if (!mainId) { setSubCategories([]); return; }
    try {
      setLoadingProductCategories(true);
      const res = await api.getProductSubCategories(mainId);
      const list = Array.isArray(res.data) ? res.data : [];
      setSubCategories(
        list.map((x: any) => ({ id: x.id, name: x.name, emoji: x.emoji ?? null, color: x.arrow_color ?? null }))
      );
    } catch {
      setSubCategories([]);
    } finally {
      setLoadingProductCategories(false);
    }
  };

  const handleMainSelect = async (name: string, id: string, color: string) => {
    setFormState((prev) => ({
      ...prev,
      dynamicValues: { ...prev.dynamicValues, store_type: name, store_category: '' },
    }));
    setSelectedMainCategoryColor(color);
    setShowMainCategoryList(false);
    await loadSubProductCategories(id);
  };

  const handleSubSelect = (name: string) => {
    setFormState((prev) => ({
      ...prev,
      dynamicValues: { ...prev.dynamicValues, store_category: name },
    }));
    setShowSubCategoryList(false);
  };

  // ─── إرسال النموذج ───────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setFormError(null);

    if (!selectedType) { setFormError('يرجى اختيار نوع المكان'); return; }

    const validation = validatePlaceForm({
      name: formState.name,
      typeId: selectedType.id,
      phoneNumber: formState.phoneNumber,
      dynamicValues: formState.dynamicValues,
      requiredAttrKeys: attrDefs
        .filter((d) => d.is_required)
        .map((d) => ({ key: d.key, label: d.label })),
      floorsCount: formState.dynamicValues.floors_count,
      unitsPerFloor: formState.dynamicValues.units_per_floor,
    });
    if (!validation.valid) { setFormError(validation.error); return; }

    if (!isInsideTulkarm(latitude, longitude)) {
      setFormError('يجب أن يكون المكان داخل الدائرة الزرقاء على الخريطة (منطقة مدينة طولكرم والجوار المباشر فقط).');
      return;
    }

    setLoading(true);
    try {
      const attrs = Object.entries(formState.dynamicValues)
        .filter(([, v]) => v.trim())
        .map(([key, value]) => {
          const def = attrDefs.find((d) => d.key === key);
          return { key, value: value.trim(), value_type: def?.value_type || 'string' };
        });

      await onSubmit({
        name: formState.name.trim(),
        description: formState.description.trim(),
        type_id: selectedType.id,
        type_name: selectedType.name,
        latitude,
        longitude,
        photos: formState.photos.length ? formState.photos : undefined,
        dynamicAttributes: attrs.length ? attrs : undefined,
        phoneNumber: formState.phoneNumber.trim() || undefined,
      });
      setStep('success');
    } catch (e: any) {
      setFormError(e?.message || 'حدث خطأ، يرجى المحاولة مجدداً');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.outerContainer}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === 'success'
                ? 'طلبك قيد المراجعة'
                : step === 'type'
                  ? 'اختر نوع المكان'
                  : `إضافة ${selectedTypeSingularLabel}`}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ─── خطوة اختيار النوع ─────────────────────────────────── */}
          {step === 'type' ? (
            <View style={[styles.typeStepWrap, { height: TYPE_PICKER_MAX_H }]}>
              <ScrollView
                style={styles.typeGridScroll}
                contentContainerStyle={styles.typeGridContent}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                <Text style={styles.coords}>
                  📌 {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </Text>
                <Text style={styles.typeHint}>ما نوع هذا المكان؟</Text>

                {loadingTypes ? (
                  <ActivityIndicator size="large" color="#2E86AB" style={{ marginTop: 20 }} />
                ) : placeTypes.length === 0 ? (
                  <Text style={styles.noTypesText}>
                    لا توجد أنواع أماكن. تأكد من الاتصال بالسيرفر أو أضف أنواع من لوحة الإدارة.
                  </Text>
                ) : (
                  placeTypes.reduce<PlaceTypeUI[][]>((rows, type, i) => {
                    if (i % 2 === 0) rows.push([type]);
                    else rows[rows.length - 1].push(type);
                    return rows;
                  }, []).map((row) => (
                    <View key={row.map((t) => t.id).join('-')} style={styles.typeRow}>
                      {row.map((type) => (
                        <TouchableOpacity
                          key={type.id}
                          style={[
                            styles.typeCard,
                            { width: TYPE_CARD_WIDTH, borderTopColor: type.color, borderTopWidth: 3 },
                          ]}
                          onPress={() => handleSelectType(type)}
                          activeOpacity={0.75}
                        >
                          <View style={[styles.typeIconCircle, { backgroundColor: type.color + '1A' }]}>
                            <Text style={styles.typeEmoji}>{type.emoji}</Text>
                          </View>
                          <Text style={styles.typeLabel} numberOfLines={2}>
                            {getPlaceTypePluralLabel(type.name)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

          /* ─── خطوة النموذج ──────────────────────────────────────── */
          ) : step === 'form' ? (
            <View style={styles.formStep}>
              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={styles.bodyScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {selectedType && (
                  <>
                    {/* شارة النوع المختار مع زر تغيير */}
                    <TouchableOpacity style={styles.selectedTypeBadge} onPress={() => setStep('type')}>
                      <Text style={styles.selectedTypeBadgeArrow}>→</Text>
                      <View style={[styles.selectedTypeDot, { backgroundColor: selectedType.color }]} />
                      <Text style={styles.selectedTypeBadgeText}>
                        {selectedType.emoji} {selectedTypeSingularLabel}
                      </Text>
                      <Text style={styles.selectedTypeChange}>تغيير</Text>
                    </TouchableOpacity>

                    {/* النموذج الديناميكي */}
                    <PlaceForm
                      kind={placeKind}
                      typeLabel={selectedTypeSingularLabel}
                      attrDefs={attrDefs}
                      formState={formState}
                      latitude={latitude}
                      longitude={longitude}
                      mainCategories={mainCategories}
                      subCategories={subCategories}
                      loadingCategories={loadingProductCategories}
                      mainCategoryLabel={productCategoryFormLabels?.main ?? 'التصنيف الرئيسي'}
                      subCategoryLabel={productCategoryFormLabels?.sub ?? 'التصنيف الفرعي'}
                      photoLabel={photoLabel}
                      showMainList={showMainCategoryList}
                      showSubList={showSubCategoryList}
                      selectedMainColor={selectedMainCategoryColor}
                      onChange={(updates) => setFormState((prev) => ({ ...prev, ...updates }))}
                      onOpenMainList={() => setShowMainCategoryList(true)}
                      onCloseMainList={() => setShowMainCategoryList(false)}
                      onMainSelect={handleMainSelect}
                      onOpenSubList={() => setShowSubCategoryList(true)}
                      onCloseSubList={() => setShowSubCategoryList(false)}
                      onSubSelect={handleSubSelect}
                      onLoadSubCategories={loadSubProductCategories}
                      showPhotos={showPhotos}
                      maxPhotos={MAX_PHOTOS}
                    />
                  </>
                )}
              </ScrollView>

              <View style={styles.submitFooter} pointerEvents="box-none">
                <ErrorBanner message={formError} onDismiss={() => setFormError(null)} />
                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    loading && styles.submitBtnDisabled,
                    pressed && !loading && styles.submitBtnPressed,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="إضافة المكان"
                  hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>إضافة المكان</Text>
                  )}
                </Pressable>
              </View>
            </View>

          /* ─── خطوة النجاح ──────────────────────────────────────── */
          ) : (
            <ScrollView
              style={styles.successScroll}
              contentContainerStyle={styles.successScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.successCircle}>
                <Text style={styles.successCheck}>✓</Text>
              </View>
              <Text style={styles.successHeadline}>
                {submitSuccessTitle ?? DEFAULT_SUCCESS_TITLE}
              </Text>
              <Text style={styles.successText}>
                {submitSuccessMessage ?? DEFAULT_SUCCESS_MESSAGE}
              </Text>
              <TouchableOpacity style={styles.successBtn} onPress={handleClose} activeOpacity={0.85}>
                <Text style={styles.successBtnText}>حسناً، فهمت</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: 'flex-end',
    elevation: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 0,
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    flexDirection: 'column',
    zIndex: 1,
    overflow: 'hidden',
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1A3A5C' },
  closeBtn: { fontSize: 24, color: '#6B7280' },
  typeStepWrap: { minHeight: 240, flexGrow: 1, flexShrink: 1 },
  typeGridScroll: { flexGrow: 1, flexShrink: 1 },
  typeGridContent: {
    flexDirection: 'column',
    paddingHorizontal: TYPE_GRID_H_PAD,
    paddingTop: 0,
    paddingBottom: 30,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: TYPE_GRID_GAP,
    marginBottom: TYPE_GRID_GAP,
    alignItems: 'stretch',
  },
  typeHint: {
    fontSize: 16, fontWeight: '600', color: '#374151',
    textAlign: 'center', marginBottom: 16, width: '100%',
  },
  noTypesText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginTop: 20, width: '100%' },
  coords: {
    fontSize: 12, color: '#6B7280',
    marginBottom: 10, marginTop: 4,
    textAlign: 'right', width: '100%', lineHeight: 18,
  },
  typeCard: {
    flexDirection: 'column', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 16,
    padding: 12, borderWidth: 1.5, borderColor: '#E5E7EB', gap: 8,
  },
  typeIconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  typeEmoji: { fontSize: 26 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: '#1A3A5C', textAlign: 'center' },
  selectedTypeBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F9FF', borderRadius: 12,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#BAE6FD', gap: 8,
  },
  selectedTypeBadgeArrow: { fontSize: 14, color: '#2E86AB' },
  selectedTypeDot: { width: 8, height: 8, borderRadius: 4 },
  selectedTypeBadgeText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1A3A5C', textAlign: 'right' },
  selectedTypeChange: { fontSize: 13, color: '#2E86AB', fontWeight: '600' },
  formStep: { flexShrink: 1, flexGrow: 1, minHeight: 280, maxHeight: 520 },
  bodyScroll: { flexGrow: 1, flexShrink: 1 },
  bodyScrollContent: { padding: 20, paddingBottom: 12 },
  submitFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  submitBtn: {
    backgroundColor: '#2E86AB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 4 }, opacity: 0.3, radius: 8, elevation: 8 }),
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnPressed: { opacity: 0.9 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  successScroll: { maxHeight: 520 },
  successScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    alignItems: 'center',
  },
  successCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
    ...shadow({ color: '#15803D', offset: { width: 0, height: 6 }, opacity: 0.35, radius: 12, elevation: 10 }),
  },
  successCheck: { color: '#fff', fontSize: 52, fontWeight: '300', lineHeight: 56, marginTop: -4 },
  successHeadline: {
    fontSize: 22, fontWeight: '800', color: '#14532D',
    textAlign: 'center', marginBottom: 14, paddingHorizontal: 8,
  },
  successText: { fontSize: 16, lineHeight: 26, color: '#4B5563', textAlign: 'center', paddingHorizontal: 4 },
  successBtn: {
    marginTop: 26, alignSelf: 'stretch',
    backgroundColor: '#2E86AB', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 24,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 4 }, opacity: 0.28, radius: 8, elevation: 6 }),
  },
  successBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
