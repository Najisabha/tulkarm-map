/**
 * LocationPicker — يعرض الإحداثيات المختارة.
 * المكوّن بسيط حالياً (القيم تأتي من الضغط على الخريطة)؛
 * يمكن توسيعه لاحقاً ليتيح تحريك الدبوس يدوياً.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface LocationPickerProps {
  latitude: number;
  longitude: number;
}

export function LocationPicker({ latitude, longitude }: LocationPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        📌 {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    marginTop: 4,
  },
  text: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    lineHeight: 18,
  },
});
