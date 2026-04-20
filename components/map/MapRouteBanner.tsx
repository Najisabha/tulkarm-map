import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { mapStyles as styles } from './styles';

interface MapRouteBannerProps {
  distance: string;
  duration: string;
  onEnd: () => void;
}

export function MapRouteBanner({ distance, duration, onEnd }: MapRouteBannerProps) {
  return (
    <View style={styles.routeBanner}>
      <View style={styles.routeBannerContent}>
        <View style={styles.routeBannerInfo}>
          <Text style={styles.routeBannerDistance}>⏳ {distance} متبقية</Text>
          <Text style={styles.routeBannerDuration}>⏱️ المدة الزمنية المتوقعة: {duration}</Text>
        </View>
        <TouchableOpacity style={styles.routeBannerClose} onPress={onEnd}>
          <Text style={styles.routeBannerCloseText}>✕ إنهاء</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
