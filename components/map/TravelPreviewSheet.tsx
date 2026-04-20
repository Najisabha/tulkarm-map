import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Coord } from '../../utils/map/geo';
import { travelChoiceToLabel, type TravelChoice } from '../../utils/map/routing';
import { BottomSheetFrame } from './BottomSheetFrame';
import { mapStyles as styles } from './styles';

interface TravelPreviewSheetProps {
  storeName: string;
  travelChoice: TravelChoice;
  origin: Coord | null;
  loading: boolean;
  routeInfo: { distance: string; duration: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function TravelPreviewSheet({
  storeName,
  travelChoice,
  origin,
  loading,
  routeInfo,
  onCancel,
  onConfirm,
  onClose,
}: TravelPreviewSheetProps) {
  const originText = origin
    ? `أنت هنا: ${origin.latitude.toFixed(5)}, ${origin.longitude.toFixed(5)}`
    : 'غير معروف';

  return (
    <BottomSheetFrame
      onBackdropPress={onCancel}
      inertBackdrop
      onClose={onClose}
      headerEmoji="🧾"
      headerEmojiBackground="#10B98120"
    >
      <View style={styles.travelPreviewBody}>
        <Text style={styles.travelPreviewTitle}>تأكيد التنقل</Text>
        <Text style={styles.travelPreviewSubtitle}>{travelChoiceToLabel(travelChoice)}</Text>

        <View style={styles.travelInfoBlock}>
          <Text style={styles.travelInfoLabel}>مكاني الحالي</Text>
          <Text style={styles.travelInfoValue}>{originText}</Text>
        </View>

        <View style={styles.travelInfoBlock}>
          <Text style={styles.travelInfoLabel}>مكان التوجه</Text>
          <Text style={styles.travelInfoValue}>{storeName}</Text>
        </View>

        {loading || !routeInfo ? (
          <Text style={styles.travelLoadingText}>جاري حساب المسار...</Text>
        ) : (
          <View style={styles.travelDurationBox}>
            <Text style={styles.travelDurationLine}>⏳ {routeInfo.distance} متبقية</Text>
            <Text style={styles.travelDurationLine2}>
              ⏱️ المدة الزمنية المتوقعة: {routeInfo.duration}
            </Text>
          </View>
        )}

        <View style={styles.travelPreviewBtnsRow}>
          <TouchableOpacity
            style={[styles.travelPreviewBtn, styles.travelCancelBtn]}
            onPress={onCancel}
          >
            <Text style={styles.travelPreviewBtnTextCancel}>إلغاء</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.travelPreviewBtn, styles.travelConfirmBtn]}
            onPress={onConfirm}
            disabled={loading || !routeInfo}
          >
            <Text style={styles.travelPreviewBtnTextConfirm}>تأكيد</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetFrame>
  );
}
