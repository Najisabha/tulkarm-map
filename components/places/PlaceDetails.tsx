/**
 * PlaceDetails — عرض عام لتفاصيل المكان (Domain).
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Place } from '../../types/place';

interface PlaceDetailsProps {
  place: Place;
}

export function PlaceDetails({ place }: PlaceDetailsProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{place.name}</Text>
      <Text style={styles.subtitle}>{place.typeName}</Text>

      {!!place.description && (
        <Block label="الوصف">
          <Text style={styles.text}>{place.description}</Text>
        </Block>
      )}

      {(place.phoneNumber || place.attributes.some((a) => a.key === 'phone')) && (
        <Block label="رقم الهاتف">
          <Text style={styles.text}>
            {place.phoneNumber || place.attributes.find((a) => a.key === 'phone')?.value}
          </Text>
        </Block>
      )}

      <Block label="الموقع">
        <Text style={styles.text}>
          {place.location.latitude.toFixed(5)}, {place.location.longitude.toFixed(5)}
        </Text>
      </Block>

      {place.kind === 'categorized' && (
        <Block label="التصنيف">
          <Text style={styles.text}>
            {(place.mainCategory || '—') + (place.subCategory ? ` / ${place.subCategory}` : '')}
          </Text>
        </Block>
      )}

      {place.kind === 'complex' && (
        <Block label="المجمع">
          <Text style={styles.text}>
            {place.complexType === 'residential' ? 'سكني' : 'تجاري'} — طوابق: {place.floorsCount} — وحدات/طابق: {place.unitsPerFloor}
          </Text>
        </Block>
      )}
    </ScrollView>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 28, gap: 12 },
  title: { fontSize: 22, fontWeight: '900', color: '#111827', textAlign: 'right' },
  subtitle: { fontSize: 14, fontWeight: '700', color: '#2E86AB', textAlign: 'right' },
  block: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  blockLabel: { fontSize: 12, fontWeight: '800', color: '#374151', textAlign: 'right' },
  text: { fontSize: 14, color: '#111827', textAlign: 'right', lineHeight: 22 },
});

