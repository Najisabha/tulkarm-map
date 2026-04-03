import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, PlaceType } from '../api/client';
import { shadow } from '../utils/shadowStyles';
import {
  getPlaceTypeDisplayName,
  getPlaceTypePluralLabel,
  normalizePlaceTypeKind,
  type PlaceTypeKind,
} from '../utils/placeTypeLabels';

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
  }) => Promise<void>;
  latitude: number;
  longitude: number;
  /** If set, shown instead of the default “تم إضافة المكان” (e.g. pending approval copy). */
  submitSuccessTitle?: string;
  submitSuccessMessage?: string;
}

const DEFAULT_SUCCESS_TITLE = '\u2705 \u062A\u0645';
const DEFAULT_SUCCESS_MESSAGE = '\u062A\u0645 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0643\u0627\u0646 \u0628\u0646\u062C\u0627\u062D';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({});
  const [productMainCategories, setProductMainCategories] = useState<{ id: string; name: string; emoji?: string | null; arrow_color?: string | null }[]>([]);
  const [productSubCategories, setProductSubCategories] = useState<{ id: string; name: string; emoji?: string | null; arrow_color?: string | null }[]>([]);
  const [selectedMainCategoryColor, setSelectedMainCategoryColor] = useState<string>('#2E86AB');
  const [showMainCategoryList, setShowMainCategoryList] = useState(false);
  const [showSubCategoryList, setShowSubCategoryList] = useState(false);
  const [loadingProductCategories, setLoadingProductCategories] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedTypeSingularLabel = selectedType ? getPlaceTypeDisplayName(selectedType.name) : 'مكان';

  const loadPlaceTypes = async () => {
    setLoadingTypes(true);
    try {
      const res = await api.getPlaceTypes();
      const apiTypes: PlaceType[] = res.data || [];

      // توحيد عرض الخيارات وإزالة التكرار:
      // أحياناً يحصل fallback لـ `/api/categories` وتطلع أنواع إضافية/مكررة
      // بنفس “اللايبل” (مثل عدة عناصر تنطبع كلها كـ "أخرى").
      // المطلوب دائماً: منزل، متجر تجاري، مجمع تجاري، مجمع سكني، أخرى (كل نوع مرة واحدة فقط).
      const canonicalNameByKind: Record<PlaceTypeKind, string> = {
        house: 'منزل',
        store: 'متجر تجاري',
        commercialComplex: 'مجمّع تجاري',
        residentialComplex: 'مجمّع سكني',
        other: 'أخرى',
      };

      const kindOrder: PlaceTypeKind[] = ['house', 'store', 'commercialComplex', 'residentialComplex', 'other'];

      const byKind: Partial<Record<PlaceTypeKind, PlaceTypeUI>> = {};

      for (const t of apiTypes) {
        const kind = normalizePlaceTypeKind(t.name);
        const ui: PlaceTypeUI = {
          id: t.id,
          name: t.name,
          emoji: t.emoji || '\u{1F4CD}',
          color: t.color || '#2E86AB',
        };

        const existing = byKind[kind];
        const canonicalName = canonicalNameByKind[kind];

        // إذا فيه أكثر من نوع ينمط لنفس الـkind، نُفضّل الـentry المطابقة للاسم الكنسي (إن وجد).
        if (!existing || ui.name === canonicalName) {
          byKind[kind] = ui;
        }
      }

      setPlaceTypes(kindOrder.map((k) => byKind[k]).filter(Boolean) as PlaceTypeUI[]);
    } catch {
      setPlaceTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  };

  const getFixedAttrDefsForType = (typeName: string): AttributeDefinition[] => {
    const kind = normalizePlaceTypeKind(typeName);
    const uid = (s: string) => `fixed-${kind}-${s}`;

    switch (kind) {
      case 'house':
        return [
          { id: uid('house_number'), key: 'house_number', label: 'رقم المنزل', value_type: 'string', is_required: true },
        ];
      case 'store':
        return [
          { id: uid('store_type'), key: 'store_type', label: 'التصنيف الرئيسي للمتجر', value_type: 'string', is_required: true },
          { id: uid('store_category'), key: 'store_category', label: 'التصنيف الفرعي للمتجر', value_type: 'string', is_required: true },
          { id: uid('store_number'), key: 'store_number', label: 'رقم المتجر', value_type: 'string', is_required: true },
        ];
      case 'residentialComplex':
        return [
          { id: uid('complex_number'), key: 'complex_number', label: 'رقم المجمع', value_type: 'string', is_required: true },
          { id: uid('location_text'), key: 'location_text', label: 'مكان المجمع', value_type: 'string', is_required: true },
          { id: uid('floors_count'), key: 'floors_count', label: 'عدد طوابق المجمع', value_type: 'number', is_required: true },
          {
            id: uid('houses_per_floor'),
            key: 'houses_per_floor',
            label: 'عدد المنازل داخل كل طابق (JSON)',
            value_type: 'json',
            is_required: true,
          },
        ];
      case 'commercialComplex':
        return [
          { id: uid('complex_number'), key: 'complex_number', label: 'رقم المجمع التجاري', value_type: 'string', is_required: true },
          { id: uid('location_text'), key: 'location_text', label: 'مكان المجمع التجاري', value_type: 'string', is_required: true },
          { id: uid('floors_count'), key: 'floors_count', label: 'عدد طوابق المجمع التجاري', value_type: 'number', is_required: true },
          {
            id: uid('stores_per_floor'),
            key: 'stores_per_floor',
            label: 'عدد المتاجر داخل كل طابق (JSON)',
            value_type: 'json',
            is_required: true,
          },
        ];
      case 'other':
      default:
        return [
          { id: uid('location_text'), key: 'location_text', label: 'مكان المكان', value_type: 'string', is_required: false },
        ];
    }
  };

  const reset = () => {
    setStep('type');
    setSelectedType(null);
    setAttrDefs([]);
    setName('');
    setDescription('');
    setDynamicValues({});
    setPhotos([]);
  };

  useEffect(() => {
    if (!visible) return;
    reset();
    void loadPlaceTypes();
  }, [visible]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectType = (type: PlaceTypeUI) => {
    setSelectedType(type);
    setDynamicValues({});
    setProductSubCategories([]);
    setShowMainCategoryList(false);
    setShowSubCategoryList(false);
    setAttrDefs(getFixedAttrDefsForType(type.name));
    if (normalizePlaceTypeKind(type.name) === 'store') {
      void loadMainProductCategories();
    }
    setStep('form');
  };

  const loadMainProductCategories = async () => {
    try {
      setLoadingProductCategories(true);
      const res = await api.getProductMainCategories();
      const list = Array.isArray(res.data) ? res.data : [];
      setProductMainCategories(
        list.map((x) => ({ id: x.id, name: x.name, emoji: x.emoji ?? null, arrow_color: x.arrow_color ?? null }))
      );
    } catch {
      setProductMainCategories([]);
    } finally {
      setLoadingProductCategories(false);
    }
  };

  const loadSubProductCategories = async (mainId: string) => {
    if (!mainId) {
      setProductSubCategories([]);
      return;
    }
    try {
      setLoadingProductCategories(true);
      const res = await api.getProductSubCategories(mainId);
      const list = Array.isArray(res.data) ? res.data : [];
      setProductSubCategories(
        list.map((x) => ({ id: x.id, name: x.name, emoji: (x as any).emoji ?? null, arrow_color: (x as any).arrow_color ?? null }))
      );
    } catch {
      setProductSubCategories([]);
    } finally {
      setLoadingProductCategories(false);
    }
  };

  const pickImage = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', `\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 ${MAX_PHOTOS} \u0635\u0648\u0631`);
      return;
    }
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u0646\u062D\u062A\u0627\u062C \u0625\u0630\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0635\u0648\u0631');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((p) => [...p, result.assets[0].uri].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (idx: number) => setPhotos((p) => p.filter((_, i) => i !== idx));

  const setDynamic = (key: string, value: string) => {
    setDynamicValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u064A\u0631\u062C\u0649 \u062A\u0639\u0628\u0626\u0629 \u0627\u0644\u0627\u0633\u0645');
      return;
    }
    if (!selectedType) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0646\u0648\u0639 \u0627\u0644\u0645\u0643\u0627\u0646');
      return;
    }

    const missingRequired = attrDefs.filter(
      (d) => d.is_required && !dynamicValues[d.key]?.trim()
    );
    if (missingRequired.length > 0) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', `\u064A\u0631\u062C\u0649 \u062A\u0639\u0628\u0626\u0629: ${missingRequired.map((d) => d.label).join('\u060C ')}`);
      return;
    }

    setLoading(true);
    try {
      const attrs = Object.entries(dynamicValues)
        .filter(([, v]) => v.trim())
        .map(([key, value]) => {
          const def = attrDefs.find((d) => d.key === key);
          return { key, value: value.trim(), value_type: def?.value_type || 'string' };
        });

      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        type_id: selectedType.id,
        type_name: selectedType.name,
        latitude,
        longitude,
        photos: photos.length ? photos : undefined,
        dynamicAttributes: attrs.length ? attrs : undefined,
      });
      setStep('success');
    } catch (e: any) {
      Alert.alert('\u062E\u0637\u0623', e?.message || '\u062D\u062F\u062B \u062E\u0637\u0623\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u0627\u064B');
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
                ? '\u0637\u0644\u0628\u0643 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629'
                : step === 'type'
                  ? '\u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0627\u0644\u0645\u0643\u0627\u0646'
                  : `\u0625\u0636\u0627\u0641\u0629 ${selectedTypeSingularLabel}`}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeBtn}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>

          {step === 'type' ? (
            <ScrollView style={styles.typeGrid} contentContainerStyle={{ paddingBottom: 30 }}>
              <Text style={styles.coords}>{'\u{1F4CC}'} {latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
              <Text style={styles.typeHint}>{'\u0645\u0627 \u0646\u0648\u0639 \u0647\u0630\u0627 \u0627\u0644\u0645\u0643\u0627\u0646\u061F'}</Text>

              {loadingTypes ? (
                <ActivityIndicator size="large" color="#2E86AB" style={{ marginTop: 20 }} />
              ) : placeTypes.length === 0 ? (
                <Text style={styles.noTypesText}>{'\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0646\u0648\u0627\u0639 \u0623\u0645\u0627\u0643\u0646. \u062A\u0623\u0643\u062F \u0645\u0646 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0623\u0648 \u0623\u0636\u0641 \u0623\u0646\u0648\u0627\u0639 \u0645\u0646 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.'}</Text>
              ) : (
                placeTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={styles.typeCard}
                    onPress={() => handleSelectType(type)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.typeIconCircle, { backgroundColor: type.color + '18' }]}>
                      <Text style={styles.typeEmoji}>{type.emoji}</Text>
                    </View>
                    <Text style={styles.typeLabel}>{getPlaceTypePluralLabel(type.name)}</Text>
                    <Text style={styles.typeArrow}>{'\u2190'}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          ) : step === 'form' ? (
            <View style={styles.formStep}>
              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={styles.bodyScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
              {selectedType ? (
                <>
                  <TouchableOpacity style={styles.selectedTypeBadge} onPress={() => setStep('type')}>
                    <Text style={styles.selectedTypeBadgeArrow}>{'\u2192'}</Text>
                    <View style={[styles.selectedTypeDot, { backgroundColor: selectedType.color }]} />
                    <Text style={styles.selectedTypeBadgeText}>
                      {selectedType.emoji} {selectedTypeSingularLabel}
                    </Text>
                    <Text style={styles.selectedTypeChange}>{'\u062A\u063A\u064A\u064A\u0631'}</Text>
                  </TouchableOpacity>

                  <Text style={styles.coords}>{'\u{1F4CC}'} {latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>

                  <Text style={styles.label}>
                    {selectedTypeSingularLabel === 'منزل'
                      ? '\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0632\u0644 *'
                      : selectedTypeSingularLabel === 'متجر تجاري'
                        ? '\u0627\u0633\u0645 \u0627\u0644\u0645\u062a\u062c\u0631 *'
                        : selectedTypeSingularLabel === 'مجمّع سكني'
                          ? '\u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0651\u0639 *'
                          : selectedTypeSingularLabel === 'مجمّع تجاري'
                            ? '\u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0651\u0639 \u0627\u0644\u062a\u062c\u0627\u0631\u064a *'
                            : '\u0627\u0633\u0645 \u0627\u0644\u0645\u0643\u0627\u0646 *'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={
                      selectedTypeSingularLabel === 'منزل'
                        ? '\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0632\u0644'
                        : selectedTypeSingularLabel === 'متجر تجاري'
                          ? '\u0627\u0633\u0645 \u0627\u0644\u0645\u062a\u062c\u0631'
                          : selectedTypeSingularLabel === 'مجمّع سكني'
                            ? '\u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0651\u0639'
                            : selectedTypeSingularLabel === 'مجمّع تجاري'
                              ? '\u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0651\u0639 \u0627\u0644\u062a\u062c\u0627\u0631\u064a'
                              : '\u0627\u0633\u0645 \u0627\u0644\u0645\u0643\u0627\u0646'
                    }
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={setName}
                    textAlign="right"
                  />

                  <Text style={styles.label}>{'\u0627\u0644\u0648\u0635\u0641'}</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    placeholder={'\u0648\u0635\u0641 \u0645\u062E\u062A\u0635\u0631 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)'}
                    placeholderTextColor="#9CA3AF"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    textAlign="right"
                  />

                  {/* Fixed schema fields per place type (client-side) */}
                  {attrDefs.map((def) => (
                    <View key={def.id}>
                      <Text style={styles.label}>
                        {def.label + (def.is_required ? ' *' : '')}
                      </Text>
                      {def.key === 'store_type' ? (
                        <>
                          <TouchableOpacity style={styles.input} onPress={() => setShowMainCategoryList(true)}>
                            <View style={styles.selectedCategoryRow}>
                              <View style={[styles.selectedCategoryDot, { backgroundColor: selectedMainCategoryColor || '#2E86AB' }]} />
                              <Text style={styles.selectedCategoryEmoji}>
                                {productMainCategories.find((x) => x.name === dynamicValues.store_type)?.emoji || '📦'}
                              </Text>
                              <Text style={[styles.selectText, !dynamicValues.store_type && styles.selectPlaceholder]}>
                                {dynamicValues.store_type || 'اختر التصنيف الرئيسي'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </>
                      ) : def.key === 'store_category' ? (
                        <>
                          {!!dynamicValues.store_type && (
                            <>
                              <TouchableOpacity
                                style={styles.input}
                                onPress={() => setShowSubCategoryList(true)}
                              >
                                <View style={styles.selectedCategoryRow}>
                                  <View style={[styles.selectedCategoryDot, { backgroundColor: selectedMainCategoryColor || '#2E86AB' }]} />
                                  <Text style={styles.selectedCategoryEmoji}>
                                    {productSubCategories.find((x) => x.name === dynamicValues.store_category)?.emoji || '🏷️'}
                                  </Text>
                                  <Text style={[styles.selectText, !dynamicValues.store_category && styles.selectPlaceholder]}>
                                    {dynamicValues.store_category || 'اختر التصنيف الفرعي'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            </>
                          )}
                        </>
                      ) : def.value_type === 'boolean' ? (
                        <TouchableOpacity
                          style={[
                            styles.booleanToggle,
                            dynamicValues[def.key] === 'true' && styles.booleanToggleActive,
                          ]}
                          onPress={() =>
                            setDynamic(def.key, dynamicValues[def.key] === 'true' ? 'false' : 'true')
                          }
                        >
                          <Text style={styles.booleanToggleText}>
                            {dynamicValues[def.key] === 'true' ? '\u2705 \u0646\u0639\u0645' : '\u274C \u0644\u0627'}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TextInput
                          style={styles.input}
                          placeholder={def.label}
                          placeholderTextColor="#9CA3AF"
                          value={dynamicValues[def.key] || ''}
                          onChangeText={(v) => setDynamic(def.key, v)}
                          keyboardType={def.value_type === 'number' ? 'numeric' : 'default'}
                          textAlign="right"
                        />
                      )}
                    </View>
                  ))}

                  {(selectedTypeSingularLabel === 'منزل' || selectedTypeSingularLabel === 'متجر تجاري') && (
                    <>
                      <Text style={styles.label}>
                        {selectedTypeSingularLabel === 'منزل' ? '\u0635\u0648\u0631 \u0627\u0644\u0645\u0646\u0632\u0644' : '\u0635\u0648\u0631 \u0627\u0644\u0645\u062a\u062c\u0631'} ({photos.length}/{MAX_PHOTOS})
                      </Text>
                      <View style={styles.mediaRow}>
                        {photos.map((uri, i) => (
                          <View key={i} style={styles.thumbWrap}>
                            <Image source={{ uri }} style={styles.thumb} />
                            <TouchableOpacity style={styles.removeThumb} onPress={() => removePhoto(i)}>
                              <Text style={styles.removeThumbText}>{'\u2715'}</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                        {photos.length < MAX_PHOTOS && (
                          <TouchableOpacity style={styles.addMediaBtn} onPress={pickImage}>
                            <Text style={styles.addMediaText}>
                              {'\u{1F4F7} '}{selectedTypeSingularLabel === 'منزل' ? '\u0625\u0636\u0627\u0641\u0629 \u0635\u0648\u0631 \u0627\u0644\u0645\u0646\u0632\u0644' : '\u0625\u0636\u0627\u0641\u0629 \u0635\u0648\u0631 \u0627\u0644\u0645\u062a\u062c\u0631'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}

                </>
              ) : null}
              </ScrollView>

              <View style={styles.submitFooter} pointerEvents="box-none">
                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    loading && styles.submitBtnDisabled,
                    pressed && !loading && styles.submitBtnPressed,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={'\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0643\u0627\u0646'}
                  hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>{'\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0643\u0627\u0646'}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView
              style={styles.successScroll}
              contentContainerStyle={styles.successScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.successCircle}>
                <Text style={styles.successCheck}>{'\u2713'}</Text>
              </View>
              <Text style={styles.successHeadline}>
                {submitSuccessTitle ?? DEFAULT_SUCCESS_TITLE}
              </Text>
              <Text style={styles.successText}>
                {submitSuccessMessage ?? DEFAULT_SUCCESS_MESSAGE}
              </Text>
              <TouchableOpacity style={styles.successBtn} onPress={handleClose} activeOpacity={0.85}>
                <Text style={styles.successBtnText}>{'\u062D\u0633\u0646\u0627\u064B\u060C \u0641\u0647\u0645\u062A'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>

      <Modal visible={showMainCategoryList} transparent animationType="slide" onRequestClose={() => setShowMainCategoryList(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setShowMainCategoryList(false)}>
                <Text style={styles.pickerClose}>إغلاق</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>اختر التصنيف الرئيسي</Text>
              <View style={{ width: 42 }} />
            </View>
            <ScrollView contentContainerStyle={styles.pickerList}>
              {loadingProductCategories ? (
                <ActivityIndicator color="#2E86AB" />
              ) : productMainCategories.length === 0 ? (
                <Text style={styles.selectEmpty}>لا توجد تصنيفات رئيسية</Text>
              ) : (
                productMainCategories.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.mainCategoryCard, { borderColor: item.arrow_color || '#2E86AB' }]}
                    onPress={async () => {
                      setDynamic('store_type', item.name);
                      setDynamic('store_category', '');
                      setSelectedMainCategoryColor(item.arrow_color || '#2E86AB');
                      setShowMainCategoryList(false);
                      await loadSubProductCategories(item.id);
                    }}
                  >
                    <View style={[styles.mainCategoryColorDot, { backgroundColor: item.arrow_color || '#2E86AB' }]} />
                    <Text style={styles.mainCategoryName}>{item.name}</Text>
                    <Text style={styles.mainCategoryEmoji}>{item.emoji || '📦'}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showSubCategoryList} transparent animationType="slide" onRequestClose={() => setShowSubCategoryList(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setShowSubCategoryList(false)}>
                <Text style={styles.pickerClose}>إغلاق</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>اختر التصنيف الفرعي</Text>
              <View style={{ width: 42 }} />
            </View>
            <ScrollView contentContainerStyle={styles.pickerList}>
              {loadingProductCategories ? (
                <ActivityIndicator color="#2E86AB" />
              ) : productSubCategories.length === 0 ? (
                <Text style={styles.selectEmpty}>لا توجد تصنيفات فرعية لهذا الرئيسي</Text>
              ) : (
                productSubCategories.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.mainCategoryCard, { borderColor: item.arrow_color || selectedMainCategoryColor || '#2E86AB' }]}
                    onPress={() => {
                      setDynamic('store_category', item.name);
                      setShowSubCategoryList(false);
                    }}
                  >
                    <View style={[styles.mainCategoryColorDot, { backgroundColor: item.arrow_color || selectedMainCategoryColor || '#2E86AB' }]} />
                    <Text style={styles.mainCategoryName}>{item.name}</Text>
                    <Text style={styles.mainCategoryEmoji}>{item.emoji || '🏷️'}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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

  typeGrid: { padding: 20, flexGrow: 0 },
  typeHint: {
    fontSize: 16, fontWeight: '600', color: '#374151',
    textAlign: 'center', marginBottom: 20,
  },
  noTypesText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginTop: 20 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  typeIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeEmoji: { fontSize: 26 },
  typeLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1A3A5C',
    textAlign: 'right',
    marginRight: 12,
  },
  typeArrow: { fontSize: 18, color: '#9CA3AF' },

  selectedTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 8,
  },
  selectedTypeBadgeArrow: { fontSize: 14, color: '#2E86AB' },
  selectedTypeDot: { width: 8, height: 8, borderRadius: 4 },
  selectedTypeBadgeText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1A3A5C', textAlign: 'right' },
  selectedTypeChange: { fontSize: 13, color: '#2E86AB', fontWeight: '600' },

  formStep: {
    flexShrink: 1,
    flexGrow: 1,
    minHeight: 280,
    maxHeight: 520,
  },
  bodyScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  bodyScrollContent: {
    padding: 20,
    paddingBottom: 12,
  },
  submitFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  coords: { fontSize: 12, color: '#6B7280', marginBottom: 16, textAlign: 'right' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, textAlign: 'right' },
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
  mediaRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 70, height: 70, borderRadius: 10 },
  selectedCategoryRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  selectedCategoryDot: { width: 10, height: 10, borderRadius: 5 },
  selectedCategoryEmoji: { fontSize: 16 },
  removeThumb: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeThumbText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addMediaBtn: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMediaText: { fontSize: 11, color: '#6B7280' },
  selectText: { fontSize: 15, color: '#111827', textAlign: 'right' },
  selectPlaceholder: { color: '#9CA3AF' },
  selectList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginTop: -8,
    marginBottom: 16,
  },
  selectItem: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectItemText: { textAlign: 'right', color: '#111827', fontWeight: '600' },
  selectEmpty: { textAlign: 'center', color: '#6B7280', paddingVertical: 12 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 14,
  },
  pickerCard: {
    maxHeight: '82%',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: '#1A3A5C' },
  pickerClose: { fontSize: 14, fontWeight: '700', color: '#2E86AB' },
  pickerList: { padding: 12, gap: 8 },
  mainCategoryCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
  },
  mainCategoryColorDot: { width: 12, height: 12, borderRadius: 6 },
  mainCategoryName: { flex: 1, textAlign: 'right', fontWeight: '800', color: '#111827' },
  mainCategoryEmoji: { fontSize: 20 },
  booleanToggle: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  booleanToggleActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  booleanToggleText: { fontSize: 15, fontWeight: '600', color: '#374151' },
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
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    ...shadow({ color: '#15803D', offset: { width: 0, height: 6 }, opacity: 0.35, radius: 12, elevation: 10 }),
  },
  successCheck: {
    color: '#fff',
    fontSize: 52,
    fontWeight: '300',
    lineHeight: 56,
    marginTop: -4,
  },
  successHeadline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#14532D',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  successText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#4B5563',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  successBtn: {
    marginTop: 26,
    alignSelf: 'stretch',
    backgroundColor: '#2E86AB',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 4 }, opacity: 0.28, radius: 8, elevation: 6 }),
  },
  successBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
