import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
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

/**
 * علامة ماركر مستقرة على الموبايل:
 * - على iOS/Android تستخدم `react-native-maps` كاش بصري للماركر، فيؤدي إعادة استخدام
 *   العرض (view recycling) بعد تحديث قائمة الأماكن (مثل: إضافة مكان جديد) إلى ظهور
 *   أيقونة خاطئة لمكان موجود (مثل تبديل أيقونة «مجمع تجاري»).
 * - الحل: تفعيل `tracksViewChanges` مؤقتًا عند الإنشاء أو عند تغير الأيقونة/اللون،
 *   ثم تعطيله بعد لحظة لتحسين الأداء — هذا النمط الموصى به رسميًا للمكتبة.
 * - على الويب لا يؤثر هذا البرَوب (الويب يستخدم `OverlayView`/`divIcon`).
 */
interface StableStoreMarkerProps {
  store: Store;
  emoji: string;
  color: string;
  opacity: number;
  scale: number;
  searchQuery: string;
  isActive: boolean;
  matches: boolean;
  onSelectStore: (store: Store) => void;
}

function StableStoreMarker({
  store,
  emoji,
  color,
  opacity,
  scale,
  searchQuery,
  isActive,
  matches,
  onSelectStore,
}: StableStoreMarkerProps) {
  const isWeb = Platform.OS === 'web';
  const [tracksViewChanges, setTracksViewChanges] = useState(!isWeb);

  // إعادة تفعيل التتبع عند تغير الأيقونة أو اللون لمكان موجود (مثلاً عند تحديث الفئة)،
  // ثم إيقافه بعد إطار قصير لمنع إعادة الرسم المستمرة.
  useEffect(() => {
    if (isWeb) return;
    setTracksViewChanges(true);
    const t = setTimeout(() => setTracksViewChanges(false), 250);
    return () => clearTimeout(t);
  }, [emoji, color, isWeb]);

  const nativeOnlyProps = isWeb
    ? {}
    : ({ identifier: store.id, tracksViewChanges } as Record<string, unknown>);

  return (
    <Marker
      coordinate={{ latitude: store.latitude, longitude: store.longitude }}
      onPress={() => onSelectStore(store)}
      // على الويب يُستهلك الشكل المخصص `{ emoji, color, opacity, scale }`؛
      // وعلى الموبايل يُتجاهل هذا البرَوب لأن العرض يأتي من الأطفال أدناه.
      icon={{ emoji, color, opacity, scale } as any}
      {...(nativeOnlyProps as object)}
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

        // المفتاح يضم الأيقونة واللون كحماية إضافية:
        // أي تغيير في الهوية البصرية لنفس المكان يُجبر RN على إعادة تركيب الماركر
        // بدل إعادة استخدام عرض قديم على الموبايل.
        return (
          <StableStoreMarker
            key={`${store.id}:${emoji}:${color}`}
            store={store}
            emoji={emoji}
            color={color}
            opacity={opacity}
            scale={scale}
            searchQuery={searchQuery}
            isActive={isActive}
            matches={matches}
            onSelectStore={onSelectStore}
          />
        );
      })}
    </>
  );
}
