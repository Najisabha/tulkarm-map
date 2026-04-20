import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { adminUsersStyles as styles } from './AdminUsers.styles';

export interface AdminSearchBarProps {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
}

export function AdminSearchBar({ value, onChange, placeholder }: AdminSearchBarProps) {
  return (
    <View style={styles.searchWrap}>
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChange}
        textAlign="right"
      />
    </View>
  );
}
