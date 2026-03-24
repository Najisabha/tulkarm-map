import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AddPlaceModal } from '../../components/AddPlaceModal';
import { ReportModal } from '../../components/ReportModal';
import { Circle, MapView, Marker, PROVIDER_GOOGLE } from '../../components/MapWrapper';
import { LAYOUT } from '../../constants/layout';
import { MAP_STYLE_NO_POI } from '../../constants/mapStyle';
import { USE_API } from '../../api/config';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoryContext';
import { Store, useStores } from '../../context/StoreContext';
import { isInsideTulkarm, startGeofencing, TULKARM_REGION } from '../../utils/geofencing';
import { shadow } from '../../utils/shadowStyles';

function getCategoryStyle(categories: { name: string; emoji: string; color: string }[], name: string) {
  const c = categories.find((x) => x.name === name);
  return { emoji: c?.emoji ?? '📍', color: c?.color ?? '#2E86AB' };
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} م`;
  return `${(meters / 1000).toFixed(1)} كم`;
}

export default function MapScreen() {
  const { user, logout } = useAuth();
  const { categories: categoryList } = useCategories();
  const { stores, addPlaceRequest, deleteStore } = useStores();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [locationGranted, setLocationGranted] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [inTulkarm, setInTulkarm] = useState<boolean | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tappedCoord, setTappedCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [addPlaceCoord, setAddPlaceCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const bannerAnim = useRef(new Animated.Value(-100)).current;
  const [bannerMessage, setBannerMessage] = useState('');

  // unique categories that have stores
  const categories = Array.from(new Set(stores.map((s) => s.category)));

  // stores filtered by selected category, sorted by distance
  const categoryStores: (Store & { distance: number | null })[] = stores
    .filter((s) => s.category === selectedCategory)
    .map((s) => ({
      ...s,
      distance: userLocation
        ? haversineDistance(
            userLocation.latitude, userLocation.longitude,
            s.latitude, s.longitude
          )
        : null,
    }))
    .sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

  useEffect(() => {
    setupLocation();
  }, []);

  const setupLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      const isWeb = Platform.OS === 'web';
      Alert.alert(
        'السماح بالوصول للموقع',
        isWeb
          ? 'يرجى السماح بالموقع من إعدادات المتصفح (أيقونة القفل بجانب الرابط) لإظهار موقعك والأماكن القريبة.'
          : 'نحتاج إذن الموقع لإظهار موقعك على الخريطة وإظهار الأماكن القريبة منك في طولكرم.',
        isWeb
          ? [{ text: 'حسناً' }]
          : [
              { text: 'إلغاء', style: 'cancel' },
              { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() },
            ]
      );
      return;
    }

    setLocationGranted(true);
    await startGeofencing();

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const { latitude, longitude } = location.coords;
    setUserLocation({ latitude, longitude });
    setInTulkarm(isInsideTulkarm(latitude, longitude));

    mapRef.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      800
    );

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
      (loc) => {
        const { latitude: lat, longitude: lng } = loc.coords;
        setUserLocation({ latitude: lat, longitude: lng });
        const nowInside = isInsideTulkarm(lat, lng);
        setInTulkarm((prev) => {
          if (prev === null) return nowInside;
          if (prev !== nowInside) {
            showBanner(nowInside ? '🌟 مرحباً في طولكرم!' : '👋 رافقتك السلامة!');
          }
          return nowInside;
        });
      }
    );
  };

  const showBanner = (message: string) => {
    setBannerMessage(message);
    Animated.sequence([
      Animated.spring(bannerAnim, { toValue: 0, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.spring(bannerAnim, { toValue: -100, useNativeDriver: true }),
    ]).start();
  };

  const centerOnTulkarm = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: TULKARM_REGION.latitude,
        longitude: TULKARM_REGION.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      },
      800
    );
  };

  const NEAR_STORE_METERS = 2; // الحد الأدنى بين المتاجر:2 أمتار

  const handleMapPress = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      if (!isInsideTulkarm(latitude, longitude)) return;
      const nearStore = stores.some(
        (s) => haversineDistance(latitude, longitude, s.latitude, s.longitude) < NEAR_STORE_METERS
      );
      if (!nearStore) {
        setTappedCoord({ latitude, longitude });
      }
    },
    [stores]
  );

  const handleNavigateToArea = () => {
    if (!tappedCoord) return;
    const url = `https://www.google.com/maps?q=${tappedCoord.latitude},${tappedCoord.longitude}`;
    Linking.openURL(url);
    setTappedCoord(null);
  };

  const handleCategoryPress = useCallback(
    (cat: string) => {
      setSelectedCategory(cat);
      // highlight markers on map — zoom to category area
      const catStores = stores.filter((s) => s.category === cat);
      if (catStores.length > 0 && mapRef.current) {
        const lats = catStores.map((s) => s.latitude);
        const lngs = catStores.map((s) => s.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        mapRef.current.animateToRegion(
          {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(maxLat - minLat + 0.01, 0.02),
            longitudeDelta: Math.max(maxLng - minLng + 0.01, 0.02),
          },
          600
        );
      }
    },
    [stores]
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const renderCategoryStoreItem = ({
    item,
  }: {
    item: Store & { distance: number | null };
  }) => (
    <TouchableOpacity
      style={styles.catStoreItem}
      onPress={() => {
        setSelectedCategory(null);
        setSelectedStore(item);
        mapRef.current?.animateToRegion(
          {
            latitude: item.latitude,
            longitude: item.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          600
        );
      }}
    >
      <View style={styles.catStoreLeft}>
        <View
          style={[
            styles.catStoreDistanceBadge,
            {
              backgroundColor: item.distance !== null && item.distance < 500
                ? '#DCFCE7'
                : '#EBF5FB',
            },
          ]}
        >
          <Text
            style={[
              styles.catStoreDistanceText,
              {
                color: item.distance !== null && item.distance < 500
                  ? '#16A34A'
                  : '#2E86AB',
              },
            ]}
          >
            {item.distance !== null ? formatDistance(item.distance) : '—'}
          </Text>
        </View>
      </View>
      <View style={styles.catStoreInfo}>
        <Text style={styles.catStoreName}>{item.name}</Text>
        <Text style={styles.catStoreDesc} numberOfLines={1}>
          {item.description}
        </Text>
        {item.phone ? (
          <Text style={styles.catStorePhone}>📞 {item.phone}</Text>
        ) : null}
      </View>
      <Text style={styles.catStoreEmoji}>
        {getCategoryStyle(categoryList, item.category).emoji}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE_NO_POI}
        onPress={handleMapPress}
        initialRegion={{
          latitude: TULKARM_REGION.latitude,
          longitude: TULKARM_REGION.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        showsUserLocation={locationGranted}
        showsMyLocationButton={false}
        showsCompass
      >
        <Circle
          center={{
            latitude: TULKARM_REGION.latitude,
            longitude: TULKARM_REGION.longitude,
          }}
          radius={TULKARM_REGION.radius}
          fillColor="rgba(46, 134, 171, 0.08)"
          strokeColor="rgba(46, 134, 171, 0.4)"
          strokeWidth={2}
        />

        {stores.map((store) => {
          const isActive =
            selectedCategory === null || store.category === selectedCategory;
          return (
            <Marker
              key={store.id}
              coordinate={{ latitude: store.latitude, longitude: store.longitude }}
              title={store.name}
              description={store.description}
              onPress={() => setSelectedStore(store)}
              icon={{
                emoji: getCategoryStyle(categoryList, store.category).emoji,
                color: getCategoryStyle(categoryList, store.category).color,
                opacity: isActive ? 1 : 0.35,
                scale: isActive ? 1 : 0.8,
              }}
            >
              <View
                style={[
                  styles.markerContainer,
                  {
                    backgroundColor:
                      getCategoryStyle(categoryList, store.category).color,
                    opacity: isActive ? 1 : 0.35,
                    transform: [{ scale: isActive ? 1 : 0.8 }],
                  },
                ]}
              >
                <Text style={styles.markerEmoji}>
                  {getCategoryStyle(categoryList, store.category).emoji}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Enter/Exit Banner */}
      <Animated.View
        style={[styles.banner, { transform: [{ translateY: bannerAnim }] }]}
      >
        <Text style={styles.bannerText}>{bannerMessage}</Text>
      </Animated.View>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setShowSidebar(true)}
        >
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>

        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: inTulkarm ? '#10B981' : '#EF4444' },
            ]}
          />
          <Text style={styles.statusText}>
            {inTulkarm === null
              ? 'جارٍ التحديد...'
              : inTulkarm
              ? 'داخل طولكرم'
              : 'خارج طولكرم'}
          </Text>
        </View>

        {user?.isAdmin ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/(main)/admin')}
          >
            <Text style={styles.menuIcon}>⚙️</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {/* Center Button */}
      <TouchableOpacity style={styles.centerBtn} onPress={centerOnTulkarm}>
        <Text style={styles.centerBtnText}>🎯</Text>
      </TouchableOpacity>

      {/* Tap options: Add place / Navigate */}
      <Modal visible={!!tappedCoord} transparent animationType="slide">
        <TouchableOpacity style={styles.sheetOverlay} onPress={() => setTappedCoord(null)} />
        <View style={styles.tapOptionsSheet}>
          <View style={styles.tapOptionsHandle} />
          <Text style={styles.tapOptionsTitle}>مكان فارغ</Text>
          <TouchableOpacity
            style={styles.tapOptionBtn}
            onPress={() => {
              if (tappedCoord) setAddPlaceCoord(tappedCoord);
              setTappedCoord(null);
            }}
          >
            <Text style={styles.tapOptionBtnText}>➕ إضافة مكان</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tapOptionBtn, styles.tapOptionBtnSecondary]}
            onPress={handleNavigateToArea}
          >
            <Text style={styles.tapOptionBtnTextSecondary}>🧭 التوجه إلى هذه المنطقة</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tapOptionCancel} onPress={() => setTappedCoord(null)}>
            <Text style={styles.tapOptionCancelText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {addPlaceCoord && (
        <AddPlaceModal
          visible={!!addPlaceCoord}
          onClose={() => setAddPlaceCoord(null)}
          onSubmit={async (data) => {
            await addPlaceRequest(data);
            setAddPlaceCoord(null);
          }}
          latitude={addPlaceCoord.latitude}
          longitude={addPlaceCoord.longitude}
        />
      )}

      {/* ── Category Bar (Bottom) ── */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBarContent}
        >
          {categories.map((cat) => {
            const count = stores.filter((s) => s.category === cat).length;
            const active = selectedCategory === cat;
            const color = getCategoryStyle(categoryList, cat).color;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  active && { backgroundColor: color, borderColor: color },
                ]}
                onPress={() =>
                  selectedCategory === cat
                    ? setSelectedCategory(null)
                    : handleCategoryPress(cat)
                }
              >
                <Text style={styles.categoryChipEmoji}>
                  {getCategoryStyle(categoryList, cat).emoji}
                </Text>
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
                    active
                      ? styles.categoryChipBadgeActive
                      : { backgroundColor: color + '22' },
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

      {/* ── Category Bottom Sheet ── */}
      <Modal
        visible={!!selectedCategory}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCategory(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          onPress={() => setSelectedCategory(null)}
        />
        <View style={styles.sheet}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Sheet Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              style={styles.sheetCloseBtn}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={styles.sheetCloseBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitleEmoji}>
                {getCategoryStyle(categoryList, selectedCategory ?? '').emoji}
              </Text>
              <View>
                <Text style={styles.sheetTitle}>{selectedCategory}</Text>
                <Text style={styles.sheetSubtitle}>
                  {categoryStores.length} مكان
                  {userLocation ? ' · مرتّب حسب المسافة' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Sheet List */}
          {categoryStores.length === 0 ? (
            <View style={styles.sheetEmpty}>
              <Text style={styles.sheetEmptyText}>
                لا توجد أماكن في هذه الفئة بعد
              </Text>
            </View>
          ) : (
            <FlatList
              data={categoryStores}
              keyExtractor={(item) => item.id}
              renderItem={renderCategoryStoreItem}
              contentContainerStyle={styles.sheetList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modal>

      {/* Sidebar Drawer */}
      <Modal visible={showSidebar} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setShowSidebar(false)}
        />
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0) || 'م'}
              </Text>
            </View>
            <Text style={styles.sidebarName}>{user?.name}</Text>
            <Text style={styles.sidebarEmail}>{user?.id === 'guest' ? 'دخول كضيف' : user?.email}</Text>
            {user?.isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>مدير النظام 👑</Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.sidebarList}>
            <Text style={styles.sidebarSectionTitle}>
              الفئات ({categories.length})
            </Text>
            {categories.map((cat) => {
              const catCount = stores.filter((s) => s.category === cat).length;
              return (
                <TouchableOpacity
                  key={cat}
                  style={styles.sidebarCatItem}
                  onPress={() => {
                    setShowSidebar(false);
                    handleCategoryPress(cat);
                  }}
                >
                  <View
                    style={[
                      styles.sidebarCatCount,
                      { backgroundColor: (getCategoryStyle(categoryList, cat).color) + '22' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarCatCountText,
                        { color: getCategoryStyle(categoryList, cat).color },
                      ]}
                    >
                      {catCount}
                    </Text>
                  </View>
                  <View style={styles.sidebarCatInfo}>
                    <Text style={styles.sidebarCatName}>{cat}</Text>
                  </View>
                  <Text style={styles.sidebarCatEmoji}>
                    {getCategoryStyle(categoryList, cat).emoji}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {user?.isAdmin && (
            <TouchableOpacity
              style={styles.sidebarAdminBtn}
              onPress={() => {
                setShowSidebar(false);
                router.push('/(main)/admin');
              }}
            >
              <Text style={styles.sidebarAdminBtnText}>⚙️ لوحة الإدارة</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>🚪 تسجيل الخروج</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Store Detail Modal */}
      <Modal visible={!!selectedStore} transparent animationType="slide">
        <TouchableOpacity
          style={styles.storeModalOverlay}
          onPress={() => setSelectedStore(null)}
        />
        {selectedStore && (
          <View style={styles.storeModal}>
            <View
              style={[
                styles.storeModalHeader,
                {
                  backgroundColor:
                    getCategoryStyle(categoryList, selectedStore.category).color,
                },
              ]}
            >
              <Text style={styles.storeModalEmoji}>
                {getCategoryStyle(categoryList, selectedStore.category).emoji}
              </Text>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setSelectedStore(null)}
              >
                <Text style={styles.closeModalBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.storeModalBody}>
              <Text style={styles.storeModalName}>{selectedStore.name}</Text>
              <View style={styles.storeModalRow}>
                <View style={styles.storeModalCategoryPill}>
                  <Text style={styles.storeModalCategoryText}>
                    {selectedStore.category}
                  </Text>
                </View>
                {userLocation && (
                  <View style={styles.storeModalDistancePill}>
                    <Text style={styles.storeModalDistanceText}>
                      📍{' '}
                      {formatDistance(
                        haversineDistance(
                          userLocation.latitude,
                          userLocation.longitude,
                          selectedStore.latitude,
                          selectedStore.longitude
                        )
                      )}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.storeModalDescription}>
                {selectedStore.description}
              </Text>
              {selectedStore.phone && (
                <Text style={styles.storeModalPhone}>
                  📞 {selectedStore.phone}
                </Text>
              )}
              {USE_API && (
                <TouchableOpacity
                  style={styles.storeModalReportBtn}
                  onPress={() => setShowReportModal(true)}
                >
                  <Text style={styles.storeModalReportBtnText}>⚠️ الإبلاغ عن هذا المكان</Text>
                </TouchableOpacity>
              )}
              {user?.isAdmin && (
                <View style={styles.storeModalActions}>
                  <TouchableOpacity
                    style={styles.storeModalEditBtn}
                    onPress={() => {
                      setSelectedStore(null);
                      router.push({
                        pathname: '/(main)/admin-stores',
                        params: { editStoreId: selectedStore.id },
                      });
                    }}
                  >
                    <Text style={styles.storeModalEditBtnText}>✏️ تعديل البيانات</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.storeModalDeleteBtn}
                    onPress={() => {
                      Alert.alert(
                        'حذف المتجر',
                        `هل أنت متأكد من حذف "${selectedStore.name}"؟`,
                        [
                          { text: 'إلغاء', style: 'cancel' },
                          {
                            text: 'حذف',
                            style: 'destructive',
                            onPress: async () => {
                              await deleteStore(selectedStore.id);
                              setSelectedStore(null);
                              Alert.alert('تم', 'تم حذف المتجر');
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.storeModalDeleteBtnText}>🗑️ حذف المتجر</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
      </Modal>

      {selectedStore && (
        <ReportModal
          visible={showReportModal}
          storeId={selectedStore.id}
          storeName={selectedStore.name}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'web' && { minHeight: '100vh' }),
  },
  map: {
    flex: 1,
    ...(Platform.OS === 'web' && { minHeight: '100%' }),
  },

  banner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: '#2E86AB',
    paddingVertical: 14, paddingHorizontal: 20,
    alignItems: 'center', zIndex: 100,
    ...shadow({ offset: { width: 0, height: 3 }, opacity: 0.2, radius: 6, elevation: 8 }),
  },
  bannerText: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },

  topBar: {
    position: 'absolute',
    top: LAYOUT.headerTop,
    left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.15, radius: 6, elevation: 4 }),
  },
  menuIcon: { fontSize: 22, color: '#1A3A5C' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.15, radius: 6, elevation: 4 }),
  },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 6 },
  statusText: { fontSize: 13, color: '#1A3A5C', fontWeight: '600' },

  centerBtn: {
    position: 'absolute', bottom: 110, right: 14,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.15, radius: 6, elevation: 4 }),
  },
  centerBtnText: { fontSize: 22 },

  markerContainer: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.3, radius: 4, elevation: 4 }),
    borderWidth: 2, borderColor: '#fff',
  },
  markerEmoji: { fontSize: 18 },

  // ── Category Bar ──
  categoryBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingBottom: LAYOUT.categoryBarPaddingBottom,
    ...shadow({ offset: { width: 0, height: -3 }, opacity: 0.1, radius: 8, elevation: 10 }),
  },
  categoryBarContent: { paddingHorizontal: 14, gap: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 22, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
    gap: 6,
  },
  categoryChipEmoji: { fontSize: 17 },
  categoryChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  categoryChipTextActive: { color: '#fff' },
  categoryChipBadge: {
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  categoryChipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  categoryChipBadgeText: { fontSize: 12, fontWeight: '700' },

  // ── Category Bottom Sheet ──
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  tapOptionsSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    ...shadow({ offset: { width: 0, height: -4 }, opacity: 0.15, radius: 12, elevation: 20 }),
  },
  tapOptionsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  tapOptionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3A5C',
    textAlign: 'center',
    marginBottom: 16,
  },
  tapOptionBtn: {
    backgroundColor: '#2E86AB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  tapOptionBtnSecondary: {
    backgroundColor: '#F3F4F6',
  },
  tapOptionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tapOptionBtnTextSecondary: { color: '#1A3A5C', fontSize: 16, fontWeight: '600' },
  tapOptionCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  tapOptionCancelText: { color: '#6B7280', fontSize: 14 },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '65%',
    ...shadow({ offset: { width: 0, height: -4 }, opacity: 0.15, radius: 12, elevation: 20 }),
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginTop: 10,
  },
  sheetHeader: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    flexDirection: 'row', alignItems: 'center',
  },
  sheetCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
  },
  sheetCloseBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '700' },
  sheetTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  sheetTitleEmoji: { fontSize: 30 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1A3A5C', textAlign: 'right' },
  sheetSubtitle: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  sheetEmpty: { padding: 40, alignItems: 'center' },
  sheetEmptyText: { color: '#9CA3AF', fontSize: 15 },
  sheetList: { padding: 16, paddingBottom: 30 },

  catStoreItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14,
    padding: 14, marginBottom: 10,
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4, elevation: 2 }),
  },
  catStoreLeft: { marginLeft: 12 },
  catStoreDistanceBadge: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    minWidth: 60, alignItems: 'center',
  },
  catStoreDistanceText: { fontSize: 13, fontWeight: '700' },
  catStoreInfo: { flex: 1, alignItems: 'flex-end' },
  catStoreName: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  catStoreDesc: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 3 },
  catStorePhone: { fontSize: 12, color: '#4A7FA5', marginTop: 3 },
  catStoreEmoji: { fontSize: 26, marginLeft: 14 },

  // Sidebar
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sidebar: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: '80%',
    backgroundColor: '#fff',
    ...shadow({ offset: { width: -4, height: 0 }, opacity: 0.2, radius: 12, elevation: 20 }),
  },
  sidebarHeader: {
    backgroundColor: '#2E86AB', padding: 24,
    paddingTop: LAYOUT.sidebarHeaderTop, alignItems: 'center',
  },
  avatarCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarText: { fontSize: 26, color: '#fff', fontWeight: '700' },
  sidebarName: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sidebarEmail: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2, textAlign: 'center' },
  adminBadge: {
    backgroundColor: '#F59E0B', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 8,
  },
  adminBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sidebarList: { flex: 1, padding: 16 },
  sidebarSectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#1A3A5C',
    textAlign: 'right', marginBottom: 12,
  },
  sidebarCatItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 12,
    padding: 12, marginBottom: 8,
  },
  sidebarCatEmoji: { fontSize: 22, marginLeft: 4 },
  sidebarCatInfo: { flex: 1, alignItems: 'flex-end', marginRight: 4 },
  sidebarCatName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  sidebarCatCount: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    minWidth: 32, alignItems: 'center',
  },
  sidebarCatCountText: { fontSize: 13, fontWeight: '700' },
  sidebarAdminBtn: {
    margin: 16, marginBottom: 8,
    backgroundColor: '#1A3A5C', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  sidebarAdminBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  logoutBtn: {
    margin: 16, marginTop: 8,
    backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  logoutBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },

  // Store Detail
  storeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  storeModal: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    ...shadow({ offset: { width: 0, height: -4 }, opacity: 0.15, radius: 12, elevation: 20 }),
  },
  storeModalHeader: {
    height: 90, alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  storeModalEmoji: { fontSize: 44 },
  closeModalBtn: {
    position: 'absolute', top: 12, left: 16,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeModalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  storeModalBody: { padding: 20, alignItems: 'flex-end' },
  storeModalName: {
    fontSize: 20, fontWeight: '800', color: '#1A3A5C',
    textAlign: 'right', marginBottom: 10,
  },
  storeModalRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  storeModalCategoryPill: {
    backgroundColor: '#EBF5FB', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  storeModalCategoryText: { color: '#2E86AB', fontSize: 13, fontWeight: '600' },
  storeModalDistancePill: {
    backgroundColor: '#DCFCE7', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  storeModalDistanceText: { color: '#16A34A', fontSize: 13, fontWeight: '700' },
  storeModalDescription: {
    fontSize: 14, color: '#4B5563', textAlign: 'right',
    lineHeight: 22, marginBottom: 10,
  },
  storeModalPhone: { fontSize: 14, color: '#374151', fontWeight: '600' },
  storeModalActions: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch', justifyContent: 'flex-start' },
  storeModalReportBtn: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  storeModalReportBtnText: { color: '#B45309', fontSize: 14, fontWeight: '700' },
  storeModalEditBtn: {
    flex: 1, backgroundColor: '#2E86AB', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  storeModalEditBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  storeModalDeleteBtn: {
    flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  storeModalDeleteBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
});
