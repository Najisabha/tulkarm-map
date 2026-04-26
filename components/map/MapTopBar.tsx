import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { mapStyles as styles } from './styles';

interface MapTopBarProps {
  inTulkarm: boolean | null;
  isAdmin: boolean;
  userName?: string;
  userImageUrl?: string | null;
  onOpenSidebar: () => void;
  onOpenAdmin: () => void;
}

export function MapTopBar({
  inTulkarm,
  isAdmin,
  userName,
  userImageUrl,
  onOpenSidebar,
  onOpenAdmin,
}: MapTopBarProps) {
  const statusText =
    inTulkarm === null ? 'جارٍ التحديد...' : inTulkarm ? 'داخل المنطقة' : 'خارج المنطقة';
  const initials = (userName || '')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
        <View style={styles.iconBtn}>
          {userImageUrl ? (
            <Image source={{ uri: userImageUrl }} style={styles.topBarAvatarImage} />
          ) : (
            <Text style={styles.topBarAvatarText}>{initials || '👤'}</Text>
          )}
        </View>
      )}
    </View>
  );
}
