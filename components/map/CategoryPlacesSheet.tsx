import React from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { PlaceCard } from '../places/PlaceCard';
import type { PlaceCategoryTreeItem } from '../../types/placeCategories';
import type { CategoryBrowseState } from '../../utils/map/categoryFilters';
import { formatDistance } from '../../utils/map/geo';
import {
  getCategoryStyle,
  storeToPlaceViewModel,
  type Store,
} from '../../utils/map/storeModel';
import { getPlaceTypeDisplayName } from '../../utils/placeTypeLabels';
import { mapStyles as styles } from './styles';

type StoreWithDistance = Store & { distance: number | null };

interface CategoryPlacesSheetProps {
  selectedCategory: string;
  subtitle: string;
  categoryList: { name: string; emoji: string; color: string }[];
  categoryBrowse: CategoryBrowseState | null;
  placeCategoryTree: PlaceCategoryTreeItem[];
  treeLoading: boolean;
  categoryStores: StoreWithDistance[];
  onBack: () => void;
  onClose: () => void;
  onPickMain: (main: { id: string; name: string }) => void;
  onPickSub: (sub: { id: string; name: string }) => void;
  onPickStore: (store: Store) => void;
}

export function CategoryPlacesSheet({
  selectedCategory,
  subtitle,
  categoryList,
  categoryBrowse,
  placeCategoryTree,
  treeLoading,
  categoryStores,
  onBack,
  onClose,
  onPickMain,
  onPickSub,
  onPickStore,
}: CategoryPlacesSheetProps) {
  const showBack =
    !!categoryBrowse && (categoryBrowse.step === 'sub' || categoryBrowse.step === 'places');

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      <TouchableOpacity style={styles.overlayBackdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          {showBack ? (
            <TouchableOpacity style={styles.sheetBackBtn} onPress={onBack}>
              <Text style={styles.sheetBackBtnText}>‹</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.sheetHeaderLeadingSpacer} />
          )}
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitleEmoji}>
              {getCategoryStyle(categoryList, selectedCategory).emoji}
            </Text>
            <View style={styles.sheetTitleTextCol}>
              <Text style={styles.sheetTitle}>{getPlaceTypeDisplayName(selectedCategory)}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Text style={styles.sheetCloseBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {categoryBrowse?.step === 'main' && treeLoading ? (
          <View style={styles.sheetEmpty}>
            <ActivityIndicator size="large" color="#2E86AB" />
          </View>
        ) : categoryBrowse?.step === 'main' && placeCategoryTree.length > 0 ? (
          <FlatList
            data={placeCategoryTree}
            keyExtractor={(item) => item.main.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.sheetTreeItem}
                onPress={() => onPickMain(item.main)}
              >
                <Text style={styles.sheetTreeItemEmoji}>{item.main.emoji ?? '📁'}</Text>
                <Text style={styles.sheetTreeItemText}>{item.main.name}</Text>
                <Text style={styles.sheetTreeItemChevron}>‹</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.sheetList}
            showsVerticalScrollIndicator={false}
          />
        ) : categoryBrowse?.step === 'sub' ? (
          <FlatList
            data={
              placeCategoryTree.find((t) => t.main.id === categoryBrowse.mainId)?.sub_categories ??
              []
            }
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.sheetTreeItem} onPress={() => onPickSub(item)}>
                <Text style={styles.sheetTreeItemEmoji}>{item.emoji ?? '📂'}</Text>
                <Text style={styles.sheetTreeItemText}>{item.name}</Text>
                <Text style={styles.sheetTreeItemChevron}>‹</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.sheetEmpty}>
                <Text style={styles.sheetEmptyText}>لا توجد تصنيفات فرعية</Text>
              </View>
            }
            contentContainerStyle={styles.sheetList}
            showsVerticalScrollIndicator={false}
          />
        ) : categoryStores.length === 0 ? (
          <View style={styles.sheetEmpty}>
            <Text style={styles.sheetEmptyText}>لا توجد أماكن في هذه الفئة بعد</Text>
          </View>
        ) : (
          <FlatList
            data={categoryStores}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CategoryStoreRow
                item={item}
                categoryList={categoryList}
                onPress={() => onPickStore(item)}
              />
            )}
            contentContainerStyle={styles.sheetList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

interface CategoryStoreRowProps {
  item: StoreWithDistance;
  categoryList: { name: string; emoji: string; color: string }[];
  onPress: () => void;
}

function CategoryStoreRow({ item, categoryList, onPress }: CategoryStoreRowProps) {
  const isNear = item.distance !== null && item.distance < 500;
  return (
    <TouchableOpacity style={styles.catStoreItem} onPress={onPress}>
      <View style={styles.catStoreLeft}>
        <View
          style={[
            styles.catStoreDistanceBadge,
            { backgroundColor: isNear ? '#DCFCE7' : '#EBF5FB' },
          ]}
        >
          <Text
            style={[
              styles.catStoreDistanceText,
              { color: isNear ? '#16A34A' : '#2E86AB' },
            ]}
          >
            {item.distance !== null ? formatDistance(item.distance) : '—'}
          </Text>
        </View>
      </View>
      <View style={styles.catStoreInfo}>
        <PlaceCard place={storeToPlaceViewModel(item) as any} />
      </View>
      <Text style={styles.catStoreEmoji}>
        {getCategoryStyle(categoryList, item.category).emoji}
      </Text>
    </TouchableOpacity>
  );
}
