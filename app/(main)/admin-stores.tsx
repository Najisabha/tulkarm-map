import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, type PlaceData } from '../../api/client';
import { adminStoresStyles as styles } from '../../components/admin/AdminStores.styles';
import { AdminUnauthorized } from '../../components/admin/AdminUnauthorized';
import { ComplexResidentialHousesModal } from '../../components/admin/stores/ComplexResidentialHousesModal';
import { ComplexUnitsManager, type ComplexUnitsManagerHandle } from '../../components/admin/stores/ComplexUnitsManager';
import { PlaceCard } from '../../components/places/PlaceCard';
import { CategoryItem, CategorySelector } from '../../components/places/CategorySelector';
import { LAYOUT } from '../../constants/layout';
import { TULKARM_REGION } from '../../constants/tulkarmRegion';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoryContext';
import { Store, useStores } from '../../context/StoreContext';
import { useAdminStoresFilters } from '../../hooks/admin/useAdminStoresFilters';
import { parseAttrUiOptions, sortAttributeDefinitions } from '../../utils/admin/categoryAdminHelpers';
import { shouldLoadPlaceCategoryTree, usesPlacePhoneAsStoreNumberField } from '../../utils/placeTypeLabels';
import { fetchPlaceTypeAttributeDefinitions } from '../../utils/admin/ensurePlaceTypeAttrDefs';
import {
  catColor,
  catEmoji,
  fetchPlaceCategoryTreeData,
  findSubCategoryNameInMap,
  storeToDomainPlace,
} from '../../utils/admin/storesHelpers';
import { isActiveStore } from '../../utils/map/storeStatus';

interface AttrDef {
  id: string;
  key: string;
  label: string;
  value_type: string;
  is_required: boolean;
  options?: unknown;
}

interface EditableImage {
  id?: string;
  image_url: string;
}

const ATTR_LABELS: Record<string, string> = {
  house_number: 'رقم المنزل',
  store_number: 'رقم الهاتف',
  location_text: 'الموقع',
  store_type: 'التصنيف الرئيسي',
  store_category: 'التصنيف الفرعي',
  complex_number: 'رقم المجمع',
  floors_count: 'عدد الطوابق',
  houses_per_floor: 'المنازل بكل طابق',
  stores_per_floor: 'المتاجر بكل طابق',
  phone: 'رقم الهاتف',
};

export default function AdminStoresScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editStoreId?: string; kind?: string }>();
  const { user } = useAuth();
  const { categories } = useCategories();
  const { stores, deleteStore, refreshStores } = useStores();
  const managedStores = stores;
  const filters = useAdminStoresFilters(managedStores, params.kind);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const unitsManagerRef = useRef<ComplexUnitsManagerHandle>(null);
  const [showResidentialHousesModal, setShowResidentialHousesModal] = useState(false);
  const [selectedResidentialComplex, setSelectedResidentialComplex] = useState<Store | null>(null);
  const [showCategoryFilterModal, setShowCategoryFilterModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingUnits, setSavingUnits] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editImages, setEditImages] = useState<EditableImage[]>([]);
  const [editForm, setEditForm] = useState({ name: '', description: '', category: '', lat: '', lng: '', dynamicAttrs: {} as Record<string, string> });
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: categories[0]?.name ?? '',
    lat: String(TULKARM_REGION.latitude),
    lng: String(TULKARM_REGION.longitude),
    dynamicAttrs: {} as Record<string, string>,
  });
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [editAttrDefs, setEditAttrDefs] = useState<AttrDef[]>([]);

  const editingIsComplex = useMemo(() => {
    const cat = String(editingStore?.category || '');
    return cat === 'مجمّع سكني' || cat === 'مجمّع تجاري';
  }, [editingStore?.id, editingStore?.category]);

  const [addPcMainCategories, setAddPcMainCategories] = useState<CategoryItem[]>([]);
  const [addPcSubCategories, setAddPcSubCategories] = useState<CategoryItem[]>([]);
  const [addPcMainToSubs, setAddPcMainToSubs] = useState<Record<string, CategoryItem[]>>({});
  const [loadingAddPcTree, setLoadingAddPcTree] = useState(false);
  const [addPcShowMainList, setAddPcShowMainList] = useState(false);
  const [addPcShowSubList, setAddPcShowSubList] = useState(false);
  const [addPcMainColor, setAddPcMainColor] = useState('#2E86AB');
  const [addPcCategoryIds, setAddPcCategoryIds] = useState<{ mainId: string | null; subId: string | null }>({
    mainId: null,
    subId: null,
  });

  const [editPcMainCategories, setEditPcMainCategories] = useState<CategoryItem[]>([]);
  const [editPcSubCategories, setEditPcSubCategories] = useState<CategoryItem[]>([]);
  const [editPcMainToSubs, setEditPcMainToSubs] = useState<Record<string, CategoryItem[]>>({});
  const [loadingEditPcTree, setLoadingEditPcTree] = useState(false);
  const [editPcShowMainList, setEditPcShowMainList] = useState(false);
  const [editPcShowSubList, setEditPcShowSubList] = useState(false);
  const [editPcMainColor, setEditPcMainColor] = useState('#2E86AB');
  const [editPcCategoryIds, setEditPcCategoryIds] = useState<{ mainId: string | null; subId: string | null }>({
    mainId: null,
    subId: null,
  });

  useEffect(() => {
    if (categories.length > 0 && !form.category?.trim()) {
      setForm((f) => ({ ...f, category: categories[0].name }));
    }
  }, [categories]);

  useEffect(() => {
    const id = params.editStoreId;
    if (id && stores.length > 0) {
      const store = stores.find((s) => s.id === id);
      if (store) {
        openEdit(store);
        router.setParams({ editStoreId: undefined });
      }
    }
  }, [params.editStoreId, stores]);

  const canManageUnits = useMemo(() => {
    const cat = String(editingStore?.category || '');
    return cat === 'مجمّع سكني' || cat === 'مجمّع تجاري';
  }, [editingStore?.id, editingStore?.category]);

  const handleCategoryChange = async (catName: string, isEdit: boolean) => {
    if (isEdit && editingIsComplex) return;
    const cat = categories.find((c) => c.name === catName);
    let defs: AttrDef[] = [];
    if (cat?.id) {
      try {
        defs = await fetchPlaceTypeAttributeDefinitions(cat.id);
      } catch {
        defs = [];
      }
    }
    if (isEdit) setEditAttrDefs(defs);
    else setAttrDefs(defs);
    if (shouldLoadPlaceCategoryTree(catName, defs) && cat?.id) {
      setLoadingAddPcTree(!isEdit);
      setLoadingEditPcTree(!!isEdit);
      try {
        const { mains, map } = await fetchPlaceCategoryTreeData(cat.id);
        if (isEdit) {
          setEditPcMainCategories(mains);
          setEditPcMainToSubs(map);
          setEditPcSubCategories([]);
          setEditPcCategoryIds({ mainId: null, subId: null });
          setEditForm((p) => ({ ...p, category: catName, dynamicAttrs: {} }));
        } else {
          setAddPcMainCategories(mains);
          setAddPcMainToSubs(map);
          setAddPcSubCategories([]);
          setAddPcCategoryIds({ mainId: null, subId: null });
          setForm((p) => ({ ...p, category: catName, dynamicAttrs: {} }));
        }
      } catch {
        if (isEdit) {
          setEditPcMainCategories([]);
          setEditPcMainToSubs({});
          setEditPcSubCategories([]);
        } else {
          setAddPcMainCategories([]);
          setAddPcMainToSubs({});
          setAddPcSubCategories([]);
        }
        if (isEdit) setEditForm((p) => ({ ...p, category: catName, dynamicAttrs: {} }));
        else setForm((p) => ({ ...p, category: catName, dynamicAttrs: {} }));
      } finally {
        setLoadingAddPcTree(false);
        setLoadingEditPcTree(false);
      }
    } else {
      if (isEdit) {
        setEditPcMainCategories([]);
        setEditPcMainToSubs({});
        setEditPcSubCategories([]);
        setEditPcCategoryIds({ mainId: null, subId: null });
        setEditForm((p) => ({ ...p, category: catName, dynamicAttrs: {} }));
      } else {
        setAddPcMainCategories([]);
        setAddPcMainToSubs({});
        setAddPcSubCategories([]);
        setAddPcCategoryIds({ mainId: null, subId: null });
        setForm((p) => ({ ...p, category: catName, dynamicAttrs: {} }));
      }
    }
  };

  if (!user?.isAdmin) {
    return <AdminUnauthorized onBackToMap={() => router.back()} />;
  }

  const defaultCategory = categories[0]?.name ?? '';

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      category: defaultCategory,
      lat: String(TULKARM_REGION.latitude),
      lng: String(TULKARM_REGION.longitude),
      dynamicAttrs: {},
    });
    setAttrDefs([]);
    setAddPcMainCategories([]);
    setAddPcMainToSubs({});
    setAddPcSubCategories([]);
    setAddPcCategoryIds({ mainId: null, subId: null });
    setAddPcShowMainList(false);
    setAddPcShowSubList(false);
    setAddPcMainColor('#2E86AB');
  };

  const handleOpenAdd = async () => {
    resetForm();
    if (defaultCategory) {
      const cat = categories.find((c) => c.name === defaultCategory);
      let defs: AttrDef[] = [];
      if (cat?.id) {
        try {
          defs = await fetchPlaceTypeAttributeDefinitions(cat.id);
          setAttrDefs(defs);
        } catch {
          defs = [];
          setAttrDefs([]);
        }
      } else {
        setAttrDefs([]);
      }
      if (shouldLoadPlaceCategoryTree(defaultCategory, defs)) {
        const catForTree = categories.find((c) => c.name === defaultCategory);
        if (catForTree?.id) {
          setLoadingAddPcTree(true);
          try {
            const { mains, map } = await fetchPlaceCategoryTreeData(catForTree.id);
            setAddPcMainCategories(mains);
            setAddPcMainToSubs(map);
            setAddPcSubCategories([]);
          } catch {
            setAddPcMainCategories([]);
            setAddPcMainToSubs({});
            setAddPcSubCategories([]);
          } finally {
            setLoadingAddPcTree(false);
          }
        }
      }
    }
    setShowAddModal(true);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u064A\u0631\u062C\u0649 \u062A\u0639\u0628\u0626\u0629 \u0627\u0644\u0627\u0633\u0645');
      return;
    }
    if (!form.category.trim() || categories.length === 0) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u0623\u0636\u0641 \u0641\u0626\u0629 \u0623\u0648\u0644\u0627\u064B \u0645\u0646 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0641\u0626\u0627\u062A');
      return;
    }
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A \u0635\u062D\u064A\u062D\u0629');
      return;
    }
    const cat = categories.find((c) => c.name === form.category);
    if (!cat) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u0627\u0644\u0646\u0648\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F');
      return;
    }
    setSaving(true);
    try {
      const unifiedPhone = usesPlacePhoneAsStoreNumberField(form.category);
      const treeMode = shouldLoadPlaceCategoryTree(form.category, attrDefs);
      const reservedKeys = new Set(
        attrDefs
          .filter((d) => (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') !== 'dynamic')
          .map((d) => d.key),
      );
      const attributes = Object.entries(form.dynamicAttrs)
        .filter(([key, v]) => {
          if (reservedKeys.has(key)) return false;
          if (!v.trim()) return false;
          if (unifiedPhone && key === 'store_number') return false;
          return true;
        })
        .map(([key, value]) => {
          const def = attrDefs.find((d) => d.key === key);
          return { key, value: value.trim(), value_type: def?.value_type || 'string' };
        });
      const phoneDef = attrDefs.find(
        (d) => (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') === 'place_phone',
      );
      await api.createPlaceFromAdmin({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type_id: cat.id,
        latitude: lat,
        longitude: lng,
        phone_number: unifiedPhone
          ? form.dynamicAttrs['store_number']?.trim() || undefined
          : phoneDef
            ? form.dynamicAttrs[phoneDef.key]?.trim() || undefined
            : undefined,
        main_category_id: treeMode ? addPcCategoryIds.mainId ?? undefined : undefined,
        sub_category_id: treeMode ? addPcCategoryIds.subId ?? undefined : undefined,
        attributes: attributes.length ? attributes : undefined,
      });

      await refreshStores();
      setShowAddModal(false);
      resetForm();
      Alert.alert('\u2705 \u062A\u0645', '\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0643\u0627\u0646 \u0628\u0646\u062C\u0627\u062D!');
    } catch (e: any) {
      Alert.alert('\u062E\u0637\u0623', e?.message || '\u0641\u0634\u0644 \u0627\u0644\u0625\u0636\u0627\u0641\u0629');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (store: Store) => {
    setEditingStore(store);
    setShowUnitsModal(false);
    setShowResidentialHousesModal(false);
    setEditPcShowMainList(false);
    setEditPcShowSubList(false);
    if (store.images && store.images.length > 0) {
      setEditImages(store.images.map((img) => ({ id: img.id, image_url: img.image_url })));
    } else {
      setEditImages((store.photos || []).map((u) => ({ image_url: u })));
    }
    const existingAttrs: Record<string, string> = {};
    if (store.attributes) {
      for (const attr of store.attributes) {
        existingAttrs[attr.key] = attr.value;
      }
    }

    let fullPlace: PlaceData | null = null;
    try {
      const res = await api.getPlace(store.id);
      fullPlace = res.data ?? null;
    } catch {
      fullPlace = null;
    }

    if (fullPlace?.attributes?.length) {
      for (const attr of fullPlace.attributes) {
        existingAttrs[attr.key] = String(attr.value ?? '');
      }
    }

    const typeDisplayName = fullPlace?.type_name ?? store.category;
    const placeTypeId =
      fullPlace?.type_id ?? store.type_id ?? categories.find((c) => c.name === typeDisplayName)?.id ?? null;

    const unifiedPhone = usesPlacePhoneAsStoreNumberField(typeDisplayName);
    if (unifiedPhone && !existingAttrs['store_number'] && fullPlace?.phone_number) {
      existingAttrs['store_number'] = fullPlace.phone_number;
    }

    let mainIdResolved: string | null = fullPlace?.main_category_id ?? null;
    let subIdResolved: string | null = fullPlace?.sub_category_id ?? null;

    let defsForEdit: AttrDef[] = [];
    if (placeTypeId) {
      try {
        defsForEdit = await fetchPlaceTypeAttributeDefinitions(placeTypeId);
      } catch {
        defsForEdit = [];
      }
    }
    if (defsForEdit.length === 0) {
      const inferredSrc = fullPlace?.attributes ?? store.attributes;
      defsForEdit = (inferredSrc || []).map((a) => ({
        id: `inferred-${a.key}`,
        key: a.key,
        label: ATTR_LABELS[a.key] || a.key.replaceAll('_', ' '),
        value_type: a.value_type || 'string',
        is_required: false,
      }));
    }

    if (shouldLoadPlaceCategoryTree(typeDisplayName, defsForEdit) && placeTypeId) {
      setLoadingEditPcTree(true);
      try {
        const { mains, map } = await fetchPlaceCategoryTreeData(placeTypeId);
        setEditPcMainCategories(mains);
        setEditPcMainToSubs(map);

        if (mainIdResolved) {
          const m = mains.find((x) => x.id === mainIdResolved);
          if (m) {
            if (!existingAttrs['store_type']) existingAttrs['store_type'] = m.name;
            setEditPcMainColor(m.color || '#2E86AB');
            setEditPcSubCategories(map[mainIdResolved] ?? []);
          }
        } else if (existingAttrs['store_type']) {
          const m = mains.find((x) => x.name === existingAttrs['store_type']);
          if (m) {
            mainIdResolved = m.id;
            setEditPcMainColor(m.color || '#2E86AB');
            setEditPcSubCategories(map[m.id] ?? []);
          }
        }

        if (subIdResolved) {
          const sName = findSubCategoryNameInMap(map, subIdResolved);
          if (sName && !existingAttrs['store_category']) existingAttrs['store_category'] = sName;
        } else if (existingAttrs['store_category'] && mainIdResolved) {
          const subs = map[mainIdResolved] ?? [];
          const s = subs.find((x) => x.name === existingAttrs['store_category']);
          if (s) subIdResolved = s.id;
        }

        // استنتاج التصنيف الرئيسي تلقائياً من التصنيف الفرعي عند غياب الرئيسي.
        if (!mainIdResolved && (subIdResolved || existingAttrs['store_category'])) {
          let resolvedMain: CategoryItem | null = null;
          let resolvedSub: CategoryItem | null = null;
          for (const main of mains) {
            const subs = map[main.id] ?? [];
            const subMatch = subIdResolved
              ? subs.find((x) => x.id === subIdResolved)
              : subs.find((x) => x.name === existingAttrs['store_category']);
            if (subMatch) {
              resolvedMain = main;
              resolvedSub = subMatch;
              break;
            }
          }

          if (resolvedMain) {
            mainIdResolved = resolvedMain.id;
            existingAttrs['store_type'] = resolvedMain.name;
            setEditPcMainColor(resolvedMain.color || '#2E86AB');
            setEditPcSubCategories(map[resolvedMain.id] ?? []);
          }
          if (resolvedSub) {
            subIdResolved = resolvedSub.id;
            existingAttrs['store_category'] = resolvedSub.name;
          }
        }

        setEditPcCategoryIds({ mainId: mainIdResolved, subId: subIdResolved });
      } catch {
        setEditPcMainCategories([]);
        setEditPcMainToSubs({});
        setEditPcSubCategories([]);
        setEditPcCategoryIds({ mainId: null, subId: null });
      } finally {
        setLoadingEditPcTree(false);
      }
    } else {
      setEditPcMainCategories([]);
      setEditPcMainToSubs({});
      setEditPcSubCategories([]);
      setEditPcCategoryIds({ mainId: null, subId: null });
    }

    if (!unifiedPhone && fullPlace?.phone_number) {
      const phoneKey =
        defsForEdit.find((d) => (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') === 'place_phone')?.key ??
        'place_phone';
      if (!String(existingAttrs[phoneKey] ?? '').trim()) {
        existingAttrs[phoneKey] = fullPlace.phone_number;
      }
    }

    setEditForm({
      name: fullPlace?.name ?? store.name,
      description: fullPlace?.description ?? store.description ?? '',
      category: typeDisplayName,
      lat: String(fullPlace?.latitude ?? store.latitude),
      lng: String(fullPlace?.longitude ?? store.longitude),
      dynamicAttrs: existingAttrs,
    });

    setEditAttrDefs(defsForEdit);
  };

  const handleAddPcMainSelect = (name: string, id: string, color: string) => {
    setAddPcMainColor(color);
    setAddPcShowMainList(false);
    setAddPcSubCategories(addPcMainToSubs[id] ?? []);
    setAddPcCategoryIds({ mainId: id, subId: null });
    setForm((p) => ({ ...p, dynamicAttrs: { ...p.dynamicAttrs, store_type: name, store_category: '' } }));
  };

  const handleAddPcSubSelect = (name: string) => {
    const sub = addPcSubCategories.find((s) => s.name === name);
    setAddPcShowSubList(false);
    setAddPcCategoryIds((prev) => ({ ...prev, subId: sub?.id ?? null }));
    setForm((p) => ({ ...p, dynamicAttrs: { ...p.dynamicAttrs, store_category: name } }));
  };

  const handleEditPcMainSelect = (name: string, id: string, color: string) => {
    setEditPcMainColor(color);
    setEditPcShowMainList(false);
    setEditPcSubCategories(editPcMainToSubs[id] ?? []);
    setEditPcCategoryIds({ mainId: id, subId: null });
    setEditForm((p) => ({ ...p, dynamicAttrs: { ...p.dynamicAttrs, store_type: name, store_category: '' } }));
  };

  const handleEditPcSubSelect = (name: string) => {
    const sub = editPcSubCategories.find((s) => s.name === name);
    setEditPcShowSubList(false);
    setEditPcCategoryIds((prev) => ({ ...prev, subId: sub?.id ?? null }));
    setEditForm((p) => ({ ...p, dynamicAttrs: { ...p.dynamicAttrs, store_category: name } }));
  };

  const handleAddEditImage = async () => {
    if (!editingStore) return;
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          Alert.alert('تنبيه', 'نحتاج إذن الوصول للصور');
          return;
        }
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const b64 = picked.assets[0].base64;
      if (!b64) {
        Alert.alert('تنبيه', 'تعذر قراءة الصورة');
        return;
      }
      setSaving(true);
      const mime = picked.assets[0].mimeType || 'image/jpeg';
      const uploaded = await api.uploadBase64(`data:${mime};base64,${b64}`);
      await api.addPlaceImage(editingStore.id, uploaded.data.url);
      setEditImages((prev) => [...prev, { image_url: uploaded.data.url }]);
      await refreshStores();
      Alert.alert('✅ تم', 'تمت إضافة الصورة');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل إضافة الصورة');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveEditImage = async (img: EditableImage) => {
    if (!editingStore) return;
    if (!img.id) {
      Alert.alert('تنبيه', 'لا يمكن حذف هذه الصورة لأنها غير مرتبطة بمعرّف في الخادم');
      return;
    }
    try {
      setSaving(true);
      await api.removePlaceImage(editingStore.id, img.id);
      setEditImages((prev) => prev.filter((x) => x.id !== img.id));
      await refreshStores();
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل حذف الصورة');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingStore) return;
    if (!editForm.name.trim()) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u064A\u0631\u062C\u0649 \u062A\u0639\u0628\u0626\u0629 \u0627\u0644\u0627\u0633\u0645');
      return;
    }
    const lat = parseFloat(editForm.lat);
    const lng = parseFloat(editForm.lng);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('\u062A\u0646\u0628\u064A\u0647', '\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A \u0635\u062D\u064A\u062D\u0629');
      return;
    }
    const treeModeEdit = shouldLoadPlaceCategoryTree(editForm.category, editAttrDefs);
    const hasMainCategorySelection =
      !!editPcCategoryIds.mainId || !!editForm.dynamicAttrs['store_type']?.trim();
    if (treeModeEdit && !hasMainCategorySelection) {
      Alert.alert(
        'تنبيه',
        'يرجى اختيار التصنيف الرئيسي (حقل مطلوب) قبل الحفظ.',
      );
      return;
    }
    try {
      const cat = categories.find((c) => c.name === editForm.category);
      const unifiedPhone = usesPlacePhoneAsStoreNumberField(editForm.category);
      const reservedKeys = new Set(
        editAttrDefs
          .filter((d) => (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') !== 'dynamic')
          .map((d) => d.key),
      );

      const attributes = Object.entries(editForm.dynamicAttrs)
        .filter(([key, v]) => {
          if (reservedKeys.has(key)) return false;
          if (!v.trim()) return false;
          if (unifiedPhone && key === 'store_number') return false;
          return true;
        })
        .map(([key, value]) => {
          const def = editAttrDefs.find((d) => d.key === key);
          return { key, value: value.trim(), value_type: def?.value_type || 'string' };
        });

      const payload: Record<string, any> = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        type_id: cat?.id,
        latitude: lat,
        longitude: lng,
        attributes: attributes.length ? attributes : undefined,
      };

      if (unifiedPhone) {
        payload.phone_number = editForm.dynamicAttrs['store_number']?.trim() || null;
      } else {
        const phoneDef = editAttrDefs.find(
          (d) => (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') === 'place_phone',
        );
        if (phoneDef) {
          payload.phone_number = editForm.dynamicAttrs[phoneDef.key]?.trim() || null;
        }
      }

      if (treeModeEdit) {
        payload.main_category_id = editPcCategoryIds.mainId ?? null;
        payload.sub_category_id = editPcCategoryIds.subId ?? null;
      }

      await api.updatePlace(editingStore.id, payload);
      await refreshStores();
      setEditingStore(null);
      Alert.alert('\u2705 \u062A\u0645', '\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0643\u0627\u0646');
    } catch (e: any) {
      Alert.alert('\u062E\u0637\u0623', e?.message || '\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u062F\u064A\u062B');
    }
  };

  const handleDelete = (store: Store) => {
    const title = '\u062D\u0630\u0641 \u0627\u0644\u0645\u0643\u0627\u0646';
    const msg = `\u0647\u0644 \u0623\u0646\u062A \u0645\u062A\u0623\u0643\u062F \u0645\u0646 \u062D\u0630\u0641 "${store.name}"\u061F`;

    const doDelete = async () => {
      try {
        await deleteStore(store.id);
        setEditingStore(null);
        if (Platform.OS === 'web') {
          (globalThis as any)?.alert?.('\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0643\u0627\u0646');
        } else {
          Alert.alert('\u062A\u0645', '\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0643\u0627\u0646');
        }
      } catch (e: any) {
        const errMsg = e?.message || '\u0641\u0634\u0644 \u0627\u0644\u062D\u0630\u0641';
        if (Platform.OS === 'web') {
          (globalThis as any)?.alert?.(errMsg);
        } else {
          Alert.alert('\u062E\u0637\u0623', errMsg);
        }
      }
    };

    if (Platform.OS === 'web') {
      const ok = (globalThis as any)?.confirm ? (globalThis as any).confirm(msg) : true;
      if (ok) void doDelete();
      return;
    }

    Alert.alert(title, msg, [
      { text: '\u0625\u0644\u063A\u0627\u0621', style: 'cancel' },
      { text: '\u062D\u0630\u0641', style: 'destructive', onPress: () => void doDelete() },
    ]);
  };

  const toggleVisibility = async (store: Store) => {
    const isActive = String(store.status || '').toLowerCase() === 'active';
    // Backend only allows `rejected` for pending requests; for hiding published places use `pending`.
    const nextStatus = isActive ? 'pending' : 'active';
    try {
      setSaving(true);
      await api.updatePlace(store.id, { status: nextStatus });
      await refreshStores();
      Alert.alert('✅ تم', isActive ? 'تم إخفاء المكان' : 'تم إظهار المكان');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل تحديث حالة المكان');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUnits = async () => {
    if (!editingStore) return;
    setSavingUnits(true);
    try {
      const ok = await unitsManagerRef.current?.saveAllLinks();
      if (!ok) return;
      setShowUnitsModal(false);
      await openEdit(editingStore);
    } finally {
      setSavingUnits(false);
    }
  };

  const renderAttrFields = (
    defs: AttrDef[],
    values: Record<string, string>,
    onChange: (key: string, value: string) => void,
    treeCtx: {
      mode: 'add' | 'edit';
      categoryName: string;
      mainCategories: CategoryItem[];
      subCategories: CategoryItem[];
      loading: boolean;
      showMain: boolean;
      showSub: boolean;
      selectedMainColor: string;
      onOpenMain: () => void;
      onCloseMain: () => void;
      onMainSelect: (name: string, id: string, color: string) => void;
      onOpenSub: () => void;
      onCloseSub: () => void;
      onSubSelect: (name: string) => void;
    } | null,
    core: {
      name: string;
      description: string;
      lat: string;
      lng: string;
      onNameChange: (t: string) => void;
      onDescriptionChange: (t: string) => void;
      onLatChange: (t: string) => void;
      onLngChange: (t: string) => void;
    },
    formVariant: 'add' | 'edit',
    editPhotos?: {
      images: EditableImage[];
      onAdd: () => void;
      onRemove: (img: EditableImage) => void;
      saving: boolean;
    },
  ) => {
    const sorted = sortAttributeDefinitions(defs);
    const useTree = Boolean(treeCtx && shouldLoadPlaceCategoryTree(treeCtx.categoryName, defs));
    const mainLab = defs.find((d) => d.key === 'store_type')?.label ?? 'التصنيف الرئيسي';
    const subLab = defs.find((d) => d.key === 'store_category')?.label ?? 'التصنيف الفرعي';
    const hasStoreTypeField = defs.some((d) => d.key === 'store_type');

    return (
      <>
        {useTree && treeCtx && !hasStoreTypeField ? (
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>
              {mainLab} *
            </Text>
            <CategorySelector
              mainCategories={treeCtx.mainCategories}
              subCategories={treeCtx.subCategories}
              selectedMain={values.store_type || ''}
              selectedSub={values.store_category || ''}
              selectedMainColor={treeCtx.selectedMainColor}
              loading={treeCtx.loading}
              mainLabel={mainLab}
              subLabel={subLab}
              showMainList={treeCtx.showMain}
              showSubList={treeCtx.showSub}
              onOpenMainList={treeCtx.onOpenMain}
              onCloseMainList={treeCtx.onCloseMain}
              onMainSelect={treeCtx.onMainSelect}
              onOpenSubList={treeCtx.onOpenSub}
              onCloseSubList={treeCtx.onCloseSub}
              onSubSelect={treeCtx.onSubSelect}
            />
          </View>
        ) : null}
        {sorted.map((def) => {
          const ui = parseAttrUiOptions(def.options);
          const uiRole = ui.uiRole ?? 'dynamic';

          if (uiRole === 'place_name') {
            return (
              <View key={def.id} style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {def.label}
                  {def.is_required !== false ? ' *' : ''}
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={core.name}
                  onChangeText={core.onNameChange}
                  textAlign="right"
                />
              </View>
            );
          }
          if (uiRole === 'place_description') {
            return (
              <View key={def.id} style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {def.label}
                  {def.is_required ? ' *' : ''}
                </Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  value={core.description}
                  onChangeText={core.onDescriptionChange}
                  multiline
                  textAlign="right"
                />
              </View>
            );
          }
          if (uiRole === 'place_location') {
            return (
              <View key={def.id} style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {def.label}
                  {def.is_required ? ' *' : ''}
                </Text>
                <View style={styles.coordsRow}>
                  <TextInput
                    style={[styles.formInput, styles.coordInput]}
                    placeholder={'\u062E\u0637 \u0627\u0644\u0639\u0631\u0636'}
                    value={core.lat}
                    onChangeText={core.onLatChange}
                    keyboardType="decimal-pad"
                    textAlign="center"
                  />
                  <TextInput
                    style={[styles.formInput, styles.coordInput]}
                    placeholder={'\u062E\u0637 \u0627\u0644\u0637\u0648\u0644'}
                    value={core.lng}
                    onChangeText={core.onLngChange}
                    keyboardType="decimal-pad"
                    textAlign="center"
                  />
                </View>
              </View>
            );
          }
          if (uiRole === 'place_phone') {
            return (
              <View key={def.id} style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {def.label}
                  {def.is_required ? ' *' : ''}
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={'\u0645\u062B\u0627\u0644: 059xxxxxxx'}
                  value={values[def.key] || ''}
                  onChangeText={(t) => onChange(def.key, t)}
                  keyboardType="phone-pad"
                  textAlign="right"
                />
              </View>
            );
          }
          if (uiRole === 'place_photos') {
            if (formVariant === 'add' || !editPhotos) return null;
            return (
              <View key={def.id} style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {def.label} ({editPhotos.images.length})
                </Text>
                {editPhotos.images.length > 0 ? (
                  <View style={styles.photosWrap}>
                    {editPhotos.images.map((img, idx) => (
                      <View key={`${img.image_url}-${idx}`} style={styles.photoItemWrap}>
                        <Image source={{ uri: img.image_url }} style={styles.photoThumb} />
                        <TouchableOpacity
                          style={styles.photoDeleteBtn}
                          onPress={() => void editPhotos.onRemove(img)}
                          disabled={editPhotos.saving}
                        >
                          <Text style={styles.photoDeleteBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noPhotosText}>لا توجد صور محفوظة لهذا المكان</Text>
                )}
                <TouchableOpacity
                  style={[styles.addPhotoBtn, editPhotos.saving && styles.submitBtnDisabled]}
                  onPress={() => void editPhotos.onAdd()}
                  disabled={editPhotos.saving}
                >
                  <Text style={styles.addPhotoBtnText}>📷 إضافة صورة</Text>
                </TouchableOpacity>
              </View>
            );
          }

          if (uiRole !== 'dynamic') return null;
          if (def.key === 'store_category' && useTree) {
            return null;
          }

          const isPhone = def.value_type === 'phone';
          const kbType = isPhone ? 'phone-pad' : def.value_type === 'number' ? 'numeric' : 'default';

          if (def.key === 'store_type' && useTree && treeCtx) {
            return (
              <View key={def.id} style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {mainLab}
                  {def.is_required ? ' *' : ''}
                </Text>
                <CategorySelector
                  mainCategories={treeCtx.mainCategories}
                  subCategories={treeCtx.subCategories}
                  selectedMain={values.store_type || ''}
                  selectedSub={values.store_category || ''}
                  selectedMainColor={treeCtx.selectedMainColor}
                  loading={treeCtx.loading}
                  mainLabel={mainLab}
                  subLabel={subLab}
                  showMainList={treeCtx.showMain}
                  showSubList={treeCtx.showSub}
                  onOpenMainList={treeCtx.onOpenMain}
                  onCloseMainList={treeCtx.onCloseMain}
                  onMainSelect={treeCtx.onMainSelect}
                  onOpenSubList={treeCtx.onOpenSub}
                  onCloseSubList={treeCtx.onCloseSub}
                  onSubSelect={treeCtx.onSubSelect}
                />
              </View>
            );
          }

          return (
            <View key={def.id} style={styles.formGroup}>
              <Text style={styles.formLabel}>{def.label}{def.is_required ? ' *' : ''}</Text>
              {def.value_type === 'boolean' ? (
                <TouchableOpacity
                  style={[styles.boolToggle, values[def.key] === 'true' && styles.boolToggleActive]}
                  onPress={() => onChange(def.key, values[def.key] === 'true' ? 'false' : 'true')}
                >
                  <Text style={styles.boolToggleText}>
                    {values[def.key] === 'true' ? '\u2705 \u0646\u0639\u0645' : '\u274C \u0644\u0627'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  style={styles.formInput}
                  placeholder={isPhone ? 'مثال: 059xxxxxxx' : def.label}
                  value={values[def.key] || ''}
                  onChangeText={(t) => onChange(def.key, t)}
                  keyboardType={kbType}
                  textAlign="right"
                />
              )}
            </View>
          );
        })}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            const canGoBack = (router as any)?.canGoBack?.();
            if (canGoBack) router.back();
            else router.replace('/(main)/admin');
          }}
        >
          <Text style={styles.backBtnText}>{'\u2192'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{filters.screenTitle}</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{managedStores.length} {'\u0645\u0643\u0627\u0646'}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionCountBadge}>
              <Text style={styles.sectionCountBadgeText}>{filters.filteredStores.length}</Text>
            </View>
            <Text style={styles.sectionTitle}>{filters.listTitle}</Text>
          </View>
          <View style={styles.sectionActionsRow}>
            <TouchableOpacity
              style={[
                styles.filterBtn,
                filters.categoryFilter !== 'all' && styles.filterBtnActive,
              ]}
              onPress={() => setShowCategoryFilterModal(true)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  filters.categoryFilter !== 'all' && styles.filterBtnTextActive,
                ]}
                numberOfLines={1}
              >
                🧩 {filters.categoryFilter === 'all' ? 'فلترة الفئات' : filters.categoryFilter}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
              <Text style={styles.addBtnText}>+ {'\u0625\u0636\u0627\u0641\u0629 \u0645\u0643\u0627\u0646'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.housesStatsRow}>
          <TouchableOpacity
            style={[styles.housesStatChip, styles.housesVisibleChip, filters.statusFilter === 'visible' && styles.housesStatChipActive]}
            onPress={() => filters.setStatusFilter((prev) => (prev === 'visible' ? 'all' : 'visible'))}
            activeOpacity={0.85}
          >
            <Text style={styles.housesVisibleText}>{filters.filterSubjectLabel} الظاهرة: {filters.visibleCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.housesStatChip, styles.housesHiddenChip, filters.statusFilter === 'hidden' && styles.housesStatChipActive]}
            onPress={() => filters.setStatusFilter((prev) => (prev === 'hidden' ? 'all' : 'hidden'))}
            activeOpacity={0.85}
          >
            <Text style={styles.housesHiddenText}>{filters.filterSubjectLabel} المخفية: {filters.hiddenCount}</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="بحث بالاسم أو الفئة..."
          value={filters.searchQuery}
          onChangeText={filters.setSearchQuery}
          textAlign="right"
          placeholderTextColor="#9CA3AF"
        />

        {filters.filteredStores.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>{'\u{1F3EA}'}</Text>
            <Text style={styles.emptyStateText}>
              {managedStores.length === 0
                ? '\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0645\u0627\u0643\u0646 \u0628\u0639\u062F'
                : '\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u062A\u0627\u0626\u062C \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0628\u062D\u062B'}
            </Text>
            <TouchableOpacity style={styles.emptyStateBtn} onPress={handleOpenAdd}>
              <Text style={styles.emptyStateBtnText}>{'\u0625\u0636\u0627\u0641\u0629 \u0623\u0648\u0644 \u0645\u0643\u0627\u0646'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filters.filteredStores.map((store) => {
              const typeColor = catColor(categories, store.category);
              const isResidentialComplex = String(store.category || '') === 'مجمّع سكني';
              return (
                <View key={store.id} style={styles.storeCard}>
                  <TouchableOpacity style={styles.storeCardBody} onPress={() => openEdit(store)} activeOpacity={0.75}>
                    <View style={styles.storeCardTop}>
                      <View style={[styles.storeTypeIcon, { backgroundColor: typeColor + '22' }]}>
                        <Text style={styles.storeTypeIconEmoji}>{catEmoji(categories, store.category)}</Text>
                      </View>
                      <View style={styles.storeCardMain}>
                        <PlaceCard place={storeToDomainPlace(store)} />
                      </View>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.storeActionRow}>
                  {isResidentialComplex && (
                    <TouchableOpacity
                      style={[styles.storeActionBtn, styles.storeActionEdit]}
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        setSelectedResidentialComplex(store);
                        setShowResidentialHousesModal(true);
                      }}
                      activeOpacity={0.85}
                      disabled={saving}
                    >
                      <Text style={styles.storeActionEditText}>🏠 منازل المجمع السكني</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.storeActionBtn,
                      isActiveStore(store) ? styles.storeActionHide : styles.storeActionShow,
                    ]}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      void toggleVisibility(store);
                    }}
                    activeOpacity={0.85}
                    disabled={saving}
                  >
                    <Text style={isActiveStore(store) ? styles.storeActionHideText : styles.storeActionShowText}>
                      {isActiveStore(store) ? '🙈 إخفاء' : '👁️ إظهار'}
                    </Text>
                  </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.storeActionBtn, styles.storeActionEdit]}
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        void openEdit(store);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.storeActionEditText}>{'\u270E'} {'\u062A\u0639\u062F\u064A\u0644'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.storeActionBtn, styles.storeActionDelete]}
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        handleDelete(store);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.storeActionDeleteText}>{'\u{1F5D1}'} {'\u062D\u0630\u0641'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={LAYOUT.keyboardBehavior}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
              <Text style={styles.modalCancelText}>{'\u0625\u0644\u063A\u0627\u0621'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{'\u0625\u0636\u0627\u0641\u0629 \u0645\u0643\u0627\u0646 \u062C\u062F\u064A\u062F'}</Text>
            <TouchableOpacity onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#2E86AB" /> : <Text style={styles.modalSaveText}>{'\u062D\u0641\u0638'}</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{'\u0627\u0644\u0641\u0626\u0629'}</Text>
              <View style={styles.chipsWrap}>
                {[...categories].sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((cat) => (
                  <TouchableOpacity key={cat.id} style={[styles.categoryChip, form.category === cat.name && styles.categoryChipActive]} onPress={() => handleCategoryChange(cat.name, false)}>
                    <Text style={[styles.categoryChipText, form.category === cat.name && styles.categoryChipTextActive]}>{cat.emoji} {cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {renderAttrFields(
              attrDefs,
              form.dynamicAttrs,
              (key, value) => setForm((p) => ({ ...p, dynamicAttrs: { ...p.dynamicAttrs, [key]: value } })),
              shouldLoadPlaceCategoryTree(form.category, attrDefs)
                ? {
                    mode: 'add',
                    categoryName: form.category,
                    mainCategories: addPcMainCategories,
                    subCategories: addPcSubCategories,
                    loading: loadingAddPcTree,
                    showMain: addPcShowMainList,
                    showSub: addPcShowSubList,
                    selectedMainColor: addPcMainColor,
                    onOpenMain: () => setAddPcShowMainList(true),
                    onCloseMain: () => setAddPcShowMainList(false),
                    onMainSelect: handleAddPcMainSelect,
                    onOpenSub: () => setAddPcShowSubList(true),
                    onCloseSub: () => setAddPcShowSubList(false),
                    onSubSelect: handleAddPcSubSelect,
                  }
                : null,
              {
                name: form.name,
                description: form.description,
                lat: form.lat,
                lng: form.lng,
                onNameChange: (t) => setForm((p) => ({ ...p, name: t })),
                onDescriptionChange: (t) => setForm((p) => ({ ...p, description: t })),
                onLatChange: (t) => setForm((p) => ({ ...p, lat: t })),
                onLngChange: (t) => setForm((p) => ({ ...p, lng: t })),
              },
              'add',
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editingStore} animationType="slide">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={LAYOUT.keyboardBehavior}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingStore(null)}>
              <Text style={styles.modalCancelText}>{'\u0625\u0644\u063A\u0627\u0621'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{'\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A'}</Text>
            <TouchableOpacity onPress={handleSaveEdit}>
              <Text style={styles.modalSaveText}>{'\u062D\u0641\u0638'}</Text>
            </TouchableOpacity>
          </View>
          {editingStore && (
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{'\u0627\u0644\u0641\u0626\u0629'}</Text>
                {editingIsComplex ? (
                  <Text style={styles.categoryLockedHint}>لا يمكن تعديل فئة المجمعات السكنية/التجارية</Text>
                ) : null}
                <View style={styles.chipsWrap}>
                  {[...categories].sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        editForm.category === cat.name && styles.categoryChipActive,
                        editingIsComplex && styles.categoryChipDisabled,
                      ]}
                      onPress={() => {
                        if (editingIsComplex) return;
                        void handleCategoryChange(cat.name, true);
                      }}
                      activeOpacity={0.85}
                      disabled={editingIsComplex}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          editForm.category === cat.name && styles.categoryChipTextActive,
                          editingIsComplex && styles.categoryChipTextDisabled,
                        ]}
                      >
                        {cat.emoji} {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {renderAttrFields(
                editAttrDefs,
                editForm.dynamicAttrs,
                (key, value) => setEditForm((p) => ({ ...p, dynamicAttrs: { ...p.dynamicAttrs, [key]: value } })),
                shouldLoadPlaceCategoryTree(editForm.category, editAttrDefs)
                  ? {
                      mode: 'edit',
                      categoryName: editForm.category,
                      mainCategories: editPcMainCategories,
                      subCategories: editPcSubCategories,
                      loading: loadingEditPcTree,
                      showMain: editPcShowMainList,
                      showSub: editPcShowSubList,
                      selectedMainColor: editPcMainColor,
                      onOpenMain: () => setEditPcShowMainList(true),
                      onCloseMain: () => setEditPcShowMainList(false),
                      onMainSelect: handleEditPcMainSelect,
                      onOpenSub: () => setEditPcShowSubList(true),
                      onCloseSub: () => setEditPcShowSubList(false),
                      onSubSelect: handleEditPcSubSelect,
                    }
                  : null,
                {
                  name: editForm.name,
                  description: editForm.description,
                  lat: editForm.lat,
                  lng: editForm.lng,
                  onNameChange: (t) => setEditForm((p) => ({ ...p, name: t })),
                  onDescriptionChange: (t) => setEditForm((p) => ({ ...p, description: t })),
                  onLatChange: (t) => setEditForm((p) => ({ ...p, lat: t })),
                  onLngChange: (t) => setEditForm((p) => ({ ...p, lng: t })),
                },
                'edit',
                {
                  images: editImages,
                  onAdd: handleAddEditImage,
                  onRemove: handleRemoveEditImage,
                  saving,
                },
              )}

              {canManageUnits && (
                <TouchableOpacity
                  style={styles.unitsBtn}
                  onPress={() => setShowUnitsModal(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.unitsBtnText}>🏢 إدارة وحدات المجمع</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.deleteBtn} onPress={() => editingStore && handleDelete(editingStore)}>
                <Text style={styles.deleteBtnText}>{'\u{1F5D1}\uFE0F'} {'\u062D\u0630\u0641 \u0627\u0644\u0645\u0643\u0627\u0646'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Complex Units Modal */}
      <Modal visible={showUnitsModal && !!editingStore} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowUnitsModal(false)}>
              <Text style={styles.modalCancelText}>إغلاق</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>وحدات المجمع</Text>
            <TouchableOpacity
              onPress={() => void handleSaveUnits()}
              disabled={saving || savingUnits}
            >
              {savingUnits ? <ActivityIndicator color="#2E86AB" /> : <Text style={styles.modalSaveText}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ComplexUnitsManager
            ref={unitsManagerRef}
            placeId={editingStore?.id || ''}
            complexLabel={editingStore?.category || ''}
          />
        </View>
      </Modal>

      <ComplexResidentialHousesModal
        visible={showResidentialHousesModal}
        complexStore={selectedResidentialComplex}
        allStores={stores}
        onClose={() => setShowResidentialHousesModal(false)}
        onOpenHouse={(houseStore) => openEdit(houseStore)}
      />

      <Modal
        visible={showCategoryFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryFilterModal(false)}
      >
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalCard}>
            <Text style={styles.filterModalTitle}>فلترة حسب الفئة</Text>
            <ScrollView style={styles.filterModalList}>
              <TouchableOpacity
                style={[
                  styles.filterModalOption,
                  filters.categoryFilter === 'all' && styles.filterModalOptionActive,
                ]}
                onPress={() => {
                  filters.setCategoryFilter('all');
                  setShowCategoryFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.filterModalOptionText,
                    filters.categoryFilter === 'all' && styles.filterModalOptionTextActive,
                  ]}
                >
                  جميع الفئات
                </Text>
              </TouchableOpacity>
              {categories
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                .map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.filterModalOption,
                      filters.categoryFilter === cat.name && styles.filterModalOptionActive,
                    ]}
                    onPress={() => {
                      filters.setCategoryFilter(cat.name);
                      setShowCategoryFilterModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.filterModalOptionText,
                        filters.categoryFilter === cat.name && styles.filterModalOptionTextActive,
                      ]}
                    >
                      {cat.emoji} {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.filterModalCloseBtn}
              onPress={() => setShowCategoryFilterModal(false)}
            >
              <Text style={styles.filterModalCloseBtnText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
