import React from 'react';
import { Text, View } from 'react-native';
import { Marker } from '../MapWrapper';
import type { CategoryBrowseState } from '../../utils/map/categoryFilters';
import { storeMatchesCategoryDrill } from '../../utils/map/categoryFilters';
import { getCategoryStyle, matchesQuery, type Store } from '../../utils/map/storeModel';
import { mapStyles as styles } from './styles';

interface MapMarkersLayerProps {
  stores: Store[];
  categoryList: { name: string; emoji: string; color: string }[];
  selectedCategory: string | null;
  categoryBrowse: CategoryBrowseState | null;
  searchQuery: string;
  onSelectStore: (store: Store) => void;
}

export function MapMarkersLayer({
  stores,
  categoryList,
  selectedCategory,
  categoryBrowse,
  searchQuery,
  onSelectStore,
}: MapMarkersLayerProps) {
  return (
    <>
      {stores.map((store) => {
        const { color, emoji } = getCategoryStyle(categoryList, store.category);
        const isActive =
          selectedCategory === null ||
          storeMatchesCategoryDrill(store, selectedCategory, categoryBrowse);
        const matches = !searchQuery || matchesQuery(store, searchQuery);
        const opacity = isActive && matches ? 1 : searchQuery ? 0.18 : 0.35;
        const scale = isActive && matches ? 1 : searchQuery ? 0.78 : 0.8;

        return (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            title={store.name}
            description={store.description}
            onPress={() => onSelectStore(store)}
            // Web MapWrapper consumes a custom `{ emoji, color, opacity, scale }` shape;
            // native `react-native-maps` ignores it (children `<View>` render instead).
            icon={{ emoji, color, opacity, scale } as any}
          >
            <View
              style={[
                styles.markerContainer,
                {
                  backgroundColor: color,
                  opacity: isActive && matches ? 1 : searchQuery ? 0.25 : 0.35,
                  transform: [{ scale }],
                },
              ]}
            >
              <Text style={styles.markerEmoji}>{emoji}</Text>
            </View>
          </Marker>
        );
      })}
    </>
  );
}
