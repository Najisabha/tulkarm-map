export interface Coord {
  latitude: number;
  longitude: number;
}

export interface Region extends Coord {
  latitudeDelta: number;
  longitudeDelta: number;
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} م`;
  return `${(meters / 1000).toFixed(1)} كم`;
}

export function formatRemainingMeters(meters: number): string {
  return `${Math.max(0, Math.round(meters))} م`;
}

/** Smaller deltas → stronger zoom after picking a destination. */
const ROUTE_DESTINATION_ZOOM_FACTOR = 0.5;

/** Applied after user picks a travel mode: higher value = tighter zoom. */
export const TRAVEL_MODE_ROUTE_ZOOM_IN_FACTOR = 128;

export function regionForRouteDestination(origin: Coord, destination: Coord, zoomInFactor = 1): Region {
  const span = 2.5;
  const minDelta = 0.005;
  const z = ROUTE_DESTINATION_ZOOM_FACTOR;
  const f = Math.max(zoomInFactor, 0.05);
  return {
    latitude: (origin.latitude + destination.latitude) / 2,
    longitude: (origin.longitude + destination.longitude) / 2,
    latitudeDelta: ((Math.abs(origin.latitude - destination.latitude) * span + minDelta) * z) / f,
    longitudeDelta: ((Math.abs(origin.longitude - destination.longitude) * span + minDelta) * z) / f,
  };
}

/** Very tight region centered on a selected place. */
const SELECTED_PLACE_MAP_DELTA = 0.000125;

export function regionForSelectedPlace(latitude: number, longitude: number): Region {
  return {
    latitude,
    longitude,
    latitudeDelta: SELECTED_PLACE_MAP_DELTA,
    longitudeDelta: SELECTED_PLACE_MAP_DELTA,
  };
}

/** Region covering the bounding box of a set of coordinates, padded. */
export function regionForBoundingBox(coords: Coord[], padDelta = 0.01, minDelta = 0.02): Region | null {
  if (coords.length === 0) return null;
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat + padDelta, minDelta),
    longitudeDelta: Math.max(maxLng - minLng + padDelta, minDelta),
  };
}

/**
 * Region tightly framing a radius (in meters) around a point; matches the
 * zoom behaviour of the "center on my location" button.
 */
export function regionForRadiusAround(
  center: Coord,
  radiusMeters: number,
  paddingFactor = 6,
  minDelta = 0.00005,
): Region {
  const halfSpan = radiusMeters * paddingFactor;
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos((center.latitude * Math.PI) / 180);
  const latDelta = (2 * halfSpan) / metersPerDegLat;
  const lonDelta = (2 * halfSpan) / Math.max(metersPerDegLon, 1e-6);
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: Math.max(latDelta, minDelta),
    longitudeDelta: Math.max(lonDelta, minDelta),
  };
}

/**
 * Region used while following the user during routing. Pulls the viewport in
 * much closer than the base radius-around calculation.
 */
export function regionForRoutingFollow(center: Coord, radiusMeters = 95, paddingFactor = 2.5): Region {
  const followZoomMultiplier = 16;
  const half = radiusMeters * paddingFactor;
  const mLat = 111_320;
  const mLon = 111_320 * Math.cos((center.latitude * Math.PI) / 180);
  const latDelta = (2 * half) / mLat / followZoomMultiplier;
  const lonDelta = (2 * half) / Math.max(mLon, 1e-6) / followZoomMultiplier;
  const minDelta = 0.00035 / followZoomMultiplier;
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: Math.max(latDelta, minDelta),
    longitudeDelta: Math.max(lonDelta, minDelta),
  };
}
