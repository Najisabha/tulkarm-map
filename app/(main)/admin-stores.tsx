import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Linking,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { useStores, Store } from '../../context/StoreContext';
import { useCategories } from '../../context/CategoryContext';
import { LAYOUT } from '../../constants/layout';
import { TULKARM_REGION } from '../../constants/tulkarmRegion';
import { shadow } from '../../utils/shadowStyles';
import { normalizePlaceTypeKind } from '../../utils/placeTypeLabels';

interface AttrDef {
  id: string;
  key: string;
  label: string;
  value_type: string;
  is_required: boolean;
}

interface EditableImage {
  id?: string;
  image_url: string;
}

const ATTR_LABELS: Record<string, string> = {
  house_number: 'رقم المنزل',
  store_number: 'رقم المتجر',
  location_text: 'الموقع',
  store_type: 'التصنيف الرئيسي للمتجر',
  store_category: 'التصنيف الفرعي للمتجر',
  complex_number: 'رقم المجمع',
  floors_count: 'عدد الطوابق',
  houses_per_floor: 'المنازل بكل طابق',
  stores_per_floor: 'المتاجر بكل طابق',
  phone: 'رقم الهاتف',
};

function catEmoji(cats: { name: string; emoji: string }[], name: string) {
  return cats.find((c) => c.name === name)?.emoji || '\u{1F4CD}';
}

function catColor(cats: { name: string; color: string }[], name: string) {
  return cats.find((c) => c.name === name)?.color || '#2E86AB';
}

function isPublishedStore(s: Store) {
  return String(s.status || '').toLowerCase() === 'active';
}

export default function AdminStoresScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editStoreId?: string; kind?: string }>();
  const { user } = useAuth();
  const { categories } = useCategories();
  const { stores, deleteStore, refreshStores } = useStores();
  const managedStores = useMemo(() => stores, [stores]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const kindFilter = useMemo(() => {
    const k = String(params.kind || 'all');
    if (k === 'house' || k === 'store' || k === 'residentialComplex' || k === 'commercialComplex' || k === 'other') return k;
    return 'all';
  }, [params.kind]);
  const screenTitle = useMemo(() => {
    if (kindFilter === 'house') return 'إدارة المنازل';
    if (kindFilter === 'store') return 'إدارة المتاجر';
    if (kindFilter === 'residentialComplex') return 'إدارة المجمعات السكنية';
    if (kindFilter === 'commercialComplex') return 'إدارة المجمعات التجارية';
    if (kindFilter === 'other') return 'إدارة الأماكن الأخرى';
    return 'إدارة الأماكن';
  }, [kindFilter]);
  const listTitle = useMemo(() => {
    if (kindFilter === 'house') return 'قائمة المنازل';
    if (kindFilter === 'store') return 'قائمة المتاجر';
    if (kindFilter === 'residentialComplex') return 'قائمة المجمعات السكنية';
    if (kindFilter === 'commercialComplex') return 'قائمة المجمعات التجارية';
    if (kindFilter === 'other') return 'قائمة الأماكن الأخرى';
    return 'قائمة الأماكن';
  }, [kindFilter]);
  const filterSubjectLabel = useMemo(() => {
    if (kindFilter === 'house') return 'المنازل';
    if (kindFilter === 'store') return 'المتاجر';
    if (kindFilter === 'residentialComplex') return 'المجمعات السكنية';
    if (kindFilter === 'commercialComplex') return 'المجمعات التجارية';
    if (kindFilter === 'other') return 'الأماكن الأخرى';
    return 'الأماكن';
  }, [kindFilter]);
  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = managedStores.filter((s) => {
      if (kindFilter === 'all') return true;
      return normalizePlaceTypeKind(String(s.category || '')) === kindFilter;
    });
    if (statusFilter !== 'all') {
      list = list.filter((s) => {
        const active = String(s.status || '').toLowerCase() === 'active';
        return statusFilter === 'visible' ? active : String(s.status || '').toLowerCase() === 'pending';
      });
    }
    if (!q) return list;
    return list.filter((s) => {
      const name = String(s.name || '').toLowerCase();
      const desc = String(s.description || '').toLowerCase();
      const cat = String(s.category || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || cat.includes(q);
    });
  }, [managedStores, searchQuery, statusFilter, kindFilter]);
  const visibleCount = useMemo(
    () =>
      managedStores.filter(
        (s) =>
          (kindFilter === 'all' || normalizePlaceTypeKind(String(s.category || '')) === kindFilter) &&
          String(s.status || '').toLowerCase() === 'active'
      ).length,
    [managedStores, kindFilter]
  );
  const hiddenCount = useMemo(
    () =>
      managedStores.filter(
        (s) =>
          (kindFilter === 'all' || normalizePlaceTypeKind(String(s.category || '')) === kindFilter) &&
          String(s.status || '').toLowerCase() === 'pending'
      ).length,
    [managedStores, kindFilter]
  );

  const [showAddModal, setShowAddModal] = useState(false);
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
    ownerId: null as string | null,
  });
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [editAttrDefs, setEditAttrDefs] = useState<AttrDef[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string; email: string; role: string }[]>([]);

  useEffect(() => {
    if (categories.length > 0 && !form.category?.trim()) {
      setForm((f) => ({ ...f, category: categories[0].name }));
    }
  }, [categories]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    void api
      .getUsers()
      .then((res) => setOwners(res.data || []))
      .catch(() => setOwners([]));
  }, [user?.isAdmin]);

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

  const loadAttrDefs = async (catName: string) => {
    const cat = categories.find((c) => c.name === catName);
    if (!cat) return [];
    try {
      const res = await api.getAttributeDefinitions(cat.id);
      return res.data || [];
    } catch {
      return [];
    }
  };

  const handleCategoryChange = async (catName: string, isEdit: boolean) => {
    const defs = await loadAttrDefs(catName);
    if (isEdit) {
      setEditAttrDefs(defs);
      setEditForm((p) => ({ ...p, category: catName }));
    } else {
      setAttrDefs(defs);
      setForm((p) => ({ ...p, category: catName, dynamicAttrs: {} }));
    }
  };

  if (!user?.isAdmin) {
    return (
      <View style={styles.unauthorized}>
        <Text style={styles.unauthorizedText}>{'\u26D4'} \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0648\u0635\u0648\u0644</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>{'\u0627\u0644\u0639\u0648\u062F\u0629'}</Text>
        </TouchableOpacity>
      </View>
    );
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
      ownerId: null,
    });
    setAttrDefs([]);
  };

  const handleOpenAdd = async () => {
    resetForm();
    if (defaultCategory) {
      const defs = await loadAttrDefs(defaultCategory);
      setAttrDefs(defs);
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
      const attributes = Object.entries(form.dynamicAttrs)
        .filter(([, v]) => v.trim())
        .map(([key, value]) => {
          const def = attrDefs.find((d) => d.key === key);
          return { key, value: value.trim(), value_type: def?.value_type || 'string' };
        });
      const created = await api.createPlaceFromAdmin({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type_id: cat.id,
        latitude: lat,
        longitude: lng,
        attributes: attributes.length ? attributes : undefined,
      });

      const placeId = created?.data?.id;
      if (placeId && form.ownerId) {
        await api.assignStoreOwner(placeId, form.ownerId);
      }
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
    setEditForm({
      name: store.name,
      description: store.description,
      category: store.category,
      lat: String(store.latitude),
      lng: String(store.longitude),
      dynamicAttrs: existingAttrs,
    });
    const defs = await loadAttrDefs(store.category);
    if (defs.length > 0) {
      setEditAttrDefs(defs);
    } else {
      // Fallback: show persisted attributes even when type definitions are missing.
      const inferredDefs: AttrDef[] = (store.attributes || []).map((a) => ({
        id: `inferred-${a.key}`,
        key: a.key,
        label: ATTR_LABELS[a.key] || a.key.replaceAll('_', ' '),
        value_type: a.value_type || 'string',
        is_required: false,
      }));
      setEditAttrDefs(inferredDefs);
    }
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
    try {
      const cat = categories.find((c) => c.name === editForm.category);
      const attributes = Object.entries(editForm.dynamicAttrs)
        .filter(([, v]) => v.trim())
        .map(([key, value]) => {
          const def = editAttrDefs.find((d) => d.key === key);
          return { key, value: value.trim(), value_type: def?.value_type || 'string' };
        });
      await api.updatePlace(editingStore.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        type_id: cat?.id,
        latitude: lat,
        longitude: lng,
        attributes: attributes.length ? attributes : undefined,
      });
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

  const renderAttrFields = (defs: AttrDef[], values: Record<string, string>, onChange: (key: string, value: string) => void) => {
    if (defs.length === 0) return null;
    return (
      <>
        {defs.map((def) => (
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
                placeholder={def.label}
                value={values[def.key] || ''}
                onChangeText={(t) => onChange(def.key, t)}
                keyboardType={def.value_type === 'number' ? 'numeric' : 'default'}
                textAlign="right"
              />
            )}
          </View>
        ))}
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
        <Text style={styles.headerTitle}>{screenTitle}</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{managedStores.length} {'\u0645\u0643\u0627\u0646'}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionCountBadge}>
              <Text style={styles.sectionCountBadgeText}>{filteredStores.length}</Text>
            </View>
            <Text style={styles.sectionTitle}>{listTitle}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
            <Text style={styles.addBtnText}>+ {'\u0625\u0636\u0627\u0641\u0629 \u0645\u0643\u0627\u0646'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.housesStatsRow}>
          <TouchableOpacity
            style={[styles.housesStatChip, styles.housesVisibleChip, statusFilter === 'visible' && styles.housesStatChipActive]}
            onPress={() => setStatusFilter((prev) => (prev === 'visible' ? 'all' : 'visible'))}
            activeOpacity={0.85}
          >
            <Text style={styles.housesVisibleText}>{filterSubjectLabel} الظاهرة: {visibleCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.housesStatChip, styles.housesHiddenChip, statusFilter === 'hidden' && styles.housesStatChipActive]}
            onPress={() => setStatusFilter((prev) => (prev === 'hidden' ? 'all' : 'hidden'))}
            activeOpacity={0.85}
          >
            <Text style={styles.housesHiddenText}>{filterSubjectLabel} المخفية: {hiddenCount}</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="بحث بالاسم أو الفئة..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          textAlign="right"
          placeholderTextColor="#9CA3AF"
        />

        {filteredStores.length === 0 ? (
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
            {filteredStores.map((store) => {
              const phone = store.attributes?.find((a) => a.key === 'phone')?.value;
              const typeColor = catColor(categories, store.category);
              return (
                <View key={store.id} style={styles.storeCard}>
                  <TouchableOpacity style={styles.storeCardBody} onPress={() => openEdit(store)} activeOpacity={0.75}>
                    <View style={styles.storeCardTop}>
                      <View style={[styles.storeTypeIcon, { backgroundColor: typeColor + '22' }]}>
                        <Text style={styles.storeTypeIconEmoji}>{catEmoji(categories, store.category)}</Text>
                      </View>
                      <View style={styles.storeCardMain}>
                        <Text style={styles.storeCardName} numberOfLines={2}>{store.name}</Text>
                        {store.description ? (
                          <Text style={styles.storeCardDesc} numberOfLines={2}>{store.description}</Text>
                        ) : null}
                        <View style={styles.storeChipsRow}>
                          <View style={[styles.storeChip, { borderColor: typeColor + '55' }]}>
                            <Text style={[styles.storeChipText, { color: typeColor }]}>{store.category}</Text>
                          </View>
                          {phone ? (
                            <TouchableOpacity
                              style={styles.storeChipPhone}
                              onPress={() => void handleCallPhone(phone)}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.storeChipPhoneText}>{'\u{1F4DE}'} {phone}</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.storeActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.storeActionBtn,
                      String(store.status || '').toLowerCase() === 'active' ? styles.storeActionHide : styles.storeActionShow,
                    ]}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      void toggleVisibility(store);
                    }}
                    activeOpacity={0.85}
                    disabled={saving}
                  >
                    <Text style={String(store.status || '').toLowerCase() === 'active' ? styles.storeActionHideText : styles.storeActionShowText}>
                      {String(store.status || '').toLowerCase() === 'active' ? '🙈 إخفاء' : '👁️ إظهار'}
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
              <Text style={styles.formLabel}>{'\u0627\u0633\u0645 \u0627\u0644\u0645\u0643\u0627\u0646 *'}</Text>
              <TextInput style={styles.formInput} placeholder={'\u0645\u062B\u0627\u0644: \u0645\u0637\u0639\u0645 \u0627\u0644\u0632\u064A\u062A\u0648\u0646'} value={form.name} onChangeText={(t) => setForm((p) => ({ ...p, name: t }))} textAlign="right" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{'\u0627\u0644\u0648\u0635\u0641'}</Text>
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
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                {'\u0635\u0627\u062d\u0628 \u0627\u0644\u0645\u062a\u062c\u0631'} <Text style={{ color: '#9CA3AF' }}>{'(اختياري)'}</Text>
              </Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  style={[styles.categoryChip, !form.ownerId && styles.categoryChipActive]}
                  onPress={() => setForm((p) => ({ ...p, ownerId: null }))}
                >
                  <Text style={[styles.categoryChipText, !form.ownerId && styles.categoryChipTextActive]}>بدون</Text>
                </TouchableOpacity>
                {owners.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.categoryChip, form.ownerId === o.id && styles.categoryChipActive]}
                    onPress={() => setForm((p) => ({ ...p, ownerId: o.id }))}
                  >
                    <Text style={[styles.categoryChipText, form.ownerId === o.id && styles.categoryChipTextActive]}>
                      {o.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {renderAttrFields(attrDefs, form.dynamicAttrs, (key, value) => setForm((p) => ({ ...p, dynamicAttrs: { ...p.dynamicAttrs, [key]: value } })))}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{'\u0627\u0644\u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A'}</Text>
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
                <Text style={styles.formLabel}>{'\u0627\u0633\u0645 \u0627\u0644\u0645\u0643\u0627\u0646 *'}</Text>
                <TextInput style={styles.formInput} value={editForm.name} onChangeText={(t) => setEditForm((p) => ({ ...p, name: t }))} textAlign="right" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{'\u0627\u0644\u0648\u0635\u0641'}</Text>
                <TextInput style={[styles.formInput, styles.formTextarea]} value={editForm.description} onChangeText={(t) => setEditForm((p) => ({ ...p, description: t }))} multiline textAlign="right" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{'\u0627\u0644\u0641\u0626\u0629'}</Text>
                <View style={styles.chipsWrap}>
                  {[...categories].sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((cat) => (
                    <TouchableOpacity key={cat.id} style={[styles.categoryChip, editForm.category === cat.name && styles.categoryChipActive]} onPress={() => handleCategoryChange(cat.name, true)}>
                      <Text style={[styles.categoryChipText, editForm.category === cat.name && styles.categoryChipTextActive]}>{cat.emoji} {cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {renderAttrFields(editAttrDefs, editForm.dynamicAttrs, (key, value) => setEditForm((p) => ({ ...p, dynamicAttrs: { ...p.dynamicAttrs, [key]: value } })))}
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
                <Text style={styles.formLabel}>{'\u0627\u0644\u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A'}</Text>
                <View style={styles.coordsRow}>
                  <TextInput style={[styles.formInput, styles.coordInput]} placeholder={'\u062E\u0637 \u0627\u0644\u0639\u0631\u0636'} value={editForm.lat} onChangeText={(t) => setEditForm((p) => ({ ...p, lat: t }))} keyboardType="decimal-pad" textAlign="center" />
                  <TextInput style={[styles.formInput, styles.coordInput]} placeholder={'\u062E\u0637 \u0627\u0644\u0637\u0648\u0644'} value={editForm.lng} onChangeText={(t) => setEditForm((p) => ({ ...p, lng: t }))} keyboardType="decimal-pad" textAlign="center" />
                </View>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => editingStore && handleDelete(editingStore)}>
                <Text style={styles.deleteBtnText}>{'\u{1F5D1}\uFE0F'} {'\u062D\u0630\u0641 \u0627\u0644\u0645\u0643\u0627\u0646'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unauthorizedText: { fontSize: 20, color: '#EF4444', marginBottom: 16 },
  backLink: { color: '#2E86AB', fontSize: 16 },
  header: { backgroundColor: '#1A3A5C', paddingTop: LAYOUT.headerTop, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginRight: 12 },
  headerBadge: { backgroundColor: '#F59E0B', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A3A5C', textAlign: 'right' },
  sectionCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sectionCountBadgeText: { color: '#0369A1', fontSize: 12, fontWeight: '800' },
  addBtn: { backgroundColor: '#2E86AB', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  housesStatsRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 10 },
  housesStatChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  housesStatChipActive: { borderWidth: 2, borderColor: '#1A3A5C' },
  housesVisibleChip: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  housesHiddenChip: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  housesVisibleText: { color: '#065F46', fontSize: 13, fontWeight: '800' },
  housesHiddenText: { color: '#991B1B', fontSize: 13, fontWeight: '800' },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 12,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateEmoji: { fontSize: 60, marginBottom: 16 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16, marginBottom: 16 },
  emptyStateBtn: { backgroundColor: '#2E86AB', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyStateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    overflow: 'hidden',
    ...shadow({ offset: { width: 0, height: 3 }, opacity: 0.07, radius: 10, elevation: 3 }),
  },
  storeCardBody: { padding: 16 },
  storeCardTop: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 14 },
  storeTypeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeTypeIconEmoji: { fontSize: 26 },
  storeCardMain: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  storeCardName: { fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'right', lineHeight: 24 },
  storeCardDesc: { fontSize: 14, color: '#6B7280', textAlign: 'right', marginTop: 6, lineHeight: 20 },
  storeChipsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  storeChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  storeChipText: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
  storeChipMuted: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  storeChipMutedText: { fontSize: 12, color: '#4B5563', fontWeight: '600', textAlign: 'right' },
  storeChipPhone: {
    backgroundColor: '#EBF5FB',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  storeChipPhoneText: { fontSize: 12, color: '#1D4ED8', fontWeight: '800', textAlign: 'right' },
  storeActionRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    position: 'relative',
    zIndex: 10,
  },
  storeActionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 11,
    pointerEvents: 'auto',
  },
  storeActionEdit: { backgroundColor: '#EBF5FB', borderWidth: 1.5, borderColor: '#2E86AB' },
  storeActionEditText: { fontSize: 14, fontWeight: '800', color: '#2E86AB' },
  storeActionDelete: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FECACA' },
  storeActionDeleteText: { fontSize: 14, fontWeight: '800', color: '#B91C1C' },
  storeActionHide: { backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#FDBA74' },
  storeActionHideText: { fontSize: 14, fontWeight: '800', color: '#C2410C' },
  storeActionShow: { backgroundColor: '#ECFDF5', borderWidth: 1.5, borderColor: '#86EFAC' },
  storeActionShowText: { fontSize: 14, fontWeight: '800', color: '#166534' },
  modalContainer: { flex: 1, backgroundColor: '#F0F4F8' },
  modalHeader: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: LAYOUT.modalHeaderTop, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalCancelText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  modalTitle: { color: '#1A3A5C', fontSize: 17, fontWeight: '700' },
  modalSaveText: { color: '#2E86AB', fontSize: 16, fontWeight: '700' },
  modalBody: { flex: 1, padding: 16 },
  formGroup: { marginBottom: 20 },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#374151', textAlign: 'right', marginBottom: 8 },
  formInput: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#1F2937', borderWidth: 1.5, borderColor: '#E5E7EB' },
  formTextarea: { height: 90, paddingTop: 12 },
  chipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  photosWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  photoItemWrap: { position: 'relative' },
  photoThumb: { width: 74, height: 74, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  photoDeleteBtn: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDeleteBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  addPhotoBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#EBF5FB',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addPhotoBtnText: { color: '#1D4ED8', fontWeight: '700', fontSize: 13 },
  noPhotosText: { color: '#9CA3AF', fontSize: 13, textAlign: 'right' },
  categoryChip: { backgroundColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  categoryChipActive: { backgroundColor: '#2E86AB' },
  categoryChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '700' },
  coordsRow: { flexDirection: 'row', gap: 10 },
  coordInput: { flex: 1 },
  deleteBtn: { backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  deleteBtnText: { fontSize: 15, color: '#DC2626', fontWeight: '700' },
  boolToggle: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  boolToggleActive: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  boolToggleText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
