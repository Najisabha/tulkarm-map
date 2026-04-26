import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { api, PlaceType } from '../../api/client';
import { categoryService } from '../../services/categoryService';
import { PlaceKind } from '../../types/place';
import { ensureAndFetchAttributeDefinitions } from '../../utils/admin/ensurePlaceTypeAttrDefs';
import { parseAttrUiOptions } from '../../utils/admin/categoryAdminHelpers';
import { getPlaceAttrDefsForType } from '../../utils/placeFormAttrDefs';
import { validatePlaceForm } from '../../utils/placeFormValidation';
import {
  getAddPlaceModalPhotoLabel,
  getPlaceTypeDisplayName,
  getPlaceTypePluralLabel,
  getPlaceTypeProductCategoryFieldLabels,
  isDisallowedComplexUnitChildTypeName,
  needsPlaceCategoryTree,
  normalizePlaceTypeKind,
  resolveCanonicalPlaceTypeKey,
  usesPlacePhoneAsStoreNumberField,
  usesProductCategoryFieldsForPlaceType,
} from '../../utils/placeTypeLabels';
import { isInsideTulkarm } from '../../utils/tulkarmGovernorate';
import { CategoryItem } from '../places/CategorySelector';
import { ErrorBanner } from '../places/ErrorBanner';
import { PlaceForm, PlaceFormState } from '../places/PlaceForm';
import {
  TYPE_CARD_WIDTH,
  TYPE_PICKER_MAX_H,
  addPlaceModalStyles as styles,
} from './addPlaceModal.styles';

const MAX_PHOTOS = 3;

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
  sortOrder: number;
}

export interface AddPlaceModalProps {
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
  /** Auto-select a type by canonical name (e.g. 'منزل') and skip the type picker */
  initialTypeName?: string;
  /** Pre-fill form fields when opening */
  initialFormOverrides?: Partial<PlaceFormState>;
  /** استبعاد مجمّع تجاري/سكني وإظهار خطوة اختيار النوع (وحدات داخل المجمّع) */
  complexUnitChildPicker?: boolean;
  /** تسمية الوحدة مثل "3-2" — تُعرَض كاسم افتراضي وتُملأ house_number للمنزل */
  complexUnitLabel?: string;
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
  initialTypeName,
  initialFormOverrides,
  complexUnitChildPicker,
  complexUnitLabel,
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
  const [loadingPlaceCategories, setLoadingPlaceCategories] = useState(false);
  const [mainToSubs, setMainToSubs] = useState<Record<string, CategoryItem[]>>({});

  const selectedTypeSingularLabel = selectedType
    ? getPlaceTypeDisplayName(selectedType.name)
    : 'مكان';
  const productCategoryFormLabels = selectedType
    ? getPlaceTypeProductCategoryFieldLabels(selectedType.name)
    : null;
  const addPlacePhotoLabel = selectedType
    ? getAddPlaceModalPhotoLabel(selectedType.name)
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

  const showPhotos = !!addPlacePhotoLabel;

  const photoLabel = addPlacePhotoLabel ?? '';

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
        list.push({
          id: t.id,
          name: t.name,
          emoji: t.emoji || '📍',
          color: t.color || '#2E86AB',
          sortOrder: typeof t.sort_order === 'number' ? t.sort_order : 100,
        });
      }
      list.sort((a, b) => {
        const d = a.sortOrder - b.sortOrder;
        return d !== 0 ? d : a.name.localeCompare(b.name, 'ar');
      });
      const filtered = complexUnitChildPicker
        ? list.filter((t) => !isDisallowedComplexUnitChildTypeName(t.name))
        : list;
      setPlaceTypes(filtered);
    } catch {
      setPlaceTypes([]);
    } finally {
      setLoadingTypes(false);
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
    void loadPlaceTypes().then(() => {
      if (initialTypeName && !complexUnitChildPicker) {
        // Auto-select matching type and skip to form
        setPlaceTypes((prev) => {
          const match = prev.find(
            (t) => resolveCanonicalPlaceTypeKey(t.name) === initialTypeName || t.name === initialTypeName,
          );
          if (match) {
            // We need to call handleSelectType logic inline because we're inside an effect
            setSelectedType(match);
            const overrides = initialFormOverrides ?? {};
            setFormState((fs) => ({
              ...fs,
              dynamicValues: { ...overrides.dynamicValues },
              photos: overrides.photos ?? [],
              name: overrides.name ?? fs.name,
              description: overrides.description ?? fs.description,
              phoneNumber: overrides.phoneNumber ?? fs.phoneNumber,
            }));
            void (async () => {
              try {
                const defs = await ensureAndFetchAttributeDefinitions(match.id, match.name);
                setAttrDefs(defs);
              } catch {
                setAttrDefs(getPlaceAttrDefsForType(match.name));
              }
              if (needsPlaceCategoryTree(match.name)) {
                void loadPlaceCategoriesTree(match.id);
              }
              setStep('form');
            })();
          }
          return prev;
        });
      }
    });
  }, [visible]);

  const handleClose = () => { reset(); onClose(); };

  const handleSelectType = async (type: PlaceTypeUI) => {
    setSelectedType(type);
    const unitLabel = (complexUnitLabel ?? '').trim();
    const kind = normalizePlaceTypeKind(type.name);
    const initialDynamic: Record<string, string> = {};
    if (complexUnitChildPicker && unitLabel && kind === 'house') {
      initialDynamic.house_number = unitLabel;
    }
    setFormState((prev) => ({
      ...prev,
      dynamicValues: initialDynamic,
      photos: [],
      name:
        complexUnitChildPicker && unitLabel
          ? `وحدة ${unitLabel}`
          : prev.name,
    }));
    setSubCategories([]);
    setShowMainCategoryList(false);
    setShowSubCategoryList(false);
    try {
      const defs = await ensureAndFetchAttributeDefinitions(type.id, type.name);
      setAttrDefs(defs);
    } catch {
      setAttrDefs(getPlaceAttrDefsForType(type.name));
    }
    if (needsPlaceCategoryTree(type.name)) {
      void loadPlaceCategoriesTree(type.id);
    }
    setStep('form');
  };

  const loadPlaceCategoriesTree = async (placeTypeId: string) => {
    setLoadingPlaceCategories(true);
    try {
      const tree = await categoryService.getPlaceCategoryTree(placeTypeId);
      const mains = tree.map((t) => ({
        id: t.main.id,
        name: t.main.name,
        emoji: t.main.emoji ?? null,
        color: t.main.color ?? null,
      }));
      const map: Record<string, CategoryItem[]> = {};
      for (const t of tree) {
        map[t.main.id] = (t.sub_categories || []).map((s) => ({
          id: s.id,
          name: s.name,
          emoji: s.emoji ?? null,
          color: s.color ?? null,
        }));
      }
      setMainCategories(mains);
      setMainToSubs(map);
    } catch {
      setMainCategories([]);
      setMainToSubs({});
    } finally {
      setLoadingPlaceCategories(false);
    }
  };

  const handleMainSelect = async (name: string, id: string, color: string) => {
    setFormState((prev) => ({
      ...prev,
      dynamicValues: { ...prev.dynamicValues, store_type: name, store_category: '' },
    }));
    setSelectedMainCategoryColor(color);
    setShowMainCategoryList(false);
    setSubCategories(mainToSubs[id] ?? []);
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

    const dynamicRequired = attrDefs
      .filter((d) => d.is_required && (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') === 'dynamic')
      .map((d) => ({ key: d.key, label: d.label }));
    const requiredName = attrDefs.some(
      (d) => d.is_required && (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') === 'place_name',
    );
    const requiredDescription = attrDefs.some(
      (d) => d.is_required && (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') === 'place_description',
    );
    const requiredPhone = attrDefs.some(
      (d) => d.is_required && (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') === 'place_phone',
    );
    const requiredPhotos = attrDefs.some(
      (d) => d.is_required && (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') === 'place_photos',
    );

    const unifiedPlacePhone = usesPlacePhoneAsStoreNumberField(selectedType.name);
    const isHouse = placeKind === 'house';
    const isComplex = placeKind === 'complex';
    const validation = validatePlaceForm({
      name: formState.name,
      description: formState.description,
      typeId: selectedType.id,
      phoneNumber: unifiedPlacePhone || isHouse || isComplex ? '' : formState.phoneNumber,
      storeNumberIsPlacePhone: unifiedPlacePhone,
      photosCount: formState.photos.length,
      dynamicValues: formState.dynamicValues,
      requiredAttrKeys: dynamicRequired,
      requiredName,
      requiredDescription,
      requiredPhone: requiredPhone && !(unifiedPlacePhone || isHouse || isComplex),
      requiredPhotos,
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
      const reservedKeys = new Set(
        attrDefs
          .filter((d) => (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') !== 'dynamic')
          .map((d) => d.key),
      );
      const attrs = Object.entries(formState.dynamicValues)
        .filter(([key, v]) => {
          if (reservedKeys.has(key)) return false;
          if (unifiedPlacePhone && key === 'store_number') return false;
          return v.trim();
        })
        .map(([key, value]) => {
          const def = attrDefs.find((d) => d.key === key);
          return { key, value: value.trim(), value_type: def?.value_type || 'string' };
        });

      const phoneOut = unifiedPlacePhone
        ? (formState.dynamicValues.store_number || '').trim() || undefined
        : isHouse || isComplex
          ? undefined
          : formState.phoneNumber.trim() || undefined;

      await onSubmit({
        name: formState.name.trim(),
        description: formState.description.trim(),
        type_id: selectedType.id,
        type_name: selectedType.name,
        latitude,
        longitude,
        photos: formState.photos.length ? formState.photos : undefined,
        dynamicAttributes: attrs.length ? attrs : undefined,
        phoneNumber: phoneOut,
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
                  <ActivityIndicator size="large" color="#2E86AB" style={styles.typeLoadingIndicator} />
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
                    {initialTypeName ? (
                      <View style={styles.selectedTypeBadge}>
                        <View style={[styles.selectedTypeDot, { backgroundColor: selectedType.color }]} />
                        <Text style={styles.selectedTypeBadgeText}>
                          {selectedType.emoji} {selectedTypeSingularLabel}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.selectedTypeBadge} onPress={() => setStep('type')}>
                        <Text style={styles.selectedTypeBadgeArrow}>→</Text>
                        <View style={[styles.selectedTypeDot, { backgroundColor: selectedType.color }]} />
                        <Text style={styles.selectedTypeBadgeText}>
                          {selectedType.emoji} {selectedTypeSingularLabel}
                        </Text>
                        <Text style={styles.selectedTypeChange}>تغيير</Text>
                      </TouchableOpacity>
                    )}

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
                      loadingCategories={loadingPlaceCategories}
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
                      onLoadSubCategories={(mainId) => setSubCategories(mainToSubs[mainId] ?? [])}
                      showPhotos={showPhotos}
                      maxPhotos={MAX_PHOTOS}
                      hidePhoneField={
                        usesPlacePhoneAsStoreNumberField(selectedType.name) ||
                        placeKind === 'house' ||
                        placeKind === 'complex'
                      }
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
