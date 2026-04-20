/**
 * مسار التوجيه ومعالج السفر (اختيار وسيلة النقل، معاينة، ثم التوجيه النشط).
 * يتضمن اشتراك موقع أدق أثناء التوجيه لتقليل التأخير على الخريطة.
 */

import * as Location from 'expo-location';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapView } from '../../components/MapWrapper';
import { isInsideTulkarm } from '../../utils/geofencing';
import {
  formatRemainingMeters,
  haversineDistance,
  regionForRouteDestination,
  regionForRoutingFollow,
  regionForSelectedPlace,
  TRAVEL_MODE_ROUTE_ZOOM_IN_FACTOR,
  type Region,
} from '../../utils/map/geo';
import {
  watchPositionWebOrNative,
  type LocationWatchHandle,
} from '../../utils/map/locationWatch';
import { fetchRoute, type TravelChoice } from '../../utils/map/routing';
import type { Store } from '../../utils/map/storeModel';
import type { UserLocation } from './types';

type MapViewRef = RefObject<MapView | null>;

export function useMapTravelAndRouting(params: {
  mapRef: MapViewRef;
  selectedStore: Store | null;
  setSelectedStore: (s: Store | null) => void;
  userLocation: UserLocation | null;
  setUserLocation: (loc: UserLocation | null) => void;
  setInTulkarm: (v: boolean | null | ((prev: boolean | null) => boolean | null)) => void;
  ensureUserLocation: () => Promise<UserLocation | null>;
  mapRegionOverride: Region | null;
  setMapRegionOverride: (r: Region | null) => void;
  setShowSidebar: (v: boolean) => void;
  setShowReportModal: (v: boolean) => void;
  setSelectedCategory: (v: string | null) => void;
}) {
  const {
    mapRef,
    selectedStore,
    setSelectedStore,
    userLocation,
    setUserLocation,
    setInTulkarm,
    ensureUserLocation,
    mapRegionOverride,
    setMapRegionOverride,
    setShowSidebar,
    setShowReportModal,
    setSelectedCategory,
  } = params;

  const routingLocationSubRef = useRef<LocationWatchHandle | null>(null);

  const [routePath, setRoutePath] = useState<UserLocation[] | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<UserLocation[][]>([]);
  const [routeDestination, setRouteDestination] = useState<UserLocation | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [travelStep, setTravelStep] = useState<1 | 2 | 3>(1);
  const [travelChoice, setTravelChoice] = useState<TravelChoice | null>(null);
  const [travelPreviewLoading, setTravelPreviewLoading] = useState(false);

  const clearRoute = useCallback(() => {
    setRoutePath(null);
    setAlternativeRoutes([]);
    setRouteDestination(null);
    setRouteInfo(null);
    setIsRouting(false);
  }, []);

  useEffect(() => {
    if (!selectedStore) return;
    setTravelStep(1);
    setTravelChoice(null);
    setTravelPreviewLoading(false);
  }, [selectedStore?.id]);

  useEffect(() => {
    if (!selectedStore || isRouting) return;
    if (travelStep === 3) return;
    const region = regionForSelectedPlace(selectedStore.latitude, selectedStore.longitude);
    setMapRegionOverride(region);
    mapRef.current?.animateToRegion(region, 600);
  }, [selectedStore?.id, travelStep, isRouting]);

  useEffect(() => {
    if (!routeDestination || !userLocation) return;
    setRouteInfo((prev) => {
      if (!prev) return prev;
      const remainingMeters = haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        routeDestination.latitude,
        routeDestination.longitude,
      );
      return { ...prev, distance: formatRemainingMeters(remainingMeters) };
    });
  }, [routeDestination, userLocation]);

  useEffect(() => {
    if (!isRouting || !userLocation) return;
    const region = regionForRoutingFollow(userLocation);
    setMapRegionOverride(region);
    mapRef.current?.animateToRegion(region, 320);
  }, [isRouting, userLocation]);

  useEffect(() => {
    if (!isRouting) {
      routingLocationSubRef.current?.remove();
      routingLocationSubRef.current = null;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        const sub = await watchPositionWebOrNative('routing', (lat, lng) => {
          setUserLocation({ latitude: lat, longitude: lng });
          setInTulkarm(isInsideTulkarm(lat, lng));
        });

        if (cancelled) {
          sub.remove();
          return;
        }
        routingLocationSubRef.current = sub;
      } catch {
        /* الإبقاء على اشتراك الموقع العام من setupLocation */
      }
    })();

    return () => {
      cancelled = true;
      routingLocationSubRef.current?.remove();
      routingLocationSubRef.current = null;
    };
  }, [isRouting, setUserLocation, setInTulkarm]);

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
      setAlternativeRoutes([]);
      setRouteInfo(null);

      const result = await fetchRoute(origin, destination, travelChoice);
      if (cancelled) {
        clearRoute();
        return;
      }

      setRoutePath(result.path);
      setAlternativeRoutes(result.alternatives);
      setRouteInfo(result.info);

      mapRef.current?.animateToRegion(
        regionForRouteDestination(origin, destination, TRAVEL_MODE_ROUTE_ZOOM_IN_FACTOR),
        800,
      );

      if (!cancelled) setTravelPreviewLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelStep, travelChoice, selectedStore?.id]);

  const handleOpenTravelModePicker = useCallback(() => {
    if (!selectedStore || isRouting) return;
    setTravelStep(2);
    setTravelChoice(null);
    setTravelPreviewLoading(false);
    setRoutePath(null);
    setAlternativeRoutes([]);
    setRouteDestination(null);
    setRouteInfo(null);
  }, [selectedStore, isRouting]);

  const closeTravelFlow = useCallback(() => {
    setSelectedStore(null);
    setTravelStep(1);
    setTravelChoice(null);
    setTravelPreviewLoading(false);
    setShowReportModal(false);
    clearRoute();
  }, [setSelectedStore, setShowReportModal, clearRoute]);

  const confirmTravel = useCallback(() => {
    setIsRouting(true);
    setShowSidebar(false);
    setSelectedCategory(null);
    setShowReportModal(false);
    setTravelStep(1);
    setTravelChoice(null);
    setTravelPreviewLoading(false);
    setSelectedStore(null);
  }, [setShowSidebar, setSelectedCategory, setShowReportModal, setSelectedStore]);

  const travelPreviewOrigin = userLocation
    ? userLocation
    : mapRegionOverride
      ? { latitude: mapRegionOverride.latitude, longitude: mapRegionOverride.longitude }
      : null;

  return {
    routePath,
    alternativeRoutes,
    routeInfo,
    isRouting,
    travelStep,
    setTravelStep,
    travelChoice,
    setTravelChoice,
    travelPreviewLoading,
    setTravelPreviewLoading,
    clearRoute,
    handleOpenTravelModePicker,
    closeTravelFlow,
    confirmTravel,
    travelPreviewOrigin,
  };
}
