import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { AdminScreenIcon } from './AdminScreenIcon';
import { adminUsersStyles as styles } from './AdminUsers.styles';

export interface AdminSubHeaderProps {
  title: string;
  onBack: () => void;
  badgeText?: string;
}

export function AdminSubHeader({ title, onBack, badgeText }: AdminSubHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="رجوع"
      >
        <AdminScreenIcon name="arrow-forward" size={22} color="#fff" webGlyph="→" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {badgeText ? (
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{badgeText}</Text>
        </View>
      ) : null}
    </View>
  );
}
