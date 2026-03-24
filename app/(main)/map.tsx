import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AddPlaceModal } from '../../components/AddPlaceModal';
import { ReportModal } from '../../components/ReportModal';
import { Circle, MapView, Marker, Polyline, PROVIDER_GOOGLE } from '../../components/MapWrapper';
import { LAYOUT } from '../../constants/layout';
import { MAP_STYLE_NO_POI } from '../../constants/mapStyle';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoryContext';
import { Store, useStores } from '../../context/StoreContext';
import { isInsideTulkarm, startGeofencing, TULKARM_REGION } from '../../utils/geofencing';
import { shadow } from '../../utils/shadowStyles';

function getCategoryStyle(categories: { name: string; emoji: string; color: string }[], name: string) {
  const c = categories.find((x) => x.name === name);
  return { emoji: c?.emoji ?? '📍', color: c?.color ?? '#2E86AB' };
}

async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidPlaceTypeId(id: string): boolean {
  return typeof id === 'string' && UUID_RE.test(id.trim());
}

function StoreServicesSheet({ store, user, onClose }: { store: Store; user: any; onClose: () => void }) {
  const [services, setServices] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [cart, setCart] = React.useState<Record<string, number>>({});
  const [ordering, setOrdering] = React.useState(false);

  React.useEffect(() => {
    loadData();
  }, [store.id]);

  const loadData = async () => {
    try {
      const [svcRes, prodRes] = await Promise.all([
        api.getStoreServices(store.id),
        api.getStoreProducts(store.id),
      ]);
      setServices(svcRes.data || []);
      setProducts(prodRes.data || []);
    } catch {
      setServices([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (productId: string) => {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      if (next[productId] > 1) next[productId]--;
      else delete next[productId];
      return next;
    });
  };

  const cartTotal = products
    .filter((p: any) => cart[p.id])
    .reduce((sum: number, p: any) => sum + parseFloat(p.price) * cart[p.id], 0);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const handleOrder = async () => {
    if (user?.id === 'guest' || !user) {
      Alert.alert('تنبيه', 'يجب تسجيل الدخول لإتمام الطلب');
      return;
    }
    setOrdering(true);
    try {
      const items = Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }));
      const res = await api.createOrder({ store_id: store.id, items });
      const order = res.data;
      Alert.alert('تم الطلب بنجاح', `رقم الطلب: ${order.id.slice(0, 8)}\nالمجموع: ${parseFloat(order.total).toFixed(2)} ₪`);
      setCart({});
    } catch (err: any) {
      Alert.alert('خطأ', err.message);
    } finally {
      setOrdering(false);
    }
  };

  return (
    <View style={styles.servicesModal}>
      <View style={styles.servicesModalHeader}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.servicesModalCloseText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.servicesModalTitle}>🛍️ {store.name}</Text>
      </View>
      <ScrollView style={styles.servicesModalBody}>
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#9CA3AF' }}>جارٍ التحميل...</Text>
          </View>
        ) : (
          <>
            {store.description ? (
              <View style={styles.servicesItem}>
                <Text style={styles.servicesItemIcon}>📋</Text>
                <Text style={styles.servicesItemText}>{store.description}</Text>
              </View>
            ) : null}
            {store.phone ? (
              <TouchableOpacity
                style={styles.servicesItem}
                onPress={() => Linking.openURL(`tel:${store.phone}`)}
              >
                <Text style={styles.servicesItemIcon}>📞</Text>
                <Text style={[styles.servicesItemText, { color: '#2E86AB' }]}>{store.phone}</Text>
              </TouchableOpacity>
            ) : null}

            {services.length > 0 && (
              <>
                <Text style={styles.servicesSectionTitle}>🛎️ الخدمات</Text>
                {services.map((svc: any) => (
                  <View key={svc.id} style={styles.servicesItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.servicesItemText}>{svc.name}</Text>
                      {svc.description && <Text style={{ fontSize: 12, color: '#6B7280' }}>{svc.description}</Text>}
                    </View>
                    {svc.price != null && (
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#10B981' }}>{svc.price} ₪</Text>
                    )}
                  </View>
                ))}
              </>
            )}

            {products.length > 0 && (
              <>
                <Text style={styles.servicesSectionTitle}>📦 المنتجات</Text>
                {products.map((prod: any) => (
                  <View key={prod.id} style={styles.servicesItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.servicesItemText}>{prod.name}</Text>
                      {prod.description && <Text style={{ fontSize: 12, color: '#6B7280' }}>{prod.description}</Text>}
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#10B981', marginTop: 4 }}>{prod.price} ₪</Text>
                    </View>
                    {user?.id !== 'guest' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {cart[prod.id] ? (
                          <>
                            <TouchableOpacity
                              onPress={() => removeFromCart(prod.id)}
                              style={{ backgroundColor: '#FEE2E2', borderRadius: 8, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Text style={{ fontSize: 16, color: '#EF4444' }}>-</Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 16, fontWeight: '700', minWidth: 20, textAlign: 'center' }}>{cart[prod.id]}</Text>
                          </>
                        ) : null}
                        <TouchableOpacity
                          onPress={() => addToCart(prod.id)}
                          style={{ backgroundColor: '#DCFCE7', borderRadius: 8, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ fontSize: 16, color: '#16A34A' }}>+</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}

            {services.length === 0 && products.length === 0 && !store.description && !store.phone && (
              <View style={styles.servicesEmpty}>
                <Text style={styles.servicesEmptyText}>لا توجد خدمات أو منتجات مسجلة حالياً</Text>
              </View>
            )}

            {user?.id === 'guest' && products.length > 0 && (
              <Text style={[styles.guestHint, { marginTop: 16 }]}>سجّل دخولك لتتمكن من الشراء</Text>
            )}
          </>
        )}
      </ScrollView>

      {cartCount > 0 && (
        <View style={styles.cartBar}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              🛒 {cartCount} منتج · {cartTotal.toFixed(2)} ₪
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={handleOrder}
            disabled={ordering}
          >
            {ordering ? (
              <Text style={styles.cartBtnText}>جاري...</Text>
            ) : (
              <Text style={styles.cartBtnText}>إتمام الطلب</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Store Detail Sheet ────────────────────────────────────────────────────────
function StoreDetailSheet({
  store, userLocation, user, categoryList,
  onClose, onNavigate, onReport, onServices, onEdit, onDelete,
}: {
  store: Store;
  userLocation: { latitude: number; longitude: number } | null;
  user: any;
  categoryList: { name: string; emoji: string; color: string }[];
  onClose: () => void;
  onNavigate: () => void;
  onReport: () => void;
  onServices: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const catStyle = getCategoryStyle(categoryList, store.category);
  const dist = userLocation
    ? haversineDistance(userLocation.latitude, userLocation.longitude, store.latitude, store.longitude)
    : null;

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      <TouchableOpacity style={styles.overlayBackdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.storeModal}>
        <View style={styles.storeModalHandle} />
        <View style={styles.storeModalHeader}>
          <TouchableOpacity style={styles.closeModalBtn} onPress={onClose}>
            <Text style={styles.closeModalBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={[styles.storeModalEmojiCircle, { backgroundColor: catStyle.color + '20' }]}>
            <Text style={styles.storeModalEmoji}>{catStyle.emoji}</Text>
          </View>
        </View>
        <View style={styles.storeModalBody}>
          <Text style={styles.storeModalName}>{store.name}</Text>
          <View style={styles.storeModalPillsRow}>
            <View style={[styles.storeModalCategoryPill, { backgroundColor: catStyle.color + '18' }]}>
              <Text style={[styles.storeModalCategoryText, { color: catStyle.color }]}>{store.category}</Text>
            </View>
            {dist !== null && (
              <View style={styles.storeModalDistancePill}>
                <Text style={styles.storeModalDistanceText}>{formatDistance(dist)}</Text>
              </View>
            )}
          </View>
          {store.description ? (
            <Text style={styles.storeModalDescription}>{store.description}</Text>
          ) : null}
          {store.phone && (
            <TouchableOpacity style={styles.storeModalPhoneRow} onPress={() => Linking.openURL(`tel:${store.phone}`)}>
              <Text style={styles.storeModalPhoneIcon}>📞</Text>
              <Text style={styles.storeModalPhoneText}>{store.phone}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.storeModalBtnRow}>
            <TouchableOpacity
              style={[styles.storeModalActionBtn, styles.storeModalNavigateBtn]}
              onPress={onNavigate}
              disabled={!userLocation}
            >
              <Text style={styles.storeModalNavigateBtnIcon}>🧭</Text>
              <Text style={styles.storeModalNavigateBtnText}>الانتقال إلى المكان</Text>
              {dist !== null && (
                <Text style={styles.storeModalNavigateBtnSub}>يبعد {formatDistance(dist)}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.storeModalActionBtn, styles.storeModalServicesBtn]} onPress={onServices}>
              <Text style={styles.storeModalServicesBtnIcon}>🛍️</Text>
              <Text style={styles.storeModalServicesBtnText}>خدمات المتجر</Text>
            </TouchableOpacity>
          </View>
          {user?.id !== 'guest' && (
            <TouchableOpacity style={styles.storeModalReportBtn} onPress={onReport}>
              <Text style={styles.storeModalReportBtnText}>⚠️ الإبلاغ عن هذا المكان</Text>
            </TouchableOpacity>
          )}
          {user?.isAdmin && (
            <View style={styles.storeModalAdminRow}>
              <TouchableOpacity style={styles.storeModalEditBtn} onPress={onEdit}>
                <Text style={styles.storeModalEditBtnText}>✏️ تعديل</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.storeModalDeleteBtn}
                onPress={() => {
                  Alert.alert('حذف المتجر', `هل أنت متأكد من حذف "${store.name}"؟`, [
                    { text: 'إلغاء', style: 'cancel' },
                    { text: 'حذف', style: 'destructive', onPress: onDelete },
                  ]);
                }}
              >
                <Text style={styles.storeModalDeleteBtnText}>🗑️ حذف</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MapScreen() {
  const { user, logout } = useAuth();
  const { categories: categoryList } = useCategories();
  const { stores: allStores, deleteStore, refreshStores } = useStores();
  /** يظهر على الخريطة فقط ما وافق عليه المدير — لا pending ولا rejected ولا صفوف بلا status صريح */
  const stores = allStores.filter(
    (s) => String(s.status || '').toLowerCase() === 'active'
  );
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
  const [routePath, setRoutePath] = useState<{ latitude: number; longitude: number }[] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [showServicesModal, setShowServicesModal] = useState(false);

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

  const fetchRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ) => {
    try {
      const apiKey = process?.env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=walking&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes?.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];
          const points = decodePolyline(route.overview_polyline.points);
          setRoutePath(points);
          setRouteInfo({
            distance: leg.distance.text,
            duration: leg.duration.text,
          });
          return;
        }
      }
    } catch {
      // fallback to straight line
    }
    setRoutePath([origin, destination]);
    const dist = haversineDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
    const walkMinutes = Math.round(dist / 80);
    setRouteInfo({
      distance: formatDistance(dist),
      duration: `${walkMinutes} دقيقة مشي`,
    });
  };

  const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lat += result & 1 ? ~(result >> 1) : result >> 1;
      shift = 0;
      result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lng += result & 1 ? ~(result >> 1) : result >> 1;
      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };

  const handleNavigateToStore = () => {
    if (!selectedStore || !userLocation) return;
    const destination = { latitude: selectedStore.latitude, longitude: selectedStore.longitude };
    fetchRoute(userLocation, destination);
    setSelectedStore(null);
    mapRef.current?.animateToRegion(
      {
        latitude: (userLocation.latitude + destination.latitude) / 2,
        longitude: (userLocation.longitude + destination.longitude) / 2,
        latitudeDelta: Math.abs(userLocation.latitude - destination.latitude) * 2.5 + 0.005,
        longitudeDelta: Math.abs(userLocation.longitude - destination.longitude) * 2.5 + 0.005,
      },
      800
    );
  };

  const clearRoute = () => {
    setRoutePath(null);
    setRouteInfo(null);
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

        {routePath && routePath.length >= 2 && (
          <Polyline
            coordinates={routePath}
            strokeColor="#2E86AB"
            strokeWidth={4}
          />
        )}

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

      {/* Route Info Banner */}
      {routeInfo && (
        <View style={styles.routeBanner}>
          <View style={styles.routeBannerContent}>
            <View style={styles.routeBannerInfo}>
              <Text style={styles.routeBannerDistance}>📍 {routeInfo.distance}</Text>
              <Text style={styles.routeBannerDuration}>🚶 {routeInfo.duration}</Text>
            </View>
            <TouchableOpacity style={styles.routeBannerClose} onPress={clearRoute}>
              <Text style={styles.routeBannerCloseText}>✕ إنهاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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

      {/* Tap options: Add place / Navigate — rendered directly (no Modal) for web+mobile */}
      {tappedCoord && (
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.overlayBackdrop}
            onPress={() => setTappedCoord(null)}
            activeOpacity={1}
          />
          <View style={styles.tapOptionsSheet}>
            <View style={styles.tapOptionsHandle} />
            <Text style={styles.tapOptionsTitle}>مكان فارغ</Text>
            {user && user.id !== 'guest' ? (
              <TouchableOpacity
                style={styles.tapOptionBtn}
                onPress={() => {
                  setAddPlaceCoord(tappedCoord);
                  setTappedCoord(null);
                }}
              >
                <Text style={styles.tapOptionBtnText}>➕ إضافة مكان</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.guestHint, { marginBottom: 10 }]}>
                سجّل الدخول أو أنشئ حساباً لإرسال طلب إضافة مكان (يُراجع من قبل الإدارة).
              </Text>
            )}
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
        </View>
      )}

      {addPlaceCoord && (
        <AddPlaceModal
          visible={!!addPlaceCoord}
          onClose={() => setAddPlaceCoord(null)}
          submitSuccessTitle="تم إرسال الطلب بنجاح"
          submitSuccessMessage="سنراجع طلبك في أقرب وقت ممكن. كل البيانات أصبحت ضمن «طلبات المتاجر» في لوحة الإدارة. إذا وافق المدير: ينتقل المكان إلى «الأماكن» ويظهر على الخريطة للجميع. إذا رُفض الطلب: يُزال فوراً ولن يُنشر."
          onSubmit={async (data) => {
            if (!isValidPlaceTypeId(data.type_id)) {
              throw new Error(
                'معرّف نوع المكان غير صالح. أغلق النافذة وافتح «إدارة الفئات» من لوحة الإدارة للتأكد من وجود الأنواع ثم أعد المحاولة.'
              );
            }

            const attributes = data.dynamicAttributes || [];

            let imageUrls: string[] = [];
            const uploadErrors: string[] = [];
            if (data.photos?.length) {
              for (const photoUri of data.photos) {
                try {
                  const base64 = await uriToBase64(photoUri);
                  const uploadRes = await api.uploadBase64(base64);
                  const url = uploadRes?.data?.url;
                  if (url && /^https?:\/\//i.test(url)) {
                    imageUrls.push(url);
                  }
                } catch (uploadErr: any) {
                  uploadErrors.push(uploadErr?.message || 'فشل رفع صورة');
                }
              }
              if (imageUrls.length === 0) {
                throw new Error(
                  uploadErrors[0] ||
                    'فشل رفع الصور. تحقق من Cloudinary على السيرفر أو أزل الصور وأعد المحاولة.'
                );
              }
            }

            await api.createPlace({
              name: data.name.trim(),
              description: data.description?.trim() || undefined,
              type_id: data.type_id.trim(),
              latitude: Number(data.latitude),
              longitude: Number(data.longitude),
              attributes: attributes.length ? attributes : undefined,
              image_urls: imageUrls.length ? imageUrls : undefined,
            });

            await refreshStores();
          }}
          latitude={addPlaceCoord.latitude}
          longitude={addPlaceCoord.longitude}
        />
      )}

      {/* ── Category Bar (Bottom) — إخفاؤه عند نافذة إضافة مكان حتى لا يغطي زر الإرسال (elevation + ترتيب الرسم) ── */}
      {!addPlaceCoord && (
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
      )}

      {/* ── Category Bottom Sheet ── */}
      {selectedCategory && (
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.overlayBackdrop}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={1}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
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
            {categoryStores.length === 0 ? (
              <View style={styles.sheetEmpty}>
                <Text style={styles.sheetEmptyText}>لا توجد أماكن في هذه الفئة بعد</Text>
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
        </View>
      )}

      {/* Sidebar Drawer */}
      {showSidebar && (
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.overlayBackdrop}
            onPress={() => setShowSidebar(false)}
            activeOpacity={1}
          />
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'م'}</Text>
              </View>
              <Text style={styles.sidebarName}>{user?.name}</Text>
              <Text style={styles.sidebarEmail}>{user?.id === 'guest' ? 'دخول كضيف' : user?.email}</Text>
              {user?.isAdmin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>مدير النظام 👑</Text>
                </View>
              )}
              {user?.role === 'owner' && !user?.isAdmin && (
                <View style={[styles.adminBadge, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.adminBadgeText}>صاحب متجر 🏪</Text>
                </View>
              )}
            </View>
            <ScrollView style={styles.sidebarList}>
              <Text style={styles.sidebarSectionTitle}>الفئات ({categories.length})</Text>
              {categories.map((cat) => {
                const catCount = stores.filter((s) => s.category === cat).length;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={styles.sidebarCatItem}
                    onPress={() => { setShowSidebar(false); handleCategoryPress(cat); }}
                  >
                    <View style={[styles.sidebarCatCount, { backgroundColor: getCategoryStyle(categoryList, cat).color + '22' }]}>
                      <Text style={[styles.sidebarCatCountText, { color: getCategoryStyle(categoryList, cat).color }]}>{catCount}</Text>
                    </View>
                    <View style={styles.sidebarCatInfo}>
                      <Text style={styles.sidebarCatName}>{cat}</Text>
                    </View>
                    <Text style={styles.sidebarCatEmoji}>{getCategoryStyle(categoryList, cat).emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {(user?.role === 'owner' || user?.isAdmin) && (
              <TouchableOpacity style={styles.sidebarOwnerBtn} onPress={() => { setShowSidebar(false); router.push('/(main)/owner-dashboard'); }}>
                <Text style={styles.sidebarOwnerBtnText}>🏪 لوحة تحكم المتجر</Text>
              </TouchableOpacity>
            )}
            {user?.isAdmin && (
              <TouchableOpacity style={styles.sidebarAdminBtn} onPress={() => { setShowSidebar(false); router.push('/(main)/admin'); }}>
                <Text style={styles.sidebarAdminBtnText}>⚙️ لوحة الإدارة</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>🚪 تسجيل الخروج</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Store Detail Sheet */}
      {selectedStore && (
        <StoreDetailSheet
          store={selectedStore}
          userLocation={userLocation}
          user={user}
          categoryList={categoryList}
          onClose={() => setSelectedStore(null)}
          onNavigate={handleNavigateToStore}
          onReport={() => setShowReportModal(true)}
          onServices={() => setShowServicesModal(true)}
          onEdit={() => {
            setSelectedStore(null);
            router.push({
              pathname: '/(main)/admin-stores',
              params: { editStoreId: selectedStore.id },
            });
          }}
          onDelete={async () => {
            await deleteStore(selectedStore.id);
            setSelectedStore(null);
          }}
        />
      )}

      {/* Services Sheet */}
      {showServicesModal && selectedStore && (
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <TouchableOpacity style={styles.overlayBackdrop} onPress={() => setShowServicesModal(false)} activeOpacity={1} />
          <StoreServicesSheet store={selectedStore} user={user} onClose={() => setShowServicesModal(false)} />
        </View>
      )}

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

  // ── Overlay scaffold: works on web + mobile without Modal ──
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  // ── Category Bottom Sheet ──
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  tapOptionsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    zIndex: 201,
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
    zIndex: 201,
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
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: '80%',
    maxWidth: 340,
    backgroundColor: '#fff',
    zIndex: 201,
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

  // Route Banner
  routeBanner: {
    position: 'absolute',
    top: LAYOUT.headerTop + 56,
    left: 12, right: 12,
    zIndex: 90,
  },
  routeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.15, radius: 8, elevation: 6 }),
  },
  routeBannerInfo: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  routeBannerDistance: { fontSize: 15, fontWeight: '700', color: '#1A3A5C' },
  routeBannerDuration: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  routeBannerClose: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  routeBannerCloseText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },

  // Store Detail
  storeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  storeModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    zIndex: 201,
    ...shadow({ offset: { width: 0, height: -6 }, opacity: 0.18, radius: 16, elevation: 24 }),
  },
  storeModalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  storeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  storeModalEmojiCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  storeModalEmoji: { fontSize: 30 },
  closeModalBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  closeModalBtnText: { color: '#6B7280', fontSize: 16, fontWeight: '700' },
  storeModalBody: { padding: 20, paddingTop: 8, alignItems: 'flex-end' },
  storeModalName: {
    fontSize: 22, fontWeight: '800', color: '#1A3A5C',
    textAlign: 'right', marginBottom: 10,
    alignSelf: 'stretch',
  },
  storeModalPillsRow: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
    flexWrap: 'wrap', justifyContent: 'flex-end',
  },
  storeModalCategoryPill: {
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  storeModalCategoryText: { fontSize: 13, fontWeight: '700' },
  storeModalDistancePill: {
    backgroundColor: '#DCFCE7', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  storeModalDistanceText: { color: '#16A34A', fontSize: 13, fontWeight: '700' },
  storeModalDescription: {
    fontSize: 14, color: '#4B5563', textAlign: 'right',
    lineHeight: 22, marginBottom: 12,
    alignSelf: 'stretch',
  },
  storeModalPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  storeModalPhoneIcon: { fontSize: 18 },
  storeModalPhoneText: { fontSize: 15, fontWeight: '700', color: '#2E86AB' },

  // Action buttons row
  storeModalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
    marginBottom: 14,
  },
  storeModalActionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeModalNavigateBtn: {
    backgroundColor: '#2E86AB',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.2, radius: 6, elevation: 4 }),
  },
  storeModalNavigateBtnIcon: { fontSize: 22, marginBottom: 4 },
  storeModalNavigateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  storeModalNavigateBtnSub: {
    color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', marginTop: 2,
  },
  storeModalServicesBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  storeModalServicesBtnIcon: { fontSize: 22, marginBottom: 4 },
  storeModalServicesBtnText: { color: '#374151', fontSize: 14, fontWeight: '700' },

  storeModalReportBtn: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  storeModalReportBtnText: { color: '#B45309', fontSize: 13, fontWeight: '600' },

  // Admin row
  storeModalAdminRow: {
    flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 8,
  },
  storeModalEditBtn: {
    flex: 1, backgroundColor: '#2E86AB', borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  storeModalEditBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  storeModalDeleteBtn: {
    flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  storeModalDeleteBtnText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },

  // Services Modal
  servicesModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    ...shadow({ offset: { width: 0, height: -6 }, opacity: 0.18, radius: 16, elevation: 24 }),
  },
  servicesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  servicesModalTitle: {
    fontSize: 18, fontWeight: '800', color: '#1A3A5C', textAlign: 'right',
  },
  servicesModalCloseText: {
    fontSize: 18, color: '#6B7280', fontWeight: '700',
  },
  servicesModalBody: { padding: 20 },
  servicesItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  servicesItemIcon: { fontSize: 20 },
  servicesItemText: {
    flex: 1, fontSize: 14, color: '#374151',
    textAlign: 'right', lineHeight: 22,
  },
  servicesEmpty: { padding: 30, alignItems: 'center' },
  servicesEmptyText: { color: '#9CA3AF', fontSize: 15 },
  servicesSectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#1A3A5C',
    textAlign: 'right', marginTop: 16, marginBottom: 10, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  guestHint: {
    textAlign: 'center', color: '#9CA3AF', fontSize: 13,
    marginTop: 8, fontStyle: 'italic',
  },
  sidebarOwnerBtn: {
    backgroundColor: '#10B981', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginHorizontal: 16,
    marginBottom: 8,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.15, radius: 6, elevation: 4 }),
  },
  sidebarOwnerBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2E86AB', padding: 16, paddingBottom: 20,
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
  },
  cartBtn: {
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  cartBtnText: { color: '#2E86AB', fontWeight: '700', fontSize: 15 },
});
