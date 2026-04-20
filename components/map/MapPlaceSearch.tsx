import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCategoryStyle, type Store } from '../../utils/map/storeModel';
import { getPlaceTypeDisplayName } from '../../utils/placeTypeLabels';
import { mapStyles as styles } from './styles';

interface MapPlaceSearchProps {
  query: string;
  onChangeQuery: (q: string) => void;
  results: Store[];
  categoryList: { name: string; emoji: string; color: string }[];
  onSelectStore: (store: Store) => void;
}

export function MapPlaceSearch({
  query,
  onChangeQuery,
  results,
  categoryList,
  onSelectStore,
}: MapPlaceSearchProps) {
  const trimmed = query.trim();

  return (
    <View style={styles.placeSearchWrap} pointerEvents="box-none">
      <View style={styles.placeSearchInputRow}>
        <TextInput
          style={styles.placeSearchInput}
          placeholder="بحث في الأماكن..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={onChangeQuery}
          textAlign="right"
        />
        {trimmed ? (
          <TouchableOpacity
            style={styles.placeSearchClearBtn}
            onPress={() => onChangeQuery('')}
            activeOpacity={0.8}
          >
            <Text style={styles.placeSearchClearBtnText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {trimmed ? (
        <View style={styles.placeSearchResultsCard}>
          {results.length === 0 ? (
            <View style={styles.placeSearchEmpty}>
              <Text style={styles.placeSearchEmptyEmoji}>🔍</Text>
              <Text style={styles.placeSearchEmptyText}>لا توجد نتائج</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.placeSearchResults}
              contentContainerStyle={styles.placeSearchResultsContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {results.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.placeSearchItem}
                  onPress={() => onSelectStore(s)}
                  activeOpacity={0.85}
                >
                  <View style={styles.placeSearchItemEmojiPill}>
                    <Text style={styles.placeSearchItemEmoji}>
                      {getCategoryStyle(categoryList, s.category).emoji}
                    </Text>
                  </View>
                  <View style={styles.placeSearchItemMain}>
                    <Text style={styles.placeSearchItemName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.placeSearchItemMeta} numberOfLines={1}>
                      {getPlaceTypeDisplayName(s.category)}
                    </Text>
                  </View>
                  {s.phone ? (
                    <Text style={styles.placeSearchItemPhone} numberOfLines={1}>
                      {s.phone}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}
