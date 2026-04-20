import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { mapStyles as styles } from './styles';

interface MapLocateButtonProps {
  onPress: () => void;
}

export function MapLocateButton({ onPress }: MapLocateButtonProps) {
  return (
    <TouchableOpacity style={styles.centerBtn} onPress={onPress}>
      <Text style={styles.centerBtnText}>🎯</Text>
    </TouchableOpacity>
  );
}
