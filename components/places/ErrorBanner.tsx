/**
 * ErrorBanner — شريط خطأ مرئي لعرض رسائل الخطأ بشكل موحّد.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ErrorBannerProps {
  message: string | null;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message} numberOfLines={3}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    gap: 8,
  },
  icon: { fontSize: 16, lineHeight: 22 },
  message: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'right',
    lineHeight: 20,
    fontWeight: '600',
  },
  dismissBtn: { padding: 2 },
  dismissText: { fontSize: 14, color: '#DC2626', fontWeight: '700' },
});
