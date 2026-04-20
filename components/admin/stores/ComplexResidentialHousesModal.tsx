import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TouchableOpacity, View } from 'react-native';
import { ComplexBuildingViewer, ComplexUnit } from '../../places/ComplexBuildingViewer';
import type { Store } from '../../../context/StoreContext';
import { placeService } from '../../../services/placeService';
import { adminStoresStyles as styles } from '../AdminStores.styles';

export interface ComplexResidentialHousesModalProps {
  visible: boolean;
  complexStore: Store | null;
  allStores: Store[];
  onClose: () => void;
  onOpenHouse: (houseStore: Store) => void;
}

export function ComplexResidentialHousesModal({
  visible,
  complexStore,
  allStores,
  onClose,
  onOpenHouse,
}: ComplexResidentialHousesModalProps) {
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

