import React from 'react';
import { Alert, Linking, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { ComplexBuildingViewer, ComplexUnit } from '../places/ComplexBuildingViewer';
import { PlaceDetails } from '../places/PlaceDetails';
import type { AuthUser } from '../../stores/useAuthStore';
import { formatDistance, haversineDistance } from '../../utils/map/geo';
import { getCategoryStyle, storeToPlaceViewModel, type Store } from '../../utils/map/storeModel';
import { getPlaceTypeDisplayName } from '../../utils/placeTypeLabels';
import { BottomSheetFrame } from './BottomSheetFrame';
import { mapStyles as styles } from './styles';

export interface StoreDetailSheetProps {
  store: Store;
  userLocation: { latitude: number; longitude: number } | null;
  user: AuthUser | null;
  categoryList: { name: string; emoji: string; color: string }[];
  onClose: () => void;
  onNavigate: () => void;
  onReport: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onOpenChildPlace: (childPlaceId: string) => void;
  onAddUnit: (unit: ComplexUnit, store: Store) => void;
}

export function StoreDetailSheet({
  store,
  userLocation,
  user,
  categoryList,
  onClose,
  onNavigate,
  onReport,
  onEdit,
  onDelete,
  onOpenChildPlace,
  onAddUnit,
}: StoreDetailSheetProps) {
  const catStyle = getCategoryStyle(categoryList, store.category);
  const dist = userLocation
    ? haversineDistance(userLocation.latitude, userLocation.longitude, store.latitude, store.longitude)
    : null;

  const attrs = store.attributes || [];
  const attrRaw = (key: string) => attrs.find((a) => a.key === key)?.value;

  /** Attributes may be plain text or JSON wrappers like `{"v":"..."}`. */
  const attr = (key: string) => {
    const raw = attrRaw(key);
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const candidate = (parsed as any).v ?? (parsed as any).value ?? (parsed as any).val ?? null;
        if (candidate !== null && candidate !== undefined) return String(candidate);
      }
    } catch {
      // plain string
    }
    return raw;
  };

  const firstAttr = (...keys: string[]) => {
    for (const k of keys) {
      const v = attr(k);
      if (v && String(v).trim()) return String(v).trim();
    }
    return undefined;
  };

  const typeName = store.category;
  const isHouse = typeName === 'منزل';
  const isStoreLike = typeName === 'متجر تجاري' || typeName === 'مجمّع تجاري';
  const isResidentialComplex = typeName === 'مجمّع سكني';
  const isCommercialComplex = typeName === 'مجمّع تجاري';
  const isComplex = isResidentialComplex || isCommercialComplex;

  const houseNumber = attr('house_number');
  const floorsCount = store.floorsCount ?? attr('floors_count');
  const unitsPerFloor =
    store.unitsPerFloor ??
    attr('units_per_floor') ??
    attr('houses_per_floor') ??
    attr('stores_per_floor');

  const floorsCountNum = floorsCount ? parseInt(String(floorsCount), 10) : 0;
  const unitsPerFloorNum = unitsPerFloor ? parseInt(String(unitsPerFloor), 10) : 0;
  const phoneForCall =
    store.phone || firstAttr('phone', 'phone_number', 'store_number', 'raqm') || null;

  const renderCallButton = (number: string) => (
    <TouchableOpacity
      style={styles.storeModalCallBtn}
      onPress={() => Linking.openURL(`tel:${number}`)}
      activeOpacity={0.86}
    >
      <View style={styles.storeModalCallBtnIconWrap}>
        <Text style={styles.storeModalCallBtnIcon}>📞</Text>
      </View>
      <Text style={styles.storeModalCallBtnLabel}>اتصال</Text>
      <Text style={styles.storeModalCallBtnText}>{number}</Text>
    </TouchableOpacity>
  );

  const confirmDelete = () => {
    Alert.alert('حذف المتجر', `هل أنت متأكد من حذف "${store.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <BottomSheetFrame
      onBackdropPress={onClose}
      inertBackdrop
      onClose={onClose}
      headerTitle={store.name}
      headerEmoji={catStyle.emoji}
      headerEmojiBackground={catStyle.color + '20'}
    >
      <View style={styles.storeModalBody}>
        <View style={styles.storeModalPillsRow}>
          <View style={styles.storeModalPillsGroup}>
            {dist !== null && (
              <View style={styles.storeModalDistancePill}>
                <Text style={styles.storeModalDistanceText}>{formatDistance(dist)}</Text>
              </View>
            )}
            <View style={[styles.storeModalCategoryPill, { backgroundColor: catStyle.color + '18' }]}>
              <Text style={[styles.storeModalCategoryText, { color: catStyle.color }]}>
                {getPlaceTypeDisplayName(store.category)}
              </Text>
            </View>
          </View>
          <View style={styles.storeModalCurrentCoordsBox}>
            <Text style={styles.storeModalCurrentCoordsText} numberOfLines={1}>
              {userLocation
                ? `موقعك: ${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)}`
                : 'موقعك: غير متاح'}
            </Text>
          </View>
        </View>

        <PlaceDetails place={storeToPlaceViewModel(store) as any} />

        {isComplex && floorsCountNum > 0 && unitsPerFloorNum > 0 ? (
          <ComplexBuildingViewer
            placeId={store.id}
            complexType={isResidentialComplex ? 'residential' : 'commercial'}
            floorsCount={floorsCountNum}
            unitsPerFloor={unitsPerFloorNum}
            onUnitPress={(unit) => {
              if (unit.child_place_id && unit.child_place_name) {
                onOpenChildPlace(unit.child_place_id);
              } else {
                onAddUnit(unit, store);
              }
            }}
          />
        ) : null}

        <View style={styles.storeModalBtnRow}>
          {isHouse && houseNumber
            ? renderCallButton(houseNumber)
            : !isHouse && !isStoreLike && phoneForCall
              ? renderCallButton(phoneForCall)
              : null}

          <Pressable
            style={[styles.storeModalActionBtn, styles.storeModalNavigateBtn]}
            onPress={onNavigate}
            pointerEvents="auto"
          >
            <Text style={styles.storeModalNavigateBtnIcon}>🧭</Text>
            <Text style={styles.storeModalNavigateBtnText}>الانتقال إلى المكان</Text>
            {dist !== null && (
              <Text style={styles.storeModalNavigateBtnSub}>يبعد {formatDistance(dist)}</Text>
            )}
          </Pressable>

          {isStoreLike && phoneForCall ? renderCallButton(phoneForCall) : null}
        </View>

        {user?.id !== 'guest' && (
          <TouchableOpacity style={styles.storeModalReportBtn} onPress={onReport}>
            <Text style={styles.storeModalReportBtnText}>⚠️ الإبلاغ عن هذا المكان</Text>
          </TouchableOpacity>
        )}

        {user?.isAdmin && (
          <View style={styles.storeModalAdminRow}>
            <TouchableOpacity style={styles.storeModalEditBtn} onPress={onEdit}>
              <Text style={styles.storeModalEditBtnText}>✏️ تعديل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.storeModalDeleteBtn} onPress={confirmDelete}>
              <Text style={styles.storeModalDeleteBtnText}>🗑️ حذف</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </BottomSheetFrame>
  );
}
