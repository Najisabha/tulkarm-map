import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../../api/client';
import { AddPlaceModal } from '../../components/AddPlaceModal';
import { Circle, MapView, Marker, Polyline, PROVIDER_GOOGLE } from '../../components/MapWrapper';
import { PlaceCard } from '../../components/places/PlaceCard';
import { ComplexBuildingViewer, ComplexUnit } from '../../components/places/ComplexBuildingViewer';
import { PlaceDetails } from '../../components/places/PlaceDetails';
import { ReportModal } from '../../components/ReportModal';
import { LAYOUT } from '../../constants/layout';
import { MAP_STYLE_NO_POI } from '../../constants/mapStyle';
import { useCategories } from '../../context/CategoryContext';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePlacesStore } from '../../stores/usePlacesStore';
import type { Place } from '../../types/place';
import { placeService } from '../../services/placeService';
import { isInsideTulkarm, startGeofencing, TULKARM_REGION } from '../../utils/geofencing';
import {
  CANONICAL_PLACE_TYPE_NAMES,
  getPlaceTypeDisplayName,
  resolveCanonicalPlaceTypeKey,
} from '../../utils/placeTypeLabels';
import { shadow } from '../../utils/shadowStyles';

function getCategoryStyle(categories: { name: string; emoji: string; color: string }[], name: string) {
  const c = categories.find((x) => x.name === name);
  return { emoji: c?.emoji ?? '📍', color: c?.color ?? '#2E86AB' };
}

// Keep the legacy \"Store\" shape that this screen expects, but source data from Domain Place.
export interface Store {
  id: string;
  name: string;
  description: string;
  category: string;
  type_name?: string;
  type_id?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  photos?: string[];
  videos?: string[];
  status?: string;
  avg_rating?: string;
  rating_count?: number;
  attributes?: { key: string; value: string; value_type: string }[];
  images?: { id: string; image_url: string; sort_order: number }[];
  createdAt: string;
}

function placeToStore(p: Place): Store {
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    category: p.typeName,
    type_name: p.typeName,
    type_id: p.typeId,
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    phone: p.phoneNumber || undefined,
    photos: p.images?.map((img) => img.url) || [],
    status: p.status,
    avg_rating: String(p.avgRating ?? '0'),
    rating_count: p.ratingCount ?? 0,
    attributes: p.attributes?.map((a) => ({ key: a.key, value: a.value, value_type: a.valueType })),
    images: p.images?.map((img) => ({ id: img.id, image_url: img.url, sort_order: img.sortOrder })) || [],
    createdAt: p.createdAt,
  };
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

type TravelMode = 'walking' | 'bicycling' | 'driving';

type TravelChoice = 'walking' | 'bike1' | 'bike2' | 'driving';

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

function formatRemainingMeters(meters: number): string {
  return `${Math.max(0, Math.round(meters))} م`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidPlaceTypeId(id: string): boolean {
  return typeof id === 'string' && UUID_RE.test(id.trim());
}

function matchesQuery(store: { name: string; description?: string; category: string; phone?: string }, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const phone = store.phone || '';
  return (
    store.name.toLowerCase().includes(query) ||
    (store.description || '').toLowerCase().includes(query) ||
    (store.category || '').toLowerCase().includes(query) ||
    phone.toLowerCase().includes(query)
  );
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
                      {prod.company_name ? (
                        <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '700', marginTop: 2 }}>
                          🏢 {prod.company_name}
                        </Text>
                      ) : null}
                      {prod.main_category ? (
                        <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '700' }}>
                          📚 {prod.main_category}{prod.sub_category ? ` / ${prod.sub_category}` : ''}
                        </Text>
                      ) : null}
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
  onOpenChildPlace, onAddUnit,
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
  onOpenChildPlace: (childPlaceId: string) => void;
  onAddUnit: (unit: ComplexUnit, store: Store) => void;
}) {
  const catStyle = getCategoryStyle(categoryList, store.category);
  const dist = userLocation
    ? haversineDistance(userLocation.latitude, userLocation.longitude, store.latitude, store.longitude)
    : null;

  const attrs = store.attributes || [];
  const attrRaw = (key: string) => attrs.find((a) => a.key === key)?.value;
  const attr = (key: string) => {
    const raw = attrRaw(key);
    if (!raw) return undefined;
    // Some legacy attributes store JSON like {"v":"059..."} or {"value":"..."}
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const candidate = (parsed as any).v ?? (parsed as any).value ?? (parsed as any).val ?? null;
        if (candidate !== null && candidate !== undefined) return String(candidate);
      }
    } catch {
      // plain string
    }
    return raw;
  };
  const firstAttr = (...keys: string[]) => {
    for (const k of keys) {
      const v = attr(k);
      if (v && String(v).trim()) return String(v).trim();
    }
    return undefined;
  };

  const typeName = store.category;
  const isHouse = typeName === 'منزل';
  const isStoreLike = typeName === 'متجر تجاري' || typeName === 'مجمّع تجاري';
  const isResidentialComplex = typeName === 'مجمّع سكني';
  const isCommercialComplex = typeName === 'مجمّع تجاري';
  const isComplex = isResidentialComplex || isCommercialComplex;

  const locationText = attr('location_text');
  const houseNumber = attr('house_number');
  const storeType = attr('store_type');
  const storeCategory = attr('store_category');
  const storeNumber = attr('store_number');
  const complexNumber = attr('complex_number');
  const floorsCount = attr('floors_count');
  const unitsPerFloor = attr('units_per_floor') ?? attr('houses_per_floor') ?? attr('stores_per_floor');

  const floorsCountNum = floorsCount ? parseInt(String(floorsCount), 10) : 0;
  const unitsPerFloorNum = unitsPerFloor ? parseInt(String(unitsPerFloor), 10) : 0;
  const phoneForCall =
    store.phone ||
    firstAttr('phone', 'phone_number', 'store_number', 'raqm') ||
    null;

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      {/* Prevent the backdrop from stealing clicks on Web/Windows. */}
      <TouchableOpacity style={styles.overlayBackdrop} onPress={onClose} activeOpacity={1} pointerEvents="none" />
      <View style={styles.storeModal} pointerEvents="auto">
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
          <View style={styles.storeModalPillsRow}>
            <View style={[styles.storeModalCategoryPill, { backgroundColor: catStyle.color + '18' }]}>
              <Text style={[styles.storeModalCategoryText, { color: catStyle.color }]}>
                {getPlaceTypeDisplayName(store.category)}
              </Text>
            </View>
            {dist !== null && (
              <View style={styles.storeModalDistancePill}>
                <Text style={styles.storeModalDistanceText}>{formatDistance(dist)}</Text>
              </View>
            )}
          </View>

          <PlaceDetails
            place={{
              id: store.id,
              name: store.name,
              description: store.description || null,
              phoneNumber: store.phone ?? null,
              images:
                store.images?.map((img) => ({ id: img.id, url: img.image_url, sortOrder: img.sort_order })) ?? [],
              location: { latitude: store.latitude, longitude: store.longitude },
              typeId: store.type_id ?? '',
              typeName: store.type_name ?? store.category,
              kind: 'simple',
              status: (store.status as any) ?? 'pending',
              avgRating: parseFloat(store.avg_rating ?? '0'),
              ratingCount: store.rating_count ?? 0,
              createdAt: store.createdAt,
              attributes:
                store.attributes?.map((a) => ({ key: a.key, value: a.value, valueType: a.value_type })) ?? [],
            } as any}
          />

          {isComplex && floorsCountNum > 0 && unitsPerFloorNum > 0 ? (
            <ComplexBuildingViewer
              placeId={store.id}
              complexType={isResidentialComplex ? 'residential' : 'commercial'}
              floorsCount={floorsCountNum}
              unitsPerFloor={unitsPerFloorNum}
              onUnitPress={(unit) => {
                if (unit.child_place_id && unit.child_place_name) {
                  onOpenChildPlace(unit.child_place_id);
                } else {
                  onAddUnit(unit, store);
                }
              }}
            />
          ) : null}

          <View style={styles.storeModalBtnRow}>
            {isHouse && houseNumber ? (
              <TouchableOpacity
                style={styles.storeModalCallBtn}
                onPress={() => Linking.openURL(`tel:${houseNumber}`)}
                activeOpacity={0.86}
              >
                <View style={styles.storeModalCallBtnIconWrap}>
                  <Text style={styles.storeModalCallBtnIcon}>📞</Text>
                </View>
                <Text style={styles.storeModalCallBtnLabel}>اتصال</Text>
                <Text style={styles.storeModalCallBtnText}>{houseNumber}</Text>
              </TouchableOpacity>
            ) : !isHouse && !isStoreLike && phoneForCall ? (
              <TouchableOpacity
                style={styles.storeModalCallBtn}
                onPress={() => Linking.openURL(`tel:${phoneForCall}`)}
                activeOpacity={0.86}
              >
                <View style={styles.storeModalCallBtnIconWrap}>
                  <Text style={styles.storeModalCallBtnIcon}>📞</Text>
                </View>
                <Text style={styles.storeModalCallBtnLabel}>اتصال</Text>
                <Text style={styles.storeModalCallBtnText}>{phoneForCall}</Text>
              </TouchableOpacity>
            ) : null}
            <Pressable
              style={[styles.storeModalActionBtn, styles.storeModalNavigateBtn]}
              onPress={onNavigate}
              disabled={false}
              pointerEvents="auto"
            >
              <Text style={styles.storeModalNavigateBtnIcon}>🧭</Text>
              <Text style={styles.storeModalNavigateBtnText}>الانتقال إلى المكان</Text>
              {dist !== null && (
                <Text style={styles.storeModalNavigateBtnSub}>يبعد {formatDistance(dist)}</Text>
              )}
            </Pressable>
            {isStoreLike && phoneForCall ? (
              <TouchableOpacity
                style={styles.storeModalCallBtn}
                onPress={() => Linking.openURL(`tel:${phoneForCall}`)}
                activeOpacity={0.86}
              >
                <View style={styles.storeModalCallBtnIconWrap}>
                  <Text style={styles.storeModalCallBtnIcon}>📞</Text>
                </View>
                <Text style={styles.storeModalCallBtnLabel}>اتصال</Text>
                <Text style={styles.storeModalCallBtnText}>{phoneForCall}</Text>
              </TouchableOpacity>
            ) : null}
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
  const { user, logout, init } = useAuthStore();
  const { categories: categoryList } = useCategories();
  const { places, deletePlace, refresh, loadAll } = usePlacesStore();
  const stores = useMemo(() => places.map(placeToStore).filter((s) => String(s.status || '').toLowerCase() === 'active'), [places]);
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const defaultRegion = useRef({
    latitude: TULKARM_REGION.latitude,
    longitude: TULKARM_REGION.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }).current;

  const [mapRegionOverride, setMapRegionOverride] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);

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
  const [routeDestination, setRouteDestination] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [travelStep, setTravelStep] = useState<1 | 2 | 3>(1);
  const [travelChoice, setTravelChoice] = useState<TravelChoice | null>(null);
  const [travelPreviewLoading, setTravelPreviewLoading] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);

  const [placeSearchQuery, setPlaceSearchQuery] = useState('');

  const [addUnitContext, setAddUnitContext] = useState<{
    complexPlaceId: string;
    complexType: 'residential' | 'commercial';
    unitRowId: string;
    floorNumber: number;
    unitNumber: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  const bannerAnim = useRef(new Animated.Value(-100)).current;
  const [bannerMessage, setBannerMessage] = useState('');

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const c of categoryList) {
      if (c?.name?.trim()) names.add(c.name.trim());
    }
    for (const s of stores) {
      if (s?.category?.trim()) names.add(s.category.trim());
    }
    const list = [...names];
    const rank = (name: string) => {
      const key = resolveCanonicalPlaceTypeKey(name);
      if (!key) return 1000;
      const idx = (CANONICAL_PLACE_TYPE_NAMES as readonly string[]).indexOf(key);
      return idx >= 0 ? idx : 999;
    };
    list.sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return a.localeCompare(b, 'ar');
    });
    return list;
  }, [categoryList, stores]);

  const placeSearchQ = placeSearchQuery.trim().toLowerCase();
  const placeSearchResults = !placeSearchQ
    ? []
    : stores
        .filter((s) => matchesQuery(s, placeSearchQ))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

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

  // Ensure Zustand auth state is hydrated (login/register may happen via AuthContext screens).
  useEffect(() => {
    void init();
  }, []);

  // Load places into Zustand (and refresh when role changes).
  useEffect(() => {
    void loadAll(user?.role === 'admin' || user?.isAdmin === true);
  }, [user?.role, user?.isAdmin]);

  useEffect(() => {
    if (!selectedStore) return;
    setTravelStep(1);
    setTravelChoice(null);
    setTravelPreviewLoading(false);
  }, [selectedStore?.id]);

  useEffect(() => {
    if (!routeDestination || !userLocation || !routeInfo) return;
    const remainingMeters = haversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      routeDestination.latitude,
      routeDestination.longitude
    );
    setRouteInfo((prev) => (prev ? { ...prev, distance: formatRemainingMeters(remainingMeters) } : prev));
  }, [routeDestination, userLocation]);

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
    setMapRegionOverride({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });

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
    setMapRegionOverride(defaultRegion);
    mapRef.current?.animateToRegion(defaultRegion, 800);
  };

  const zoomToNearbyMe = (radiusMeters = 5) => {
    if (!userLocation) {
      // على الويب: قد يتأخر/يفشل expo-location بينما navigator.geolocation ما يزال متاح.
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setUserLocation(next);
            setInTulkarm(isInsideTulkarm(next.latitude, next.longitude));

                  const PADDING_FACTOR = 6;
            const viewportHalfSpanMeters = radiusMeters * PADDING_FACTOR;

            const metersPerDegLat = 111_320;
            const metersPerDegLon = 111_320 * Math.cos((next.latitude * Math.PI) / 180);

            const latDelta = (2 * viewportHalfSpanMeters) / metersPerDegLat;
            const lonDelta = (2 * viewportHalfSpanMeters) / Math.max(metersPerDegLon, 1e-6);

            const nextRegion = {
              latitude: next.latitude,
              longitude: next.longitude,
              latitudeDelta: Math.max(latDelta, 0.00005),
              longitudeDelta: Math.max(lonDelta, 0.00005),
            };

            setMapRegionOverride(nextRegion);
            mapRef.current?.animateToRegion(nextRegion, 800);
          },
          () => {
            Alert.alert('الموقع غير متاح', 'فعّل خدمة الموقع ليتم التقريب على مكانك.');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
        );
        return;
      }

      Alert.alert('الموقع غير متاح', 'فعّل خدمة الموقع ليتم التقريب على مكانك.');
      return;
    }

    const PADDING_FACTOR = 6;
    const viewportHalfSpanMeters = radiusMeters * PADDING_FACTOR;

    const metersPerDegLat = 111_320;
    const metersPerDegLon = 111_320 * Math.cos((userLocation.latitude * Math.PI) / 180);

    const latDelta = (2 * viewportHalfSpanMeters) / metersPerDegLat;
    const lonDelta = (2 * viewportHalfSpanMeters) / Math.max(metersPerDegLon, 1e-6);

    const nextRegion = {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: Math.max(latDelta, 0.00005),
      longitudeDelta: Math.max(lonDelta, 0.00005),
    };

    setMapRegionOverride(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 800);
  };

  const NEAR_STORE_METERS = 2;

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

  const choiceToApiMode = (choice: TravelChoice): TravelMode => {
    if (choice === 'walking') return 'walking';
    if (choice === 'driving') return 'driving';
    return 'bicycling';
  };

  const getSpeedMPerMin = (choice: TravelChoice): number => {
    switch (choice) {
      case 'walking':
        return 80;
      case 'bike1':
        return 170;
      case 'bike2':
        return 220;
      case 'driving':
        return 450;
    }
  };

  const formatDurationMinutes = (minutes: number) => {
    const m = Math.max(1, Math.round(minutes));
    return `${m} دقيقة`;
  };

  const fetchRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    travelChoice: TravelChoice
  ) => {
    try {
      const apiKey = process?.env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const apiMode = choiceToApiMode(travelChoice);
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=${apiMode}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes?.length > 0) {
          const route = data.routes[0];
          const points = decodePolyline(route.overview_polyline.points);
          setRoutePath(points);
          const remainingMeters = haversineDistance(
            origin.latitude,
            origin.longitude,
            destination.latitude,
            destination.longitude
          );
          const speedMPerMin = getSpeedMPerMin(travelChoice);
          const minutes = remainingMeters / speedMPerMin;
          setRouteInfo({
            distance: formatRemainingMeters(remainingMeters),
            duration: formatDurationMinutes(minutes),
          });
          return;
        }
      }
    } catch {
      // straight line fallback
    }
    setRoutePath([origin, destination]);
    const dist = haversineDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
    const speedMPerMin = getSpeedMPerMin(travelChoice);
    const minutes = dist / speedMPerMin;
    setRouteInfo({
      distance: formatRemainingMeters(dist),
      duration: formatDurationMinutes(minutes),
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

  const ensureUserLocation = async (): Promise<UserLocation | null> => {
    if (userLocation) return userLocation;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const isWeb = Platform.OS === 'web';
        Alert.alert(
          'السماح بالوصول للموقع',
          isWeb ? 'فعّل الموقع في المتصفح للتمكن من حساب المدة.' : 'نحتاج إذن الموقع لحساب المدة.',
          [{ text: 'حسناً' }]
        );
        return null;
      }

      setLocationGranted(true);
      await startGeofencing();

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const origin = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setUserLocation(origin);
      setInTulkarm(isInsideTulkarm(origin.latitude, origin.longitude));

      const nextRegion = { latitude: origin.latitude, longitude: origin.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setMapRegionOverride(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 800);

      return origin;
    } catch {
      Alert.alert('الموقع غير متاح', 'تعذّر جلب موقعك الآن. جرّب مرة أخرى.');
      return null;
    }
  };

  // Compute preview route (line + duration) while user is on step 3.
  useEffect(() => {
    if (travelStep !== 3 || !selectedStore || !travelChoice) return;
    let cancelled = false;

    const run = async () => {
      setTravelPreviewLoading(true);

      const origin = await ensureUserLocation();
      if (cancelled || !origin) {
        setTravelPreviewLoading(false);
        return;
      }

      const destination = { latitude: selectedStore.latitude, longitude: selectedStore.longitude };
      setRouteDestination(destination);
      setRoutePath(null);
      setRouteInfo(null);

      await fetchRoute(origin, destination, travelChoice);

      if (cancelled) {
        clearRoute();
        return;
      }

      mapRef.current?.animateToRegion(
        {
          latitude: (origin.latitude + destination.latitude) / 2,
          longitude: (origin.longitude + destination.longitude) / 2,
          latitudeDelta: Math.abs(origin.latitude - destination.latitude) * 2.5 + 0.005,
          longitudeDelta: Math.abs(origin.longitude - destination.longitude) * 2.5 + 0.005,
        },
        800
      );

      if (!cancelled) setTravelPreviewLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelStep, travelChoice, selectedStore?.id]);

  const startRouteToStore = async (store: Store, travelChoice: TravelChoice, originOverride?: UserLocation) => {
    if (isRouting) return;
    setIsRouting(true);
    setShowSidebar(false);
    setSelectedCategory(null);
    setShowReportModal(false);
    setShowServicesModal(false);

    // Hide store UI immediately after choosing the mode.
    setSelectedStore(null);

    let origin = originOverride ?? userLocation;
    if (!origin) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          const isWeb = Platform.OS === 'web';
          Alert.alert(
            'السماح بالوصول للموقع',
            isWeb ? 'فعّل الموقع في المتصفح للتمكن من حساب المسافة.' : 'نحتاج إذن الموقع لحساب المسافة.',
            [{ text: 'حسناً' }]
          );
          setIsRouting(false);
          return;
        }

        setLocationGranted(true);
        await startGeofencing();

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        origin = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        setUserLocation(origin);
        setInTulkarm(isInsideTulkarm(origin.latitude, origin.longitude));

        const nextRegion = {
          latitude: origin.latitude,
          longitude: origin.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setMapRegionOverride(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 800);
      } catch {
        Alert.alert('الموقع غير متاح', 'تعذّر جلب موقعك الآن. جرّب مرة أخرى.');
        setIsRouting(false);
        return;
      }
    }

    if (!origin) {
      setIsRouting(false);
      return;
    }

    const destination = { latitude: store.latitude, longitude: store.longitude };
    setRoutePath(null);
    setRouteInfo(null);
    setRouteDestination(destination);

    fetchRoute(origin, destination, travelChoice);

    mapRef.current?.animateToRegion(
      {
        latitude: (origin.latitude + destination.latitude) / 2,
        longitude: (origin.longitude + destination.longitude) / 2,
        latitudeDelta: Math.abs(origin.latitude - destination.latitude) * 2.5 + 0.005,
        longitudeDelta: Math.abs(origin.longitude - destination.longitude) * 2.5 + 0.005,
      },
      800
    );
  };

  const handleOpenTravelModePicker = () => {
    if (!selectedStore || isRouting) return;

    setTravelStep(2);
    setTravelChoice(null);
    setTravelPreviewLoading(false);
    setRoutePath(null);
    setRouteDestination(null);
    setRouteInfo(null);
  };

  const clearRoute = () => {
    setRoutePath(null);
    setRouteDestination(null);
    setRouteInfo(null);
    setIsRouting(false);
  };

  const closeTravelFlow = () => {
    setSelectedStore(null);
    setTravelStep(1);
    setTravelChoice(null);
    setTravelPreviewLoading(false);
    setShowServicesModal(false);
    setShowReportModal(false);
    clearRoute();
  };

  const confirmTravel = () => {
    setIsRouting(true);
    setShowSidebar(false);
    setSelectedCategory(null);
    setShowReportModal(false);
    setShowServicesModal(false);

    setTravelStep(1);
    setTravelChoice(null);
    setTravelPreviewLoading(false);
    setSelectedStore(null);
  };

  const travelChoiceToLabel = (choice: TravelChoice) => {
    if (choice === 'walking') return 'مشي على الاقدام';
    if (choice === 'bike1') return 'بسكليت';
    if (choice === 'bike2') return 'دراجة';
    return 'سيارة';
  };

  const TravelModeSheet = () => (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.overlayBackdrop}
        onPress={() => setTravelStep(1)}
        activeOpacity={1}
        pointerEvents="none"
      />
      <View style={styles.storeModal}>
        <View style={styles.storeModalHandle} />
        <View style={styles.storeModalHeader}>
          <TouchableOpacity style={styles.closeModalBtn} onPress={closeTravelFlow}>
            <Text style={styles.closeModalBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={[styles.storeModalEmojiCircle, { backgroundColor: '#2E86AB20' }]}>
            <Text style={styles.storeModalEmoji}>🧭</Text>
          </View>
        </View>

        <View style={styles.travelModeBody}>
          <Text style={styles.travelModeTitle}>اختر وسيلة الذهاب</Text>
          <Text style={styles.travelModeSubtitle}>{selectedStore?.name}</Text>

          <View style={styles.travelModeGrid}>
            <TouchableOpacity
              style={[styles.travelModeOptionBtn, { backgroundColor: '#2E86AB' }]}
              onPress={() => {
                setTravelChoice('walking');
                setTravelStep(3);
              }}
            >
              <Text style={styles.travelModeOptionText}>🚶 مشي</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.travelModeOptionBtn, { backgroundColor: '#7C3AED' }]}
              onPress={() => {
                setTravelChoice('bike1');
                setTravelStep(3);
              }}
            >
              <Text style={styles.travelModeOptionText}>🛵 بسكليت</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.travelModeOptionBtn, { backgroundColor: '#16A34A' }]}
              onPress={() => {
                setTravelChoice('bike2');
                setTravelStep(3);
              }}
            >
              <Text style={styles.travelModeOptionText}>🚲 دراجة</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.travelModeOptionBtn, { backgroundColor: '#EF4444' }]}
              onPress={() => {
                setTravelChoice('driving');
                setTravelStep(3);
              }}
            >
              <Text style={styles.travelModeOptionText}>🚗 سيارة</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.travelBackBtn} onPress={() => setTravelStep(1)}>
            <Text style={styles.travelBackBtnText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const TravelPreviewSheet = () => {
    if (!selectedStore || !travelChoice) return null;
    const origin =
      userLocation ??
      (mapRegionOverride
        ? { latitude: mapRegionOverride.latitude, longitude: mapRegionOverride.longitude }
        : null);

    const originText = origin
      ? `أنت هنا: ${origin.latitude.toFixed(5)}, ${origin.longitude.toFixed(5)}`
      : 'غير معروف';

    return (
      <View style={styles.overlayContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.overlayBackdrop}
          onPress={() => setTravelStep(2)}
          activeOpacity={1}
          pointerEvents="none"
        />
        <View style={styles.storeModal}>
          <View style={styles.storeModalHandle} />
          <View style={styles.storeModalHeader}>
            <TouchableOpacity style={styles.closeModalBtn} onPress={closeTravelFlow}>
              <Text style={styles.closeModalBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={[styles.storeModalEmojiCircle, { backgroundColor: '#10B98120' }]}>
              <Text style={styles.storeModalEmoji}>🧾</Text>
            </View>
          </View>

          <View style={styles.travelPreviewBody}>
            <Text style={styles.travelPreviewTitle}>تأكيد التنقل</Text>
            <Text style={styles.travelPreviewSubtitle}>{travelChoiceToLabel(travelChoice)}</Text>

            <View style={styles.travelInfoBlock}>
              <Text style={styles.travelInfoLabel}>مكاني الحالي</Text>
              <Text style={styles.travelInfoValue}>{originText}</Text>
            </View>

            <View style={styles.travelInfoBlock}>
              <Text style={styles.travelInfoLabel}>مكان التوجه</Text>
              <Text style={styles.travelInfoValue}>{selectedStore.name}</Text>
            </View>

            {travelPreviewLoading || !routeInfo ? (
              <Text style={styles.travelLoadingText}>جاري حساب المسار...</Text>
            ) : (
              <View style={styles.travelDurationBox}>
                <Text style={styles.travelDurationLine}>⏳ {routeInfo.distance} متبقية</Text>
                <Text style={styles.travelDurationLine2}>⏱️ المدة الزمنية المتوقعة: {routeInfo.duration}</Text>
              </View>
            )}

            <View style={styles.travelPreviewBtnsRow}>
              <TouchableOpacity
                style={[styles.travelPreviewBtn, styles.travelCancelBtn]}
                onPress={() => {
                  clearRoute();
                  setTravelStep(2);
                }}
              >
                <Text style={styles.travelPreviewBtnTextCancel}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.travelPreviewBtn, styles.travelConfirmBtn]}
                onPress={confirmTravel}
                disabled={travelPreviewLoading || !routeInfo}
              >
                <Text style={styles.travelPreviewBtnTextConfirm}>تأكيد</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
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
        <PlaceCard
          place={{
            id: item.id,
            name: item.name,
            description: item.description || null,
            phoneNumber: item.phone ?? null,
            images:
              item.images?.map((img) => ({ id: img.id, url: img.image_url, sortOrder: img.sort_order })) ??
              [],
            location: { latitude: item.latitude, longitude: item.longitude },
            typeId: item.type_id ?? '',
            typeName: item.type_name ?? item.category,
            kind: 'simple',
            status: (item.status as any) ?? 'pending',
            avgRating: parseFloat(item.avg_rating ?? '0'),
            ratingCount: item.rating_count ?? 0,
            createdAt: item.createdAt,
            attributes:
              item.attributes?.map((a) => ({ key: a.key, value: a.value, valueType: a.value_type })) ?? [],
          } as any}
        />
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
        initialRegion={mapRegionOverride ?? defaultRegion}
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
          const matches = !placeSearchQ || matchesQuery(store, placeSearchQ);
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
                opacity: isActive && matches ? 1 : placeSearchQ ? 0.18 : 0.35,
                scale: isActive && matches ? 1 : placeSearchQ ? 0.78 : 0.8,
              }}
            >
              <View
                style={[
                  styles.markerContainer,
                  {
                    backgroundColor:
                      getCategoryStyle(categoryList, store.category).color,
                    opacity: isActive && matches ? 1 : placeSearchQ ? 0.25 : 0.35,
                    transform: [{ scale: isActive && matches ? 1 : placeSearchQ ? 0.78 : 0.8 }],
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
      {routeInfo && (travelStep === 3 || isRouting) && (
        <View style={styles.routeBanner}>
          <View style={styles.routeBannerContent}>
            <View style={styles.routeBannerInfo}>
              <Text style={styles.routeBannerDistance}>⏳ {routeInfo.distance} متبقية</Text>
              <Text style={styles.routeBannerDuration}>⏱️ المدة الزمنية المتوقعة: {routeInfo.duration}</Text>
            </View>
            <TouchableOpacity
              style={styles.routeBannerClose}
              onPress={() => {
                clearRoute();
                if (travelStep === 3) setTravelStep(2);
              }}
            >
              <Text style={styles.routeBannerCloseText}>✕ إنهاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Top Bar */}
      {!isRouting && travelStep === 1 && (
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
              ? 'داخل المنطقة'
              : 'خارج المنطقة'}
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
      )}

      {/* Place Search (maps shown places) */}
      {!addPlaceCoord && !isRouting && travelStep === 1 && (
        <View style={styles.placeSearchWrap} pointerEvents="box-none">
          <View style={styles.placeSearchInputRow}>
            <TextInput
              style={styles.placeSearchInput}
              placeholder="بحث في الأماكن..."
              placeholderTextColor="#9CA3AF"
              value={placeSearchQuery}
              onChangeText={setPlaceSearchQuery}
              textAlign="right"
            />
            {placeSearchQuery.trim() ? (
              <TouchableOpacity
                style={styles.placeSearchClearBtn}
                onPress={() => setPlaceSearchQuery('')}
                activeOpacity={0.8}
              >
                <Text style={styles.placeSearchClearBtnText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {placeSearchQ ? (
            <View style={styles.placeSearchResultsCard}>
              {placeSearchResults.length === 0 ? (
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
                  {placeSearchResults.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.placeSearchItem}
                      onPress={() => {
                        setPlaceSearchQuery('');
                        setSelectedCategory(null);
                        setSelectedStore(s);
                        mapRef.current?.animateToRegion(
                          {
                            latitude: s.latitude,
                            longitude: s.longitude,
                            latitudeDelta: 0.008,
                            longitudeDelta: 0.008,
                          },
                          600
                        );
                      }}
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
      )}

      {/* Center Button */}
      {!selectedStore && (
        <TouchableOpacity style={styles.centerBtn} onPress={() => zoomToNearbyMe(5)}>
          <Text style={styles.centerBtnText}>🎯</Text>
        </TouchableOpacity>
      )}

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
              phone_number: data.phoneNumber?.trim() || undefined,
              attributes: attributes.length ? attributes : undefined,
              image_urls: imageUrls.length ? imageUrls : undefined,
            });

            await refresh();
          }}
          latitude={addPlaceCoord.latitude}
          longitude={addPlaceCoord.longitude}
        />
      )}

      {/* ── Add Unit Modal (from complex viewer) ── */}
      {addUnitContext && (
        <AddPlaceModal
          visible={!!addUnitContext}
          onClose={() => setAddUnitContext(null)}
          submitSuccessTitle="تمت إضافة الوحدة بنجاح"
          submitSuccessMessage="تم إنشاء الوحدة وربطها بالمجمّع."
          initialTypeName={addUnitContext.complexType === 'commercial' ? 'متجر تجاري' : 'منزل'}
          initialFormOverrides={{
            name:
              addUnitContext.complexType === 'commercial'
                ? `وحدة ${addUnitContext.floorNumber}-${addUnitContext.unitNumber}`
                : '',
            dynamicValues: {
              ...(addUnitContext.complexType === 'commercial'
                ? { store_number: `${addUnitContext.floorNumber}-${addUnitContext.unitNumber}` }
                : { house_number: `${addUnitContext.floorNumber}-${addUnitContext.unitNumber}` }),
            },
          }}
          onSubmit={async (data) => {
            if (!isValidPlaceTypeId(data.type_id)) {
              throw new Error('معرّف نوع المكان غير صالح.');
            }

            const attributes = data.dynamicAttributes || [];

            let imageUrls: string[] = [];
            if (data.photos?.length) {
              for (const photoUri of data.photos) {
                try {
                  const base64 = await uriToBase64(photoUri);
                  const uploadRes = await api.uploadBase64(base64);
                  const url = uploadRes?.data?.url;
                  if (url && /^https?:\/\//i.test(url)) imageUrls.push(url);
                } catch { /* skip */ }
              }
            }

            const createRes = await api.createPlace({
              name: data.name.trim(),
              description: data.description?.trim() || undefined,
              type_id: data.type_id.trim(),
              latitude: Number(data.latitude),
              longitude: Number(data.longitude),
              phone_number: data.phoneNumber?.trim() || undefined,
              attributes: attributes.length ? attributes : undefined,
              image_urls: imageUrls.length ? imageUrls : undefined,
            });

            const newPlaceId = createRes?.data?.id;
            if (newPlaceId && addUnitContext) {
              try {
                await placeService.linkUnitPlace(addUnitContext.unitRowId, newPlaceId);
              } catch {
                // Place created but link failed; user can retry via admin
              }
            }

            await refresh();
          }}
          latitude={addUnitContext.latitude}
          longitude={addUnitContext.longitude}
        />
      )}

      {/* ── Category Bar (Bottom) — إخفاؤه عند نافذة إضافة مكان حتى لا يغطي زر الإرسال (elevation + ترتيب الرسم) ── */}
      {!addPlaceCoord && !addUnitContext && !isRouting && travelStep === 1 && (
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
                  {getPlaceTypeDisplayName(cat)}
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
                  <Text style={styles.sheetTitle}>{getPlaceTypeDisplayName(selectedCategory)}</Text>
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
      {showSidebar && !isRouting && travelStep === 1 && (
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
                      <Text style={styles.sidebarCatName}>{getPlaceTypeDisplayName(cat)}</Text>
                    </View>
                    <Text style={styles.sidebarCatEmoji}>{getCategoryStyle(categoryList, cat).emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {(user?.role === 'owner' || user?.role === 'store_owner' || user?.isAdmin) && (
              <TouchableOpacity style={styles.sidebarOwnerBtn} onPress={() => { setShowSidebar(false); router.push('/(main)/my-store'); }}>
                <Text style={styles.sidebarOwnerBtnText}>🏪 متجري</Text>
              </TouchableOpacity>
            )}
            {(user?.role === 'owner' || user?.role === 'store_owner' || user?.isAdmin) && (
              <TouchableOpacity style={styles.sidebarOwnerBtn} onPress={() => { setShowSidebar(false); router.push('/(main)/owner-dashboard'); }}>
                <Text style={styles.sidebarOwnerBtnText}>📊 لوحة تحكم المتجر</Text>
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
      {selectedStore && !isRouting && travelStep === 1 && (
        <StoreDetailSheet
          store={selectedStore}
          userLocation={userLocation}
          user={user}
          categoryList={categoryList}
          onClose={closeTravelFlow}
          onNavigate={handleOpenTravelModePicker}
          onReport={() => setShowReportModal(true)}
          onServices={() => setShowServicesModal(true)}
          onEdit={() => {
            setSelectedStore(null);
            setTravelStep(1);
            setTravelChoice(null);
            setTravelPreviewLoading(false);
            clearRoute();
            router.push({
              pathname: '/(main)/admin-stores',
              params: { editStoreId: selectedStore.id },
            });
          }}
          onDelete={async () => {
            await deletePlace(selectedStore.id);
            setSelectedStore(null);
            setTravelStep(1);
            setTravelChoice(null);
            setTravelPreviewLoading(false);
            clearRoute();
          }}
          onOpenChildPlace={(childPlaceId) => {
            const existing = stores.find((s) => s.id === childPlaceId);
            if (existing) {
              setSelectedStore(existing);
              mapRef.current?.animateToRegion(
                {
                  latitude: existing.latitude,
                  longitude: existing.longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                },
                600
              );
              return;
            }
            void (async () => {
              try {
                const p = await placeService.getById(childPlaceId);
                const next = placeToStore(p);
                setSelectedStore(next);
                mapRef.current?.animateToRegion(
                  {
                    latitude: next.latitude,
                    longitude: next.longitude,
                    latitudeDelta: 0.008,
                    longitudeDelta: 0.008,
                  },
                  600
                );
              } catch {
                // ignore: user can still view parent
              }
            })();
          }}
          onAddUnit={(unit, parentStore) => {
            if (user?.id === 'guest' || !user) {
              Alert.alert('تنبيه', 'يجب تسجيل الدخول لإضافة وحدة');
              return;
            }
            setAddUnitContext({
              complexPlaceId: parentStore.id,
              complexType: parentStore.category === 'مجمّع تجاري' ? 'commercial' : 'residential',
              unitRowId: unit.id,
              floorNumber: Number(unit.floor_number),
              unitNumber: String(unit.unit_number),
              latitude: parentStore.latitude,
              longitude: parentStore.longitude,
            });
          }}
        />
      )}

      {/* Services Sheet */}
      {showServicesModal && selectedStore && !isRouting && travelStep === 1 && (
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <TouchableOpacity style={styles.overlayBackdrop} onPress={() => setShowServicesModal(false)} activeOpacity={1} />
          <StoreServicesSheet store={selectedStore} user={user} onClose={() => setShowServicesModal(false)} />
        </View>
      )}

      {selectedStore && !isRouting && travelStep === 1 && (
        <ReportModal
          visible={showReportModal}
          storeId={selectedStore.id}
          storeName={selectedStore.name}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Travel Wizard Step 2 (choose mode) */}
      {selectedStore && !isRouting && travelStep === 2 && <TravelModeSheet />}

      {/* Travel Wizard Step 3 (preview + confirm/cancel) */}
      {selectedStore && !isRouting && travelStep === 3 && <TravelPreviewSheet />}
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
    zIndex: 1000,
    pointerEvents: 'auto',
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

  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 0,
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

  storeModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
  storeModalBtnRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    alignSelf: 'stretch',
    marginBottom: 14,
    alignItems: 'stretch',
  },
  storeModalCallBtn: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderWidth: 1,
    borderColor: '#15803D',
    ...shadow({ color: '#166534', offset: { width: 0, height: 4 }, opacity: 0.24, radius: 8, elevation: 4 }),
  },
  storeModalCallBtnIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  storeModalCallBtnIcon: { fontSize: 13 },
  storeModalCallBtnLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  storeModalCallBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 1 },
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
  travelModeBody: { padding: 20, paddingTop: 6, alignItems: 'stretch', gap: 14 },
  travelModeTitle: { fontSize: 18, fontWeight: '900', color: '#1A3A5C', textAlign: 'right' },
  travelModeSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'right', marginTop: -8 },
  travelModeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 },
  travelModeOptionBtn: {
    flexBasis: '48%',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.18, radius: 6, elevation: 4 }),
    marginBottom: 12,
  },
  travelModeOptionText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  travelBackBtn: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  travelBackBtnText: { color: '#374151', fontSize: 14, fontWeight: '800' },

  travelPreviewBody: { padding: 20, paddingTop: 8, alignItems: 'stretch', gap: 14 },
  travelPreviewTitle: { fontSize: 18, fontWeight: '900', color: '#1A3A5C', textAlign: 'right' },
  travelPreviewSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'right' },
  travelInfoBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  travelInfoLabel: { fontSize: 12, color: '#6B7280', fontWeight: '700', marginBottom: 6 },
  travelInfoValue: { fontSize: 13, color: '#111827', fontWeight: '800' },
  travelLoadingText: { textAlign: 'right', color: '#6B7280', fontWeight: '700' },
  travelDurationBox: { backgroundColor: '#fff', borderRadius: 14, padding: 14, ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.08, radius: 6, elevation: 2 }) },
  travelDurationLine: { fontSize: 14, fontWeight: '900', color: '#1A3A5C' },
  travelDurationLine2: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginTop: 6 },
  travelPreviewBtnsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  travelPreviewBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  travelCancelBtn: { backgroundColor: '#FEF3C7' },
  travelConfirmBtn: { backgroundColor: '#2E86AB' },
  travelPreviewBtnTextCancel: { color: '#B45309', fontSize: 14, fontWeight: '900' },
  travelPreviewBtnTextConfirm: { color: '#fff', fontSize: 14, fontWeight: '900' },
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

  placeSearchWrap: {
    position: 'absolute',
    top: LAYOUT.headerTop + 62,
    left: 12,
    right: 12,
    zIndex: 120,
  },
  placeSearchInputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.12, radius: 6, elevation: 6 }),
  },
  placeSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 6,
    textAlign: 'right',
  },
  placeSearchClearBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeSearchClearBtnText: { color: '#6B7280', fontSize: 16, fontWeight: '700' },

  placeSearchResultsCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.12, radius: 8, elevation: 10 }),
  },
  placeSearchEmpty: { padding: 22, alignItems: 'center' },
  placeSearchEmptyEmoji: { fontSize: 34, marginBottom: 8 },
  placeSearchEmptyText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  placeSearchResults: { maxHeight: 260 },
  placeSearchResultsContent: { paddingHorizontal: 10, paddingVertical: 8 },
  placeSearchItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  placeSearchItemEmojiPill: {
    backgroundColor: 'rgba(46, 134, 171, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 10,
  },
  placeSearchItemEmoji: { fontSize: 18 },
  placeSearchItemMain: { flex: 1, minWidth: 0 },
  placeSearchItemName: { fontSize: 14, fontWeight: '800', color: '#111827', textAlign: 'right' },
  placeSearchItemMeta: { fontSize: 12, color: '#6B7280', fontWeight: '600', textAlign: 'right', marginTop: 2 },
  placeSearchItemPhone: { fontSize: 12, color: '#4A7FA5', fontWeight: '700', marginLeft: 12, maxWidth: 110 },
});
