import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  STATUS_LABELS,
  type PlaceRequestFilter,
  type PlaceRequestStatus,
} from '../../utils/admin/placeRequestsHelpers';
import { adminPlaceRequestsStyles as styles } from './AdminPlaceRequests.styles';

interface AdminPlaceRequestsFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: PlaceRequestFilter;
  onStatusChange: (status: PlaceRequestFilter) => void;
  onRefresh: () => void;
}

export function AdminPlaceRequestsFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  onRefresh,
}: AdminPlaceRequestsFiltersProps) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <TextInput
          style={styles.searchBar}
          placeholder="بحث في الأماكن..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={onSearchChange}
          textAlign="right"
        />
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshBtnText}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {(['pending', 'active', 'rejected', 'all'] as const).map((status) => {
          const isActive = statusFilter === status;
          const label =
            status === 'all'
              ? 'الكل'
              : STATUS_LABELS[status as PlaceRequestStatus];

          return (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => onStatusChange(status)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}
