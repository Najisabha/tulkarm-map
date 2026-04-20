import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { mapStyles as styles } from './styles';

interface MapTapOptionsSheetProps {
  canAddPlace: boolean;
  onAddPlace: () => void;
  onNavigateToArea: () => void;
  onClose: () => void;
}

export function MapTapOptionsSheet({
  canAddPlace,
  onAddPlace,
  onNavigateToArea,
  onClose,
}: MapTapOptionsSheetProps) {
  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      <TouchableOpacity style={styles.overlayBackdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.tapOptionsSheet}>
        <View style={styles.tapOptionsHandle} />
        <Text style={styles.tapOptionsTitle}>مكان فارغ</Text>

        {canAddPlace ? (
          <TouchableOpacity style={styles.tapOptionBtn} onPress={onAddPlace}>
            <Text style={styles.tapOptionBtnText}>➕ إضافة مكان</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.guestHint, { marginBottom: 10 }]}>
            سجّل الدخول أو أنشئ حساباً لإرسال طلب إضافة مكان (يُراجع من قبل الإدارة).
          </Text>
        )}

        <TouchableOpacity
          style={[styles.tapOptionBtn, styles.tapOptionBtnSecondary]}
          onPress={onNavigateToArea}
        >
          <Text style={styles.tapOptionBtnTextSecondary}>🧭 التوجه إلى هذه المنطقة</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tapOptionCancel} onPress={onClose}>
          <Text style={styles.tapOptionCancelText}>إلغاء</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
