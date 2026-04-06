import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import type { AdminScreenIconProps } from './adminScreenIconTypes';

export function AdminScreenIcon({ name, size, color }: AdminScreenIconProps) {
  return <MaterialIcons name={name} size={size} color={color} />;
}
