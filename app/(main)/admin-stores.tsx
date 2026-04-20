import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { parseAttrUiOptions } from '../../utils/admin/categoryAdminHelpers';
import {
  normalizePlaceTypeKind,
  needsPlaceCategoryTree,
  usesPlacePhoneAsStoreNumberField,
} from '../../utils/placeTypeLabels';
import { ensureAndFetchAttributeDefinitions } from '../../utils/admin/ensurePlaceTypeAttrDefs';
import { getPlaceAttrDefsForType } from '../../utils/placeFormAttrDefs';
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
  const [residentialChildIds, setResidentialChildIds] = useState<Set<string>>(new Set());
  const [commercialChildIds, setCommercialChildIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void api.getResidentialComplexChildPlaceIds()
      .then((res) => setResidentialChildIds(new Set(res?.data?.child_place_ids ?? [])))
      .catch(() => setResidentialChildIds(new Set()));
    void api.getCommercialComplexChildPlaceIds()
      .then((res) => setCommercialChildIds(new Set(res?.data?.child_place_ids ?? [])))
      .catch(() => setCommercialChildIds(new Set()));
  }, [stores]);

  const managedStores = useMemo(
    () =>
      stores.filter(
        (s) => !residentialChildIds.has(s.id) && !commercialChildIds.has(s.id),
      ),
    [stores, residentialChildIds, commercialChildIds],
  );
  const filters = useAdminStoresFilters(managedStores, params.kind);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const unitsManagerRef = useRef<ComplexUnitsManagerHandle>(null);
  const [showResidentialHousesModal, setShowResidentialHousesModal] = useState(false);
  const [selectedResidentialComplex, setSelectedResidentialComplex] = useState<Store | null>(null);
  const [saving, setSaving] = useState(false);
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
        defs = await ensureAndFetchAttributeDefinitions(cat.id, catName);
      } catch {
        defs = getPlaceAttrDefsForType(catName);
      }
    } else {
      defs = getPlaceAttrDefsForType(catName);
    }
    if (isEdit) setEditAttrDefs(defs);
    else setAttrDefs(defs);
    if (needsPlaceCategoryTree(catName) && cat?.id) {
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
      if (cat?.id) {
        try {
          const defs = await ensureAndFetchAttributeDefinitions(cat.id, defaultCategory);
          setAttrDefs(defs);
        } catch {
          setAttrDefs(getPlaceAttrDefsForType(defaultCategory));
        }
      } else {
        setAttrDefs(getPlaceAttrDefsForType(defaultCategory));
      }
      if (needsPlaceCategoryTree(defaultCategory)) {
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
      const treeMode = needsPlaceCategoryTree(form.category);
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
      await api.createPlaceFromAdmin({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type_id: cat.id,
        latitude: lat,
        longitude: lng,
        phone_number: unifiedPhone ? form.dynamicAttrs['store_number']?.trim() || undefined : undefined,
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

    const unifiedPhone = usesPlacePhoneAsStoreNumberField(store.category);
    if (unifiedPhone && !existingAttrs['store_number'] && fullPlace?.phone_number) {
      existingAttrs['store_number'] = fullPlace.phone_number;
    }

    let mainIdResolved: string | null = fullPlace?.main_category_id ?? null;
    let subIdResolved: string | null = fullPlace?.sub_category_id ?? null;

    if (needsPlaceCategoryTree(store.category) && store.type_id) {
      setLoadingEditPcTree(true);
      try {
        const { mains, map } = await fetchPlaceCategoryTreeData(store.type_id);
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

    setEditForm({
      name: store.name,
      description: store.description,
      category: store.category,
      lat: String(store.latitude),
      lng: String(store.longitude),
      dynamicAttrs: existingAttrs,
    });

    const catForAttrs = categories.find((c) => c.name === store.category);
    let defsFromApi: AttrDef[] = [];
    if (catForAttrs?.id) {
      try {
        defsFromApi = await ensureAndFetchAttributeDefinitions(catForAttrs.id, store.category);
      } catch {
        defsFromApi = [];
      }
    }
    if (defsFromApi.length > 0) {
      setEditAttrDefs(defsFromApi);
    } else {
      const inferredDefs: AttrDef[] = (store.attributes || []).map((a) => ({
        id: `inferred-${a.key}`,
        key: a.key,
        label: ATTR_LABELS[a.key] || a.key.replaceAll('_', ' '),
        value_type: a.value_type || 'string',
        is_required: false,
      }));
      setEditAttrDefs(inferredDefs.length > 0 ? inferredDefs : getPlaceAttrDefsForType(store.category));
    }
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
    const treeModeEdit = needsPlaceCategoryTree(editForm.category);
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

  const handleCallPhone = async (phone: string) => {
    const normalized = String(phone || '').replace(/[^\d+]/g, '');
    if (!normalized) return;
    const url = `tel:${normalized}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('تنبيه', 'لا يمكن فتح الاتصال على هذا الجهاز');
      return;
    }
    await Linking.openURL(url);
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
    } | null
  ) => {
    if (defs.length === 0) return null;
    const useTree = Boolean(treeCtx && needsPlaceCategoryTree(treeCtx.categoryName));
    const mainLab = defs.find((d) => d.key === 'store_type')?.label ?? 'التصنيف الرئيسي';
    const subLab = defs.find((d) => d.key === 'store_category')?.label ?? 'التصنيف الفرعي';

    return (
      <>
        {defs.map((def) => {
          const uiRole = parseAttrUiOptions(def.options).uiRole ?? 'dynamic';
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

  const getUiFieldDef = (defs: AttrDef[], role: string) =>
    defs.find((d) => (parseAttrUiOptions(d.options).uiRole ?? 'dynamic') === role) ?? null;

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
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
            <Text style={styles.addBtnText}>+ {'\u0625\u0636\u0627\u0641\u0629 \u0645\u0643\u0627\u0646'}</Text>
          </TouchableOpacity>
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
              const phone = store.attributes?.find((a) => a.key === 'phone')?.value;
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
              <Text style={styles.formLabel}>
                {getUiFieldDef(attrDefs, 'place_name')?.label || '\u0627\u0633\u0645 \u0627\u0644\u0645\u0643\u0627\u0646'}
                {getUiFieldDef(attrDefs, 'place_name')?.is_required !== false ? ' *' : ''}
              </Text>
              <TextInput style={styles.formInput} placeholder={'\u0645\u062B\u0627\u0644: \u0645\u0637\u0639\u0645 \u0627\u0644\u0632\u064A\u062A\u0648\u0646'} value={form.name} onChangeText={(t) => setForm((p) => ({ ...p, name: t }))} textAlign="right" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                {getUiFieldDef(attrDefs, 'place_description')?.label || '\u0627\u0644\u0648\u0635\u0641'}
                {getUiFieldDef(attrDefs, 'place_description')?.is_required ? ' *' : ''}
              </Text>
              <TextInput style={[styles.formInput, styles.formTextarea]} placeholder={'\u0648\u0635\u0641 \u0645\u062E\u062A\u0635\u0631 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)'} value={form.description} onChangeText={(t) => setForm((p) => ({ ...p, description: t }))} multiline textAlign="right" />
            </View>
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
              needsPlaceCategoryTree(form.category)
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
                : null
            )}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{getUiFieldDef(attrDefs, 'place_location')?.label || '\u0627\u0644\u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A'}</Text>
              <View style={styles.coordsRow}>
                <TextInput style={[styles.formInput, styles.coordInput]} placeholder={'\u062E\u0637 \u0627\u0644\u0639\u0631\u0636'} value={form.lat} onChangeText={(t) => setForm((p) => ({ ...p, lat: t }))} keyboardType="decimal-pad" textAlign="center" />
                <TextInput style={[styles.formInput, styles.coordInput]} placeholder={'\u062E\u0637 \u0627\u0644\u0637\u0648\u0644'} value={form.lng} onChangeText={(t) => setForm((p) => ({ ...p, lng: t }))} keyboardType="decimal-pad" textAlign="center" />
              </View>
            </View>
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
                <Text style={styles.formLabel}>
                  {getUiFieldDef(editAttrDefs, 'place_name')?.label || '\u0627\u0633\u0645 \u0627\u0644\u0645\u0643\u0627\u0646'}
                  {getUiFieldDef(editAttrDefs, 'place_name')?.is_required !== false ? ' *' : ''}
                </Text>
                <TextInput style={styles.formInput} value={editForm.name} onChangeText={(t) => setEditForm((p) => ({ ...p, name: t }))} textAlign="right" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {getUiFieldDef(editAttrDefs, 'place_description')?.label || '\u0627\u0644\u0648\u0635\u0641'}
                  {getUiFieldDef(editAttrDefs, 'place_description')?.is_required ? ' *' : ''}
                </Text>
                <TextInput style={[styles.formInput, styles.formTextarea]} value={editForm.description} onChangeText={(t) => setEditForm((p) => ({ ...p, description: t }))} multiline textAlign="right" />
              </View>
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
                needsPlaceCategoryTree(editForm.category)
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
                  : null
              )}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>الصور الحالية ({editImages.length})</Text>
                {editImages.length > 0 ? (
                  <View style={styles.photosWrap}>
                    {editImages.map((img, idx) => (
                      <View key={`${img.image_url}-${idx}`} style={styles.photoItemWrap}>
                        <Image source={{ uri: img.image_url }} style={styles.photoThumb} />
                        <TouchableOpacity
                          style={styles.photoDeleteBtn}
                          onPress={() => void handleRemoveEditImage(img)}
                          disabled={saving}
                        >
                          <Text style={styles.photoDeleteBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noPhotosText}>لا توجد صور محفوظة لهذا المكان</Text>
                )}
                <TouchableOpacity style={[styles.addPhotoBtn, saving && styles.submitBtnDisabled]} onPress={() => void handleAddEditImage()} disabled={saving}>
                  <Text style={styles.addPhotoBtnText}>📷 إضافة صورة</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{getUiFieldDef(editAttrDefs, 'place_location')?.label || '\u0627\u0644\u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A'}</Text>
                <View style={styles.coordsRow}>
                  <TextInput style={[styles.formInput, styles.coordInput]} placeholder={'\u062E\u0637 \u0627\u0644\u0639\u0631\u0636'} value={editForm.lat} onChangeText={(t) => setEditForm((p) => ({ ...p, lat: t }))} keyboardType="decimal-pad" textAlign="center" />
                  <TextInput style={[styles.formInput, styles.coordInput]} placeholder={'\u062E\u0637 \u0627\u0644\u0637\u0648\u0644'} value={editForm.lng} onChangeText={(t) => setEditForm((p) => ({ ...p, lng: t }))} keyboardType="decimal-pad" textAlign="center" />
                </View>
              </View>

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
              onPress={() => void unitsManagerRef.current?.saveAllLinks()}
              disabled={saving}
            >
              <Text style={styles.modalSaveText}>حفظ</Text>
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
    </View>
  );
}
