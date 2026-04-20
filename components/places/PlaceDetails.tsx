/**
 * PlaceDetails — عرض عام لتفاصيل المكان (Domain).
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Place } from '../../types/place';
import { shadow } from '../../utils/shadowStyles';

interface PlaceDetailsProps {
  place: Place;
}

export function PlaceDetails({ place }: PlaceDetailsProps) {
  return (
    
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

      {!!place.description && (
        <Block label="الوصف">
          <Text style={styles.text}>{place.description}</Text>
        </Block>
      )}

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
  scroll: { alignSelf: 'stretch', width: '100%' },
  container: { padding: 16, paddingBottom: 28, gap: 12, width: '100%' },
  hero: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.06, radius: 8, elevation: 3 }),
  },
  heroRow: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
  },
  placeNameBox: {
    flex: 1,
    flexBasis: 0,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  placeNameText: { fontSize: 16, fontWeight: '900', color: '#111827', textAlign: 'right' },
  placeInfoBox: {
    flex: 1,
    flexBasis: 0,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 6,
  },
  placeInfoLine: { fontSize: 13, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  block: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    gap: 6,
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.04, radius: 6, elevation: 2 }),
  },
  blockLabel: { fontSize: 12, fontWeight: '800', color: '#374151', textAlign: 'right' },
  text: { fontSize: 14, color: '#111827', textAlign: 'right', lineHeight: 22 },
});

