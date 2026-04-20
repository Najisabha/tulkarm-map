import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../../../api/client';
import { usePlacesStore } from '../../../stores/usePlacesStore';
import { placeService } from '../../../services/placeService';
import { adminStoresStyles as styles } from '../AdminStores.styles';
import { getPlaceTypePluralLabel, isDisallowedComplexUnitChildTypeName, normalizePlaceTypeKind } from '../../../utils/placeTypeLabels';

export interface ComplexUnitsManagerProps {
  placeId: string;
  complexLabel: string;
}

export interface ComplexUnitsManagerHandle {
  saveAllLinks: () => Promise<void>;
}

export const ComplexUnitsManager = forwardRef<ComplexUnitsManagerHandle, ComplexUnitsManagerProps>(function ComplexUnitsManager(
  { placeId, complexLabel }: ComplexUnitsManagerProps,
  ref,
) {
  const { places, loadAll } = usePlacesStore();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [floorsCount, setFloorsCount] = useState('1');
  const [unitsPerFloor, setUnitsPerFloor] = useState('1');
  const [complexCoords, setComplexCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [placeTypes, setPlaceTypes] = useState<{ id: string; name: string }[]>([]);
  const [unitForTypePick, setUnitForTypePick] = useState<any | null>(null);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});

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
    void (async () => {
      try {
        const p = await placeService.getById(placeId);
        setComplexCoords({ latitude: p.location.latitude, longitude: p.location.longitude });
      } catch {
        // ignore
      }
      try {
        const res = await api.getPlaceTypes();
        const list = Array.isArray(res?.data) ? res.data : [];
        setPlaceTypes(list.map((t: any) => ({ id: t.id, name: t.name })));
      } catch {
        setPlaceTypes([]);
      }
    })();
  }, [placeId]);

  const linkablePlaceTypes = useMemo(
    () => placeTypes.filter((t) => !isDisallowedComplexUnitChildTypeName(t.name)),
    [placeTypes],
  );

  const createAndLinkChildPlace = async (unit: any, selectedType: { id: string; name: string }) => {
    const floor = Number(unit.floor_number);
    const uNo = String(unit.unit_number);
    const label = `${floor}-${uNo}`;

    if (!complexCoords) {
      Alert.alert('تنبيه', 'تعذّر قراءة إحداثيات المجمع. افتح/أغلق الشاشة ثم حاول مجدداً.');
      return;
    }

    setUnitForTypePick(null);

    const kind = normalizePlaceTypeKind(selectedType.name);
    const typeId = selectedType.id;

    const baseAttrs: { key: string; value: string; value_type?: string }[] = [];
    if (kind === 'house') baseAttrs.push({ key: 'house_number', value: label, value_type: 'text' });
    else baseAttrs.push({ key: 'unit_number', value: label, value_type: 'text' });

    const defaultName = kind === 'house' ? `بيت ${label}` : `وحدة ${label}`;

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

  const getLinkDraft = (unitId: string, currentChildPlaceId: string | null) =>
    linkDrafts[unitId] ?? (currentChildPlaceId ?? '');

  const saveUnitLinkDraft = async (unitId: string, currentChildPlaceId: string | null) => {
    const raw = getLinkDraft(unitId, currentChildPlaceId);
    const next = String(raw || '').trim();
    await linkPlace(unitId, next ? next : null);
  };

  useImperativeHandle(ref, () => ({
    saveAllLinks: async () => {
      const pending = units
        .map((u) => {
          const next = String(getLinkDraft(u.id, u.child_place_id ?? null) || '').trim();
          const current = String(u.child_place_id ?? '').trim();
          return { unitId: u.id, next: next || null, current: current || null };
        })
        .filter((x) => x.next !== x.current);

      if (pending.length === 0) {
        Alert.alert('تنبيه', 'لا توجد تغييرات للحفظ');
        return;
      }

      setLoading(true);
      try {
        for (const item of pending) {
          await placeService.linkUnitPlace(item.unitId, item.next);
        }
        await loadAll(true);
        await refresh();
        Alert.alert('✅ تم', `تم حفظ ${pending.length} تغيير`);
      } catch (e: any) {
        Alert.alert('خطأ', e?.message || 'فشل حفظ التغييرات');
      } finally {
        setLoading(false);
      }
    },
  }), [units, linkDrafts, loadAll]);

  const updateUnitType = async (childPlaceId: string, unitType: string) => {
    try {
      const place = places.find((p: any) => p.id === childPlaceId);
      const attrs = (place?.attributes || []).map((a: any) => ({ key: a.key, value: a.value, value_type: a.valueType }));
      const filtered = attrs.filter((a: any) => a.key !== 'unit_type');
      if (unitType.trim()) filtered.push({ key: 'unit_type', value: unitType.trim(), value_type: 'text' });
      await placeService.update(childPlaceId, { attributes: filtered });
      await loadAll(true);
      Alert.alert('✅ تم', 'تم حفظ نوع الوحدة');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل حفظ نوع الوحدة');
    }
  };

  const placeOptions = useMemo(() => places.filter((p: any) => p.kind !== 'complex'), [places]);

  const pickLabel = unitForTypePick ? `${unitForTypePick.floor_number}-${unitForTypePick.unit_number}` : '';

  return (
    <>
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
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={() => void generate()}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.submitBtnText}>⚙️ توليد/تحديث الوحدات</Text>
        </TouchableOpacity>

        {err ? <Text style={{ marginTop: 10, color: '#EF4444', textAlign: 'right' }}>{err}</Text> : null}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : (
          <View style={{ marginTop: 16, gap: 10 }}>
            {units.map((u) => {
              const label = `${u.floor_number}-${u.unit_number}`;
              const linked = u.child_place_id ? placeOptions.find((p: any) => p.id === u.child_place_id) : null;
              const unitType = linked?.attributes?.find((a: any) => a.key === 'unit_type')?.value ?? '';
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

                  {!linked ? (
                    <TouchableOpacity
                      style={[styles.storeActionBtn, styles.storeActionEdit, { marginTop: 10 }]}
                      onPress={() => setUnitForTypePick(u)}
                      activeOpacity={0.85}
                      disabled={loading || linkablePlaceTypes.length === 0}
                    >
                      <Text style={styles.storeActionEditText}>➕ إنشاء مكان وربطه</Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'right' }}>
                      اربط بمعرّف مكان
                    </Text>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        value={getLinkDraft(u.id, u.child_place_id ?? null)}
                        placeholder="ضع placeId هنا (أو اتركه فارغ لفك الربط)"
                        placeholderTextColor="#9CA3AF"
                        style={[styles.formInput, { paddingLeft: 70 }]}
                        textAlign="left"
                        onChangeText={(t) => setLinkDrafts((prev) => ({ ...prev, [u.id]: t }))}
                        onSubmitEditing={() => void saveUnitLinkDraft(u.id, u.child_place_id ?? null)}
                      />
                      <TouchableOpacity
                        style={{
                          position: 'absolute',
                          left: 8,
                          top: 7,
                          minWidth: 54,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: '#2E86AB',
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: 10,
                        }}
                        onPress={() => void saveUnitLinkDraft(u.id, u.child_place_id ?? null)}
                        activeOpacity={0.85}
                        disabled={loading}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>حفظ</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 11, color: '#6B7280', textAlign: 'right', marginTop: 4 }}>
                      Enter أو زر حفظ لحفظ الربط
                    </Text>
                  </View>

                  {!isResidential && linked ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'right' }}>
                        نوع الوحدة (unit_type)
                      </Text>
                      <TextInput
                        defaultValue={unitType}
                        placeholder="مثال: متجر / مطعم / صيدلية ..."
                        placeholderTextColor="#9CA3AF"
                        style={styles.formInput}
                        textAlign="right"
                        onSubmitEditing={(e) => void updateUnitType(linked.id, String(e.nativeEvent.text || ''))}
                      />
                      <Text style={{ fontSize: 11, color: '#6B7280', textAlign: 'right', marginTop: 4 }}>
                        Enter لحفظ النوع
                      </Text>
                    </View>
                  ) : null}

                  {u.child_place_id ? (
                    <TouchableOpacity
                      style={[styles.storeActionBtn, styles.storeActionDelete, { marginTop: 10 }]}
                      onPress={() => void linkPlace(u.id, null)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.storeActionDeleteText}>🔗 فك الربط</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!unitForTypePick} animationType="slide" transparent>
        <View style={styles.housesOverlay}>
          <TouchableOpacity style={styles.housesBackdrop} onPress={() => setUnitForTypePick(null)} activeOpacity={1} />
          <View style={styles.housesSheet}>
            <View style={styles.housesSheetHeader}>
              <TouchableOpacity onPress={() => setUnitForTypePick(null)} activeOpacity={0.85}>
                <Text style={styles.housesCloseText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.housesSheetTitle} numberOfLines={2}>
                اختر نوع المكان — {isResidential ? 'بيت' : 'وحدة'} {pickLabel}
              </Text>
              <View style={{ width: 28 }} />
            </View>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
              {linkablePlaceTypes.length === 0 ? (
                <Text style={{ textAlign: 'right', color: '#6B7280', fontSize: 13 }}>
                  لا توجد أنواع متاحة. تحقق من تحميل الأنواع أو الاتصال بالسيرفر.
                </Text>
              ) : (
                linkablePlaceTypes.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.unitTypePickRow}
                    onPress={() => void createAndLinkChildPlace(unitForTypePick!, { id: t.id, name: t.name })}
                    activeOpacity={0.85}
                    disabled={loading}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'right', flex: 1 }}>
                      {getPlaceTypePluralLabel(t.name)}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 8 }}>←</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
});

