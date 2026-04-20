import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { AdminScreenIcon } from './AdminScreenIcon';
import type { AdminDashboardIconName } from './adminScreenIconTypes';
import { adminScreenStyles as styles } from './AdminScreen.styles';

export interface AdminQuickMenuItem {
  label: string;
  icon: AdminDashboardIconName;
  webGlyph: string;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
}

interface AdminQuickMenuProps {
  /** Each inner array is one row (1 or 2 tiles). */
  rows: AdminQuickMenuItem[][];
  onLogout: () => void;
}

function MenuTile({ item }: { item: AdminQuickMenuItem }) {
  return (
    <TouchableOpacity style={styles.menuGridCell} onPress={item.onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconWrap, { backgroundColor: item.iconBg }]}>
        <AdminScreenIcon name={item.icon} size={26} color={item.iconColor} webGlyph={item.webGlyph} />
      </View>
      <Text style={styles.menuGridCellText}>{item.label}</Text>
    </TouchableOpacity>
  );
}

export function AdminQuickMenu({ rows, onLogout }: AdminQuickMenuProps) {
  return (
    <View style={styles.menuSection}>
      <Text style={styles.menuTitle}>الإدارة</Text>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.menuGridRow}>
          {row.map((item) => (
            <MenuTile key={item.label} item={item} />
          ))}
        </View>
      ))}
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.85}>
        <AdminScreenIcon name="logout" size={22} color="#fff" webGlyph="🚪" />
        <Text style={styles.logoutBtnText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </View>
  );
}
