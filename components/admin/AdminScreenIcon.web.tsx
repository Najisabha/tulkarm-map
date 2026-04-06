import React from 'react';
import { Text } from 'react-native';
import type { AdminScreenIconProps } from './adminScreenIconTypes';

/** بدون MaterialIcons — يمنع expo-font / fontfaceobserver (6000ms) على الويب بالكامل لهذه الشاشة. */
export function AdminScreenIcon({ size, webGlyph }: AdminScreenIconProps) {
  return <Text style={{ fontSize: size * 0.92, lineHeight: size * 1.15 }}>{webGlyph}</Text>;
}
