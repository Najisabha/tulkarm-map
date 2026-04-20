import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { getCategoryStyle, type Store } from '../../utils/map/storeModel';
import { mapStyles as styles } from './styles';

interface MapCategoryBarProps {
  categories: string[];
  stores: Store[];
  categoryList: { name: string; emoji: string; color: string }[];
  selectedCategory: string | null;
  onToggleCategory: (category: string) => void;
}

export function MapCategoryBar({
  categories,
  stores,
  categoryList,
  selectedCategory,
  onToggleCategory,
}: MapCategoryBarProps) {
  return (
    <View style={styles.categoryBar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryBarContent}
      >
        {categories.map((cat) => {
          const count = stores.filter((s) => s.category === cat).length;
          const active = selectedCategory === cat;
          const { color, emoji } = getCategoryStyle(categoryList, cat);
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                active && { backgroundColor: color, borderColor: color },
              ]}
              onPress={() => onToggleCategory(cat)}
            >
              <Text style={styles.categoryChipEmoji}>{emoji}</Text>
              <Text
                style={[
                  styles.categoryChipText,
                  active && styles.categoryChipTextActive,
                ]}
              >
                {cat}
              </Text>
              <View
                style={[
                  styles.categoryChipBadge,
                  active ? styles.categoryChipBadgeActive : { backgroundColor: color + '22' },
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipBadgeText,
                    active ? { color: '#fff' } : { color },
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
