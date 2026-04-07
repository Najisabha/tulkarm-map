/**
 * PlaceDetails — عرض عام لتفاصيل المكان (Domain).
 */

import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Place } from '../../types/place';
import { shadow } from '../../utils/shadowStyles';

interface PlaceDetailsProps {
  place: Place;
}

export function PlaceDetails({ place }: PlaceDetailsProps) {
  const phoneFromAttr =
    place.attributes.find((a) => a.key === 'phone')?.value ||
    place.attributes.find((a) => a.key === 'phone_number')?.value ||
    place.attributes.find((a) => a.key === 'store_number')?.value ||
    place.attributes.find((a) => a.key === 'raqm')?.value ||
    null;
  const phoneToShow = place.phoneNumber || phoneFromAttr;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.typePill}>
            <Text style={styles.typePillText}>{place.typeName}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {place.name}
          </Text>
        </View>

        {!!phoneToShow && (
          <View style={styles.heroMetaRow}>
            <TouchableOpacity
              style={styles.phonePill}
              activeOpacity={0.7}
              onPress={() => Linking.openURL(`tel:${phoneToShow}`)}
            >
              <Text style={styles.phonePillIcon}>📞</Text>
              <Text style={styles.phonePillLabel}>رقم الهاتف</Text>
              <Text style={styles.phonePillValue}>{phoneToShow}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!!place.description && (
        <Block label="الوصف">
          <Text style={styles.text}>{place.description}</Text>
        </Block>
      )}

      <Block label="الموقع">
        <View style={styles.coordsPill}>
          <Text style={styles.coordsText}>
            {place.location.latitude.toFixed(5)}, {place.location.longitude.toFixed(5)}
          </Text>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  title: { flex: 1, fontSize: 20, fontWeight: '900', color: '#111827', textAlign: 'right', lineHeight: 28 },
  typePill: {
    alignSelf: 'flex-end',
    backgroundColor: '#EBF5FB',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typePillText: { fontSize: 13, fontWeight: '800', color: '#2E86AB', textAlign: 'right' },
  phonePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-end',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  phonePillIcon: { fontSize: 16 },
  phonePillLabel: { fontSize: 12, fontWeight: '900', color: '#065F46' },
  phonePillValue: { fontSize: 13, fontWeight: '900', color: '#047857' },
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
  coordsPill: {
    alignSelf: 'flex-end',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  coordsText: { fontSize: 13, fontWeight: '800', color: '#111827', textAlign: 'right' },
});

