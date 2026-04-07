import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, type PlaceData } from '../../api/client';
import { PlaceCard } from '../../components/places/PlaceCard';
import { CategoryItem, CategorySelector } from '../../components/places/CategorySelector';
import { ComplexBuildingViewer, ComplexUnit } from '../../components/places/ComplexBuildingViewer';
import { LAYOUT } from '../../constants/layout';
import { TULKARM_REGION } from '../../constants/tulkarmRegion';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoryContext';
import { Store, useStores } from '../../context/StoreContext';
import { placeService } from '../../services/placeService';
import { categoryService } from '../../services/categoryService';
import { usePlacesStore } from '../../stores/usePlacesStore';
import {
  normalizePlaceTypeKind,
  usesPlacePhoneAsStoreNumberField,
  usesProductCategoryFieldsForPlaceType,
} from '../../utils/placeTypeLabels';
import { getPlaceAttrDefsForType } from '../../utils/placeFormAttrDefs';
import { shadow } from '../../utils/shadowStyles';

function storeToDomainPlace(store: Store): any {
  const phone = store.attributes?.find((a) => a.key === 'phone')?.value ?? store.phone ?? null;
  return {
    id: store.id,
    name: store.name,
    description: store.description || null,
    phoneNumber: phone,
    images: store.images?.map((img) => ({ id: img.id, url: img.image_url, sortOrder: img.sort_order })) ?? [],
    location: { latitude: store.latitude, longitude: store.longitude },
    typeId: store.type_id ?? '',
    typeName: store.type_name ?? store.category,
    kind: 'simple',
    status: (store.status as any) ?? 'pending',
    avgRating: parseFloat(store.avg_rating ?? '0'),
    ratingCount: Number(store.rating_count ?? 0),
    createdAt: store.createdAt,
    attributes: store.attributes?.map((a) => ({ key: a.key, value: a.value, valueType: a.value_type })) ?? [],
  };
}

function ComplexResidentialHousesModal({
  visible,
  complexStore,
  allStores,
  onClose,
  onOpenHouse,
}: {
  visible: boolean;
  complexStore: Store | null;
  allStores: Store[];
  onClose: () => void;
  onOpenHouse: (houseStore: Store) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [floorsCount, setFloorsCount] = useState<number>(1);
  const [unitsPerFloor, setUnitsPerFloor] = useState<number>(1);

  useEffect(() => {
    if (!visible || !complexStore) return;
    if (String(complexStore.category || '') !== 'مجمّع سكني') return;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const res = await placeService.getComplex(complexStore.id);
        const f = Number(res?.complex?.floors_count ?? 1);
        const u = Number(res?.complex?.units_per_floor ?? 1);
        setFloorsCount(Number.isFinite(f) && f >= 1 ? f : 1);
        setUnitsPerFloor(Number.isFinite(u) && u >= 1 ? u : 1);
      } catch (e: any) {
        setErr(e?.message || 'فشل تحميل منازل المجمع');
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, complexStore?.id]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.housesOverlay}>
        <TouchableOpacity style={styles.housesBackdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.housesSheet}>
          <View style={styles.housesSheetHeader}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.housesCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.housesSheetTitle} numberOfLines={1}>
              منازل {complexStore?.name || 'المجمّع'}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {loading ? (
            <View style={{ padding: 18 }}>
              <ActivityIndicator />
            </View>
          ) : err ? (
            <Text style={styles.housesErrorText}>{err}</Text>
          ) : (
            <View style={{ paddingHorizontal: 14, paddingBottom: 18 }}>
              <ComplexBuildingViewer
                placeId={complexStore?.id || ''}
                complexType="residential"
                floorsCount={floorsCount}
                unitsPerFloor={unitsPerFloor}
                onUnitPress={(unit: ComplexUnit) => {
                  if (unit.child_place_id && unit.child_place_name) {
                    const hit = allStores.find((s) => s.id === unit.child_place_id);
                    if (hit) onOpenHouse(hit);
                    else Alert.alert('تنبيه', 'تعذّر فتح بيانات المنزل. حدّث القائمة ثم حاول مجدداً.');
                    return;
                  }
                  Alert.alert('تنبيه', 'هذه الوحدة غير مرتبطة بمنزل بعد.');
                }}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ComplexUnitsManager({ placeId, complexLabel }: { placeId: string; complexLabel: string }) {
  const { places, loadAll } = usePlacesStore();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [floorsCount, setFloorsCount] = useState('1');
  const [unitsPerFloor, setUnitsPerFloor] = useState('1');
  const [complexCoords, setComplexCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [placeTypes, setPlaceTypes] = useState<{ id: string; name: string }[]>([]);

  const isResidential = complexLabel === 'مجمّع سكني';

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await placeService.getComplex(placeId);
      setUnits(res.units || []);
      if (res.complex?.floors_count) setFloorsCount(String(res.complex.floors_count));
      if (res.complex?.units_per_floor) setUnitsPerFloor(String(res.complex.units_per_floor));
    } catch (e: any) {
      setErr(e?.message || 'فشل تحميل الوحدات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll(true);
    void refresh();
  }, [placeId]);

  useEffect(() => {
    // Load the complex place itself (coords) + place types (for type_id selection)
    void (async () => {
      try {
        const p = await placeService.getById(placeId);
        setComplexCoords({ latitude: p.location.latitude, longitude: p.location.longitude });
      } catch {
        // ignore — user can still link existing places
      }
      try {
        const res = await api.getPlaceTypes();
        const list = Array.isArray(res?.data) ? res.data : [];
        setPlaceTypes(list.map((t) => ({ id: t.id, name: t.name })));
      } catch {
        setPlaceTypes([]);
      }
    })();
  }, [placeId]);

  const findTypeIdByName = (name: string): string | null => {
    const hit = placeTypes.find((t) => t.name === name);
    return hit?.id ?? null;
  };

  const createAndLinkChildPlace = async (unit: any, childKind: 'house' | 'simple' | 'store') => {
    const floor = Number(unit.floor_number);
    const uNo = String(unit.unit_number);
    const label = `${floor}-${uNo}`;

    if (!complexCoords) {
      Alert.alert('تنبيه', 'تعذّر قراءة إحداثيات المجمع. افتح/أغلق الشاشة ثم حاول مجدداً.');
      return;
    }

    const isCommercial = !isResidential;
    const typeName =
      childKind === 'house'
        ? 'منزل'
        : childKind === 'store'
          ? 'متجر تجاري'
          : 'أخرى';

    const typeId = findTypeIdByName(typeName);
    if (!typeId) {
      Alert.alert('خطأ', `لم يتم العثور على type_id لنوع: ${typeName}. تحقق من /api/place-types`);
      return;
    }

    const baseAttrs: { key: string; value: string; value_type?: string }[] = [];
    if (childKind === 'house') {
      baseAttrs.push({ key: 'house_number', value: label, value_type: 'text' });
    } else {
      baseAttrs.push({ key: 'unit_number', value: label, value_type: 'text' });
    }
    if (isCommercial) {
      // As requested: unit_type exists for commercial units (empty initially)
      baseAttrs.push({ key: 'unit_type', value: '', value_type: 'text' });
    }

    const defaultName =
      childKind === 'house'
        ? `بيت ${label}`
        : `وحدة ${label}`;

    setLoading(true);
    try {
      const created = await api.createPlaceFromAdmin({
        name: defaultName,
        description: '',
        type_id: typeId,
        latitude: complexCoords.latitude,
        longitude: complexCoords.longitude,
        attributes: baseAttrs,
        image_urls: [],
      });
      const childPlaceId = created.data.id;
      await placeService.linkUnitPlace(unit.id, childPlaceId);
      await loadAll(true);
      await refresh();
      Alert.alert('✅ تم', `تم إنشاء مكان وربطه بالوحدة ${label}`);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل إنشاء/ربط المكان');
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    const f = parseInt(floorsCount);
    const u = parseInt(unitsPerFloor);
    if (!Number.isFinite(f) || f < 1) return Alert.alert('تنبيه', 'عدد الطوابق غير صالح');
    if (!Number.isFinite(u) || u < 1) return Alert.alert('تنبيه', 'عدد الوحدات غير صالح');
    setLoading(true);
    try {
      await placeService.generateUnits(placeId, f, u);
      await refresh();
      Alert.alert('✅ تم', 'تم توليد الوحدات');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل توليد الوحدات');
    } finally {
      setLoading(false);
    }
  };

  const linkPlace = async (unitId: string, childPlaceId: string | null) => {
    setLoading(true);
    try {
      await placeService.linkUnitPlace(unitId, childPlaceId);
      await refresh();
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الربط');
    } finally {
      setLoading(false);
    }
  };

  const updateUnitType = async (childPlaceId: string, unitType: string) => {
    try {
      const place = places.find((p) => p.id === childPlaceId);
      const attrs = (place?.attributes || []).map((a) => ({ key: a.key, value: a.value, value_type: a.valueType }));
      const filtered = attrs.filter((a) => a.key !== 'unit_type');
      if (unitType.trim()) filtered.push({ key: 'unit_type', value: unitType.trim(), value_type: 'text' });
      await placeService.update(childPlaceId, { attributes: filtered });
      await loadAll(true);
      Alert.alert('✅ تم', 'تم حفظ نوع الوحدة');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل حفظ نوع الوحدة');
    }
  };

  const placeOptions = useMemo(() => {
    // Places that can be linked to units: simple/categorized/house (exclude complexes)
    return places.filter((p) => p.kind !== 'complex');
  }, [places]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', textAlign: 'right' }}>
        توليد وحدات (idempotent)
      </Text>
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'right' }}>عدد الطوابق</Text>
          <TextInput value={floorsCount} onChangeText={setFloorsCount} style={styles.formInput} keyboardType="numeric" textAlign="center" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'right' }}>وحدات/طابق</Text>
          <TextInput value={unitsPerFloor} onChangeText={setUnitsPerFloor} style={styles.formInput} keyboardType="numeric" textAlign="center" />
        </View>
      </View>
      <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={() => void generate()} disabled={loading} activeOpacity={0.85}>
        <Text style={styles.submitBtnText}>⚙️ توليد/تحديث الوحدات</Text>
      </TouchableOpacity>

      {err ? (
        <Text style={{ marginTop: 10, color: '#EF4444', textAlign: 'right' }}>{err}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        <View style={{ marginTop: 16, gap: 10 }}>
          {units.map((u) => {
            const label = `${u.floor_number}-${u.unit_number}`;
            const linked = u.child_place_id ? placeOptions.find((p) => p.id === u.child_place_id) : null;
            const unitType = linked?.attributes?.find((a) => a.key === 'unit_type')?.value ?? '';
            return (
              <View key={u.id} style={styles.unitCard}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#111827' }}>
                    {isResidential ? 'بيت' : 'وحدة'} {label}
                  </Text>
                  <Text style={{ fontSize: 12, color: linked ? '#16A34A' : '#9CA3AF', fontWeight: '800' }}>
                    {linked ? 'مرتبط' : 'غير مرتبط'}
                  </Text>
                </View>

                <Text style={{ marginTop: 6, fontSize: 12, color: '#374151', textAlign: 'right' }}>
                  المكان التابع: {linked ? linked.name : '—'}
                </Text>

                {!linked && (
                  <View style={{ marginTop: 10, flexDirection: 'row-reverse', gap: 10, flexWrap: 'wrap' }}>
                    {isResidential ? (
                      <TouchableOpacity
                        style={[styles.storeActionBtn, styles.storeActionEdit]}
                        onPress={() => void createAndLinkChildPlace(u, 'house')}
                        activeOpacity={0.85}
                        disabled={loading}
                      >
                        <Text style={styles.storeActionEditText}>➕ إنشاء بيت وربطه</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.storeActionBtn, styles.storeActionEdit]}
                          onPress={() => void createAndLinkChildPlace(u, 'simple')}
                          activeOpacity={0.85}
                          disabled={loading}
                        >
                          <Text style={styles.storeActionEditText}>➕ إنشاء مكان بسيط وربطه</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.storeActionBtn, styles.storeActionShow]}
                          onPress={() => void createAndLinkChildPlace(u, 'store')}
                          activeOpacity={0.85}
                          disabled={loading}
                        >
                          <Text style={styles.storeActionShowText}>➕ إنشاء متجر وربطه</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'right' }}>
                    اربط بمعرّف مكان
                  </Text>
                  <TextInput
                    defaultValue={u.child_place_id ?? ''}
                    placeholder="ضع placeId هنا (أو اتركه فارغ لفك الربط)"
                    placeholderTextColor="#9CA3AF"
                    style={styles.formInput}
                    textAlign="left"
                    onSubmitEditing={(e) => {
                      const v = String(e.nativeEvent.text || '').trim();
                      void linkPlace(u.id, v ? v : null);
                    }}
                  />
                  <Text style={{ fontSize: 11, color: '#6B7280', textAlign: 'right', marginTop: 4 }}>
                    Enter لحفظ الربط
                  </Text>
                </View>

                {!isResidential && linked && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'right' }}>نوع الوحدة (unit_type)</Text>
                    <TextInput
                      defaultValue={unitType}
                      placeholder="مثال: متجر / مطعم / صيدلية ..."
                      placeholderTextColor="#9CA3AF"
                      style={styles.formInput}
                      textAlign="right"
                      onSubmitEditing={(e) => void updateUnitType(linked.id, String(e.nativeEvent.text || ''))}
                    />
                    <Text style={{ fontSize: 11, color: '#6B7280', textAlign: 'right', marginTop: 4 }}>Enter لحفظ النوع</Text>
                  </View>
                )}

                {u.child_place_id && (
                  <TouchableOpacity
                    style={[styles.storeActionBtn, styles.storeActionDelete, { marginTop: 10 }]}
                    onPress={() => void linkPlace(u.id, null)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.storeActionDeleteText}>🔗 فك الربط</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

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

/** متجر + مطعم + مكتب + … — نفس شجرة «شجرة التصنيفات» حسب place_type_id */
function needsPlaceCategoryTree(typeName: string): boolean {
  return normalizePlaceTypeKind(typeName) === 'store' || usesProductCategoryFieldsForPlaceType(typeName);
}

function findSubCategoryNameInMap(
  mainToSubs: Record<string, CategoryItem[]>,
  subId: string
): string | undefined {
  for (const subs of Object.values(mainToSubs)) {
    const hit = subs.find((s) => s.id === subId);
    if (hit) return hit.name;
  }
  return undefined;
}

async function fetchPlaceCategoryTreeData(placeTypeId: string): Promise<{
  mains: CategoryItem[];
  map: Record<string, CategoryItem[]>;
}> {
  const tree = await categoryService.getPlaceCategoryTree(placeTypeId);
  const mains: CategoryItem[] = tree.map((t) => ({
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
  return { mains, map };
}

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
  const [residentialChildIds, setResidentialChildIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void api.getResidentialComplexChildPlaceIds()
      .then((res) => setResidentialChildIds(new Set(res?.data?.child_place_ids ?? [])))
      .catch(() => setResidentialChildIds(new Set()));
  }, [stores]);

  const managedStores = useMemo(
    () => stores.filter((s) => !residentialChildIds.has(s.id)),
    [stores, residentialChildIds],
  );
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
  const [showUnitsModal, setShowUnitsModal] = useState(false);
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
    ownerId: null as string | null,
  });
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [editAttrDefs, setEditAttrDefs] = useState<AttrDef[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string; email: string; role: string }[]>([]);

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

  const canManageUnits = useMemo(() => {
    const cat = String(editingStore?.category || '');
    return cat === 'مجمّع سكني' || cat === 'مجمّع تجاري';
  }, [editingStore?.id, editingStore?.category]);

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
    if (isEdit && editingIsComplex) return;
    const fixedDefs = getPlaceAttrDefsForType(catName);
    const hasFixedDefs = fixedDefs.length > 0 && fixedDefs[0].key !== 'location_text';
    if (hasFixedDefs) {
      if (isEdit) setEditAttrDefs(fixedDefs);
      else setAttrDefs(fixedDefs);
    } else {
      const defs = await loadAttrDefs(catName);
      if (isEdit) setEditAttrDefs(defs);
      else setAttrDefs(defs);
    }
    const cat = categories.find((c) => c.name === catName);
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
      const fixedDefs = getPlaceAttrDefsForType(defaultCategory);
      const hasFixedDefs = fixedDefs.length > 0 && fixedDefs[0].key !== 'location_text';
      if (hasFixedDefs) {
        setAttrDefs(fixedDefs);
      } else {
        const defs = await loadAttrDefs(defaultCategory);
        setAttrDefs(defs);
      }
      if (needsPlaceCategoryTree(defaultCategory)) {
        const cat = categories.find((c) => c.name === defaultCategory);
        if (cat?.id) {
          setLoadingAddPcTree(true);
          try {
            const { mains, map } = await fetchPlaceCategoryTreeData(cat.id);
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
      const attributes = Object.entries(form.dynamicAttrs)
        .filter(([key, v]) => {
          if (!v.trim()) return false;
          if (unifiedPhone && key === 'store_number') return false;
          return true;
        })
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
        phone_number: unifiedPhone ? form.dynamicAttrs['store_number']?.trim() || undefined : undefined,
        main_category_id: treeMode ? addPcCategoryIds.mainId ?? undefined : undefined,
        sub_category_id: treeMode ? addPcCategoryIds.subId ?? undefined : undefined,
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

    const fixedDefs = getPlaceAttrDefsForType(store.category);
    const hasFixedDefs = fixedDefs.length > 0 && fixedDefs[0].key !== 'location_text';
    if (hasFixedDefs) {
      setEditAttrDefs(fixedDefs);
    } else {
      const defs = await loadAttrDefs(store.category);
      if (defs.length > 0) {
        setEditAttrDefs(defs);
      } else {
        const inferredDefs: AttrDef[] = (store.attributes || []).map((a) => ({
          id: `inferred-${a.key}`,
          key: a.key,
          label: ATTR_LABELS[a.key] || a.key.replaceAll('_', ' '),
          value_type: a.value_type || 'string',
          is_required: false,
        }));
        setEditAttrDefs(inferredDefs);
      }
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
    try {
      const cat = categories.find((c) => c.name === editForm.category);
      const unifiedPhone = usesPlacePhoneAsStoreNumberField(editForm.category);

      const attributes = Object.entries(editForm.dynamicAttrs)
        .filter(([key, v]) => {
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

      const treeMode = needsPlaceCategoryTree(editForm.category);
      if (treeMode) {
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
                <Text style={styles.formLabel}>{'\u0627\u0644\u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A'}</Text>
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
            <View style={{ width: 52 }} />
          </View>
          <ComplexUnitsManager placeId={editingStore?.id || ''} complexLabel={editingStore?.category || ''} />
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
  unitsBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    alignItems: 'center',
  },
  unitsBtnText: { color: '#1D4ED8', fontSize: 14, fontWeight: '800' },
  unitCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
  },
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
  categoryChipDisabled: { opacity: 0.55 },
  categoryChipTextDisabled: { color: '#6B7280' },
  categoryLockedHint: { marginTop: 6, color: '#6B7280', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  coordsRow: { flexDirection: 'row', gap: 10 },
  coordInput: { flex: 1 },
  deleteBtn: { backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  deleteBtnText: { fontSize: 15, color: '#DC2626', fontWeight: '700' },
  boolToggle: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  boolToggleActive: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  boolToggleText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  housesOverlay: { flex: 1, justifyContent: 'flex-end' },
  housesBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  housesSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '82%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  housesSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  housesSheetTitle: { flex: 1, fontSize: 15, fontWeight: '900', color: '#111827', textAlign: 'center' },
  housesCloseText: { fontSize: 18, fontWeight: '900', color: '#111827' },
  housesErrorText: { padding: 14, color: '#B91C1C', fontWeight: '800', textAlign: 'right' },
  housesEmptyText: { padding: 14, color: '#6B7280', fontWeight: '800', textAlign: 'right' },
  housesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  housesRowIcon: { fontSize: 18 },
  housesRowName: { flex: 1, fontSize: 14, fontWeight: '900', color: '#111827', textAlign: 'right' },
  housesRowArrow: { width: 20, textAlign: 'left', color: '#64748B', fontWeight: '900' },
});
