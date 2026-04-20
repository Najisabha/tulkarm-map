import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { mapStyles as styles } from './styles';

interface MapTopBarProps {
  inTulkarm: boolean | null;
  isAdmin: boolean;
  onOpenSidebar: () => void;
  onOpenAdmin: () => void;
}

export function MapTopBar({ inTulkarm, isAdmin, onOpenSidebar, onOpenAdmin }: MapTopBarProps) {
  const statusText =
    inTulkarm === null ? 'جارٍ التحديد...' : inTulkarm ? 'داخل المنطقة' : 'خارج المنطقة';

  return (
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.iconBtn} onPress={onOpenSidebar}>
        <Text style={styles.menuIcon}>☰</Text>
      </TouchableOpacity>

      <View style={styles.statusPill}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: inTulkarm ? '#10B981' : '#EF4444' },
          ]}
        />
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {isAdmin ? (
        <TouchableOpacity style={styles.iconBtn} onPress={onOpenAdmin}>
          <Text style={styles.menuIcon}>⚙️</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
}
