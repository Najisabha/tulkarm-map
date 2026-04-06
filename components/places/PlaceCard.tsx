/**
 * PlaceCard — بطاقة عرض عامة لأي نوع مكان (Domain).
 */

import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Place } from '../../types/place';

interface PlaceCardProps {
  place: Place;
  onPress?: () => void;
}

export function PlaceCard({ place, onPress }: PlaceCardProps) {
  const firstImage = place.images?.[0]?.url;
  const ratingText =
    place.ratingCount > 0 ? `${place.avgRating.toFixed(1)} (${place.ratingCount})` : 'بدون تقييم';

  const content = (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {firstImage ? (
          <Image source={{ uri: firstImage }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>📍</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={styles.type} numberOfLines={1}>
          {place.typeName}
        </Text>
        {!!place.description && (
          <Text style={styles.desc} numberOfLines={2}>
            {place.description}
          </Text>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.rating}>⭐ {ratingText}</Text>
          <Text style={[styles.status, place.status === 'active' ? styles.active : styles.pending]}>
            {place.status === 'active' ? 'منشور' : place.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
          </Text>
        </View>
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row-reverse',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  imageWrap: { width: 76, height: 76, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 28 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '800', color: '#111827', textAlign: 'right' },
  type: { fontSize: 12, fontWeight: '700', color: '#2E86AB', textAlign: 'right', marginTop: 2 },
  desc: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 6, lineHeight: 18 },
  metaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  rating: { fontSize: 12, color: '#374151', fontWeight: '700' },
  status: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  active: { backgroundColor: '#DCFCE7', color: '#15803D' },
  pending: { backgroundColor: '#FEF3C7', color: '#92400E' },
});

