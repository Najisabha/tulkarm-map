import React from 'react';
import { Animated, Text } from 'react-native';
import { mapStyles as styles } from './styles';

interface MapEnterExitBannerProps {
  translateY: Animated.Value;
  message: string;
}

export function MapEnterExitBanner({ translateY, message }: MapEnterExitBannerProps) {
  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <Text style={styles.bannerText}>{message}</Text>
    </Animated.View>
  );
}
