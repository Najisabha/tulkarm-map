import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { adminUsersStyles as styles } from './AdminUsers.styles';

export interface AdminErrorStateProps {
  message: string;
  hint?: string;
  retryLabel?: string;
  onRetry: () => void;
}

export function AdminErrorState({
  message,
  hint = 'تأكد أن الخادم يعمل ومسار /api/users متاحاً',
  retryLabel = 'إعادة المحاولة',
  onRetry,
}: AdminErrorStateProps) {
  return (
    <View style={styles.errorState}>
      <Text style={styles.errorText}>{message}</Text>
      <Text style={styles.errorHint}>{hint}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryBtnText}>{retryLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}
