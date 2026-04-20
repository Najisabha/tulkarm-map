import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { PlaceData } from '../../api/client';
import {
  catColor,
  catEmoji,
  normalizePlaceStatus,
  STATUS_LABELS,
  type CategoryItem,
} from '../../utils/admin/placeRequestsHelpers';
import { adminPlaceRequestsStyles as styles } from './AdminPlaceRequests.styles';

interface AdminPlaceRequestCardProps {
  place: PlaceData;
  categories: CategoryItem[];
  onAccept: (place: PlaceData) => void;
  onReject: (place: PlaceData) => void;
  onDelete: (place: PlaceData) => void;
  onEdit: (place: PlaceData) => void;
}

export function AdminPlaceRequestCard({
  place,
  categories,
  onAccept,
  onReject,
  onDelete,
  onEdit,
}: AdminPlaceRequestCardProps) {
  const phone = place.attributes?.find((a) => a.key === 'phone')?.value;
  const status = normalizePlaceStatus(place.status);
  const isPending = status === 'pending';
  const typeColor = catColor(categories, place.type_name);

  return (
    <View style={[styles.requestCard, isPending && styles.requestCardPending]}>
      <View style={styles.cardTop}>
        <View style={[styles.typeIconCircle, { backgroundColor: `${typeColor}22` }]}>
          <Text style={styles.typeIconEmoji}>{catEmoji(categories, place.type_name)}</Text>
        </View>
        <View style={styles.cardMain}>
          <View style={styles.requestHeader}>
            <Text style={styles.requestName} numberOfLines={2}>
              {place.name}
            </Text>
            <View
              style={[
                styles.statusBadge,
                status === 'pending' && styles.statusPending,
                status === 'active' && styles.statusAccepted,
                status === 'rejected' && styles.statusRejected,
              ]}
            >
              <Text style={styles.statusText}>{STATUS_LABELS[status] || place.status}</Text>
            </View>
          </View>
          {place.description ? (
            <Text style={styles.requestDesc} numberOfLines={2}>
              {place.description}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.chipsRow}>
        <View style={[styles.chip, { borderColor: `${typeColor}55` }]}>
          <Text style={[styles.chipText, { color: typeColor }]}>{place.type_name}</Text>
        </View>
        {phone ? (
          <View style={styles.chip}>
            <Text style={styles.chipTextMuted} selectable>
              📞 {phone}
            </Text>
          </View>
        ) : null}
        <View style={styles.chipMuted}>
          <Text style={styles.chipCoords} selectable>
            📌 {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
          </Text>
        </View>
      </View>
      <View style={styles.actionSection}>
        {isPending ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionAccept]}
              onPress={() => onAccept(place)}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnTextLight}>✓ تفعيل</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionReject]}
              onPress={() => onReject(place)}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnTextDanger}>✕ رفض</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionEdit]}
            onPress={() => onEdit(place)}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnTextEdit}>✎ تعديل</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionDelete]}
            onPress={() => onDelete(place)}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnTextDanger}>🗑 حذف</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
