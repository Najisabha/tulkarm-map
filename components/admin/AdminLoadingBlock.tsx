import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { adminUsersStyles as styles } from './AdminUsers.styles';

export interface AdminLoadingBlockProps {
  message?: string;
  /** يملأ الشاشة مع توسيط المحتوى (مثل انتظار التحقق من الجلسة) */
  fullPage?: boolean;
}

export function AdminLoadingBlock({
  message = 'جاري تحميل المستخدمين...',
  fullPage = false,
}: AdminLoadingBlockProps) {
  const inner = (
    <>
      <ActivityIndicator size="large" color="#2E86AB" />
      <Text style={styles.loadingText}>{message}</Text>
    </>
  );
  if (fullPage) {
    return <View style={[styles.container, styles.centered]}>{inner}</View>;
  }
  return <View style={styles.loadingBlock}>{inner}</View>;
}
