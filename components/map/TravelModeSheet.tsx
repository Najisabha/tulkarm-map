import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { TravelChoice } from '../../utils/map/routing';
import { BottomSheetFrame } from './BottomSheetFrame';
import { mapStyles as styles } from './styles';

interface TravelModeSheetProps {
  storeName: string | undefined;
  onPick: (choice: TravelChoice) => void;
  onBack: () => void;
  onClose: () => void;
}

const MODE_OPTIONS: { choice: TravelChoice; label: string; color: string }[] = [
  { choice: 'walking', label: '🚶 مشي', color: '#2E86AB' },
  { choice: 'bike1', label: '🛵 بسكليت', color: '#7C3AED' },
  { choice: 'bike2', label: '🚲 دراجة', color: '#16A34A' },
  { choice: 'driving', label: '🚗 سيارة', color: '#EF4444' },
];

export function TravelModeSheet({ storeName, onPick, onBack, onClose }: TravelModeSheetProps) {
  return (
    <BottomSheetFrame
      onBackdropPress={onBack}
      inertBackdrop
      onClose={onClose}
      headerEmoji="🧭"
      headerEmojiBackground="#2E86AB20"
    >
      <View style={styles.travelModeBody}>
        <Text style={styles.travelModeTitle}>اختر وسيلة الذهاب</Text>
        <Text style={styles.travelModeSubtitle}>{storeName}</Text>

        <View style={styles.travelModeGrid}>
          {MODE_OPTIONS.map(({ choice, label, color }) => (
            <TouchableOpacity
              key={choice}
              style={[styles.travelModeOptionBtn, { backgroundColor: color }]}
              onPress={() => onPick(choice)}
            >
              <Text style={styles.travelModeOptionText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.travelBackBtn} onPress={onBack}>
          <Text style={styles.travelBackBtnText}>إلغاء</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetFrame>
  );
}
