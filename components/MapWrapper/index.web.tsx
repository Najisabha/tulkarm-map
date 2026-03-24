import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { Circle as GMapCircle, GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMapsLoader } from '../../context/GoogleMapsLoaderContext';
import { MapContainer, TileLayer, Circle as LeafletCircle, Marker as LeafletMarker, useMap } from 'react-leaflet';
import type { Map } from 'leaflet';
import L from 'leaflet';

// Leaflet CSS
if (typeof document !== 'undefined') {
  const id = 'leaflet-stylesheet';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
}
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;

const DEFAULT_CENTER = { lat: 32.327, lng: 35.088 };
const DEFAULT_ZOOM = 12;
const mapContainerStyle = { width: '100%', height: '100%' };

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface MapViewProps {
  style?: Record<string, unknown>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  onPress?: (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
  children?: React.ReactNode;
  provider?: string;
  customMapStyle?: unknown;
}

function deltaToZoom(latDelta: number, lngDelta: number): number {
  const maxDelta = Math.max(latDelta, lngDelta);
  return Math.round(Math.log2(360 / maxDelta));
}

function getGoogleMapsApiKey(): string {
  const fromExtra = Constants.expoConfig?.extra?.googleMapsApiKey;
  const fromEnv =
    typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const key = (fromExtra || fromEnv || '') as string;
  const placeholder = 'your_google_maps_api_key';
  return typeof key === 'string' && key && key !== placeholder ? key : '';
}

function shouldForceLeaflet(): boolean {
  return (
    (typeof process !== 'undefined' &&
      (process as any).env?.EXPO_PUBLIC_FORCE_LEAFLET_MAP === 'true') ||
    false
  );
}

const MapTypeContext = React.createContext<'leaflet' | 'google'>('leaflet');

// ─── Leaflet Fallback ───────────────────────────────────────────────────────

function LeafletMapController({
  onPress,
  setMapRef,
}: {
  onPress?: MapViewProps['onPress'];
  setMapRef: (m: Map | null) => void;
}) {
  const map = useMap();
  useEffect(() => {
    setMapRef(map);
    return () => {
      setMapRef(null);
    };
  }, [map, setMapRef]);
  useEffect(() => {
    if (!onPress) return;
    const handler = (e: L.LeafletMouseEvent) => {
      onPress({
        nativeEvent: {
          coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng },
        },
      });
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [map, onPress]);
  return null;
}

function LeafletMapViewInner({
  style,
  initialRegion,
  onPress,
  children,
  showsUserLocation,
  mapRef,
  ref,
}: MapViewProps & {
  mapRef: React.MutableRefObject<Map | null>;
  ref: React.Ref<{ animateToRegion: (region: Region, duration?: number) => void }>;
}) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const center: [number, number] = initialRegion
    ? [initialRegion.latitude, initialRegion.longitude]
    : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
  const zoom = initialRegion
    ? deltaToZoom(initialRegion.latitudeDelta, initialRegion.longitudeDelta)
    : DEFAULT_ZOOM;

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region, duration = 500) => {
      const map = mapRef.current;
      if (!map) return;
      const z = deltaToZoom(region.latitudeDelta, region.longitudeDelta);
      if (duration > 0) {
        map.flyTo([region.latitude, region.longitude], z, { duration: duration / 1000 });
      } else {
        map.setView([region.latitude, region.longitude], z);
      }
    },
  }));

  useEffect(() => {
    if (!showsUserLocation || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [showsUserLocation]);

  return (
    <MapTypeContext.Provider value="leaflet">
    <div style={{ width: '100%', height: '100%', ...(style as object) }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <LeafletMapController onPress={onPress} setMapRef={(m) => { mapRef.current = m; }} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {children}
        {showsUserLocation && userLocation && (
          <LeafletMarker
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: 'user-location-marker',
              html: `<div style="
                width: 20px; height: 20px; border-radius: 50%;
                background: #2E86AB; border: 3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              "></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
          />
        )}
      </MapContainer>
    </div>
    </MapTypeContext.Provider>
  );
}

// ─── Google Maps ────────────────────────────────────────────────────────────

const GoogleMapViewInner = React.forwardRef<
  { animateToRegion: (region: Region, duration?: number) => void },
  MapViewProps
>(function GoogleMapViewInner(
  {
    style,
    initialRegion,
    onPress,
    children,
    showsUserLocation = false,
    customMapStyle,
  }: MapViewProps,
  ref
) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const center = initialRegion
    ? { lat: initialRegion.latitude, lng: initialRegion.longitude }
    : DEFAULT_CENTER;
  const zoom = initialRegion
    ? deltaToZoom(initialRegion.latitudeDelta, initialRegion.longitudeDelta)
    : DEFAULT_ZOOM;

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region, duration = 500) => {
      const map = mapRef.current;
      if (!map) return;
      const target = { lat: region.latitude, lng: region.longitude };
      const targetZoom = deltaToZoom(region.latitudeDelta, region.longitudeDelta);
      if (duration > 0) {
        map.panTo(target);
        map.setZoom(targetZoom);
      } else {
        map.setCenter(target);
        map.setZoom(targetZoom);
      }
    },
  }));

  useEffect(() => {
    if (!showsUserLocation || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [showsUserLocation]);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng && onPress) {
        onPress({
          nativeEvent: {
            coordinate: { latitude: e.latLng.lat(), longitude: e.latLng.lng() },
          },
        });
      }
    },
    [onPress]
  );

  return (
    <MapTypeContext.Provider value="google">
    <div style={{ width: '100%', height: '100%', ...(style as object) }}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={{
          zoomControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          styles: (customMapStyle as google.maps.MapTypeStyle[]) ?? undefined,
          gestureHandling: 'greedy',
        }}
      >
        {children}
        {showsUserLocation && userLocation && (
          <OverlayView
            position={{ lat: userLocation.lat, lng: userLocation.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#2E86AB',
                border: '3px solid white',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                transform: 'translate(-50%, -50%)',
              }}
            />
          </OverlayView>
        )}
      </GoogleMap>
    </div>
    </MapTypeContext.Provider>
  );
});

// ─── Main MapView: Google with Leaflet Fallback ─────────────────────────────

export const MapView = React.forwardRef<
  { animateToRegion: (region: Region, duration?: number) => void },
  MapViewProps
>(function MapView(props, ref) {
  const loader = useGoogleMapsLoader();
  const apiKey = loader?.apiKey ?? getGoogleMapsApiKey();
  const isLoaded = loader?.isLoaded ?? false;
  const loadError = loader?.loadError;
  const leafletMapRef = useRef<Map | null>(null);

  // Use Leaflet when: forced by env, or no key, or Google failed to load, or loader not ready
  const useLeaflet =
    shouldForceLeaflet() || !apiKey || apiKey === 'no-key' || !!loadError;

  // Show loading while Google is loading (only when we have a valid key)
  if (apiKey && apiKey !== 'no-key' && !loadError && !isLoaded) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
        }}
      >
        <p style={{ color: '#666' }}>جاري تحميل الخريطة...</p>
      </div>
    );
  }

  if (useLeaflet) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {!shouldForceLeaflet() && !apiKey && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              zIndex: 1000,
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              padding: 12,
              borderRadius: 12,
              fontSize: 14,
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            لتفعيل Google Maps: أضف EXPO_PUBLIC_GOOGLE_MAPS_API_KEY في ملف .env ثم أعد تشغيل التطبيق
          </div>
        )}
        <LeafletMapViewInner
          {...props}
          ref={ref}
          mapRef={leafletMapRef}
        />
      </div>
    );
  }

  return <GoogleMapViewInner {...props} ref={ref} />;
});

// ─── Marker & Circle (context-aware) ─────────────────────────────────────────

interface MarkerIcon {
  emoji?: string;
  color?: string;
  opacity?: number;
  scale?: number;
}

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  icon?: MarkerIcon;
}

export function Marker({ coordinate, onPress, icon }: MarkerProps) {
  const mapType = React.useContext(MapTypeContext);
  const { emoji = '📍', color = '#2E86AB', opacity = 1, scale = 1 } = icon ?? {};

  if (mapType === 'leaflet') {
    const eventHandlers = { click: () => onPress?.() };
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        width: 38px; height: 38px; border-radius: 19px;
        background: ${color}; opacity: ${opacity}; transform: scale(${scale});
        display: flex; align-items: center; justify-content: center;
        border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        font-size: 18px; cursor: pointer;
      ">${emoji}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
    });
    return (
      <LeafletMarker
        position={[coordinate.latitude, coordinate.longitude]}
        eventHandlers={eventHandlers}
        icon={customIcon}
      />
    );
  }

  return (
    <OverlayView
      position={{ lat: coordinate.latitude, lng: coordinate.longitude }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onPress?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onPress?.();
          }
        }}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          background: color,
          opacity,
          transform: `translate(-50%, -100%) scale(${scale})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          fontSize: 18,
          cursor: 'pointer',
        }}
      >
        {emoji}
      </div>
    </OverlayView>
  );
}

interface CircleProps {
  center: { latitude: number; longitude: number };
  radius?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export function Circle({
  center,
  radius = 1000,
  fillColor = 'rgba(46, 134, 171, 0.08)',
  strokeColor = 'rgba(46, 134, 171, 0.4)',
  strokeWidth = 2,
}: CircleProps) {
  const mapType = React.useContext(MapTypeContext);

  if (mapType === 'leaflet') {
    return (
      <LeafletCircle
        center={[center.latitude, center.longitude]}
        radius={radius}
        pathOptions={{
          fillColor,
          fillOpacity: 1,
          color: strokeColor,
          weight: strokeWidth,
        }}
      />
    );
  }

  return (
    <GMapCircle
      center={{ lat: center.latitude, lng: center.longitude }}
      radius={radius}
      options={{
        fillColor,
        fillOpacity: 1,
        strokeColor,
        strokeWeight: strokeWidth,
      }}
    />
  );
}
