import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface CoordProps {
  latitude: number;
  longitude: number;
}

interface MapViewProps {
  style?: any;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  onPress?: (event: any) => void;
  children?: React.ReactNode;
  ref?: any;
}

interface MarkerProps {
  coordinate: CoordProps;
  title?: string;
  description?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}

interface CircleProps {
  center: CoordProps;
  radius?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export const MapView = React.forwardRef<any, MapViewProps>(({ style, children }, ref) => (
  <View style={[styles.mapPlaceholder, style]}>
    <Text style={styles.mapIcon}>🗺️</Text>
    <Text style={styles.mapText}>الخريطة متاحة على تطبيق الموبايل فقط</Text>
    <Text style={styles.mapSubText}>Map available on mobile app only</Text>
  </View>
));

MapView.displayName = 'MapView';

export const Marker = (_props: MarkerProps) => null;
export const Circle = (_props: CircleProps) => null;
export const PROVIDER_DEFAULT = undefined;

const styles = StyleSheet.create({
  mapPlaceholder: {
    backgroundColor: '#D1E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    minHeight: 200,
  },
  mapIcon: { fontSize: 48, marginBottom: 8 },
  mapText: { fontSize: 14, color: '#2E86AB', fontWeight: '600', textAlign: 'center' },
  mapSubText: { fontSize: 12, color: '#6B7280', marginTop: 4 },
});
