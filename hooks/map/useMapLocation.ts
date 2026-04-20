/**
 * موقع المستخدم على الخريطة: الإذن، التحديث المستمر، التقريب، ورسائل الدخول/الخروج من طولكرم.
 * اشتراك الموقع أثناء وضع «التوجيه النشط» يُدار في useMapTravelAndRouting لتفادي تبعيات دائرية.
 */

import * as Location from 'expo-location';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, Platform } from 'react-native';
import type { MapView } from '../../components/MapWrapper';
import { isInsideTulkarm, startGeofencing, TULKARM_REGION } from '../../utils/geofencing';
import { regionForRadiusAround, type Region } from '../../utils/map/geo';
import {
  watchPositionWebOrNative,
  type LocationWatchHandle,
} from '../../utils/map/locationWatch';
import type { UserLocation } from './types';

type MapViewRef = RefObject<MapView | null>;

export function useMapLocation(mapRef: MapViewRef) {
  const mainLocationSubRef = useRef<LocationWatchHandle | null>(null);
  const locationSetupActiveRef = useRef(true);

  const defaultRegion = useRef<Region>({
    latitude: TULKARM_REGION.latitude,
    longitude: TULKARM_REGION.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }).current;

  const [mapRegionOverride, setMapRegionOverride] = useState<Region | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [inTulkarm, setInTulkarm] = useState<boolean | null>(null);

  const bannerAnim = useRef(new Animated.Value(-100)).current;
  const [bannerMessage, setBannerMessage] = useState('');

  const showBanner = (message: string) => {
    setBannerMessage(message);
    Animated.sequence([
      Animated.spring(bannerAnim, { toValue: 0, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.spring(bannerAnim, { toValue: -100, useNativeDriver: true }),
    ]).start();
  };

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
            ],
      );
      return;
    }

    setLocationGranted(true);
    await startGeofencing();

    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude, longitude } = location.coords;
    setUserLocation({ latitude, longitude });
    setInTulkarm(isInsideTulkarm(latitude, longitude));

    const region: Region = { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    mapRef.current?.animateToRegion(region, 800);
    setMapRegionOverride(region);

    mainLocationSubRef.current?.remove();
    mainLocationSubRef.current = null;

    const sub = await watchPositionWebOrNative('general', (lat, lng) => {
      setUserLocation({ latitude: lat, longitude: lng });
      const nowInside = isInsideTulkarm(lat, lng);
      setInTulkarm((prev) => {
        if (prev === null) return nowInside;
        if (prev !== nowInside) {
          showBanner(nowInside ? '🌟 مرحباً في طولكرم!' : '👋 رافقتك السلامة!');
        }
        return nowInside;
      });
    });

    if (!locationSetupActiveRef.current) {
      sub.remove();
      return;
    }
    mainLocationSubRef.current = sub;
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
          [{ text: 'حسناً' }],
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

      const region: Region = {
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegionOverride(region);
      mapRef.current?.animateToRegion(region, 800);
      return origin;
    } catch {
      Alert.alert('الموقع غير متاح', 'تعذّر جلب موقعك الآن. جرّب مرة أخرى.');
      return null;
    }
  };

  /**
   * تقريب الخريطة على نطاق صغير حول المستخدم.
   * على الويب: استخدام navigator.geolocation إن لم يكن موقع المستخدم جاهزاً بعد.
   */
  const zoomToNearbyMe = (radiusMeters = 5) => {
    if (!userLocation) {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setUserLocation(next);
            setInTulkarm(isInsideTulkarm(next.latitude, next.longitude));
            const region = regionForRadiusAround(next, radiusMeters);
            setMapRegionOverride(region);
            mapRef.current?.animateToRegion(region, 800);
          },
          () => Alert.alert('الموقع غير متاح', 'فعّل خدمة الموقع ليتم التقريب على مكانك.'),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
        );
        return;
      }
      Alert.alert('الموقع غير متاح', 'فعّل خدمة الموقع ليتم التقريب على مكانك.');
      return;
    }

    const region = regionForRadiusAround(userLocation, radiusMeters);
    setMapRegionOverride(region);
    mapRef.current?.animateToRegion(region, 800);
  };

  useEffect(() => {
    locationSetupActiveRef.current = true;
    void setupLocation();
    return () => {
      locationSetupActiveRef.current = false;
      mainLocationSubRef.current?.remove();
      mainLocationSubRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    defaultRegion,
    mapRegionOverride,
    setMapRegionOverride,
    locationGranted,
    userLocation,
    setUserLocation,
    inTulkarm,
    setInTulkarm,
    bannerAnim,
    bannerMessage,
    ensureUserLocation,
    zoomToNearbyMe,
  };
}
