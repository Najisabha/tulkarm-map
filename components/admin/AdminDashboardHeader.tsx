import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { AdminScreenIcon } from './AdminScreenIcon';
import { adminScreenStyles as styles } from './AdminScreen.styles';

interface AdminDashboardHeaderProps {
  onBackToMap: () => void;
}

export function AdminDashboardHeader({ onBackToMap }: AdminDashboardHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle} numberOfLines={1}>
        لوحة الإدارة
      </Text>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBackToMap}
        accessibilityRole="button"
        accessibilityLabel="العودة للخريطة"
      >
        <AdminScreenIcon name="arrow-forward" size={22} color="#fff" webGlyph="→" />
      </TouchableOpacity>
      <View style={styles.headerBadge}>
        <AdminScreenIcon name="verified-user" size={14} color="#fff" webGlyph="👑" />
        <Text style={styles.headerBadgeText}>مدير</Text>
      </View>
    </View>
  );
}
