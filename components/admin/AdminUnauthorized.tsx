import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { adminScreenStyles as styles } from './AdminScreen.styles';

interface AdminUnauthorizedProps {
  onBackToMap: () => void;
}

export function AdminUnauthorized({ onBackToMap }: AdminUnauthorizedProps) {
  return (
    <View style={styles.unauthorized}>
      <Text style={styles.unauthorizedText}>⛔ غير مصرح لك بالوصول</Text>
      <TouchableOpacity onPress={onBackToMap}>
        <Text style={styles.backLink}>العودة</Text>
      </TouchableOpacity>
    </View>
  );
}
