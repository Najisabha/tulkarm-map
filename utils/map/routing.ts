import type { Coord } from './geo';
import { formatRemainingMeters, haversineDistance } from './geo';

export type TravelMode = 'walking' | 'bicycling' | 'driving';

export type TravelChoice = 'walking' | 'bike1' | 'bike2' | 'driving';

export interface RouteResult {
  path: Coord[];
  alternatives: Coord[][];
  info: { distance: string; duration: string };
}

export function choiceToApiMode(choice: TravelChoice): TravelMode {
  if (choice === 'walking') return 'walking';
  if (choice === 'driving') return 'driving';
  return 'bicycling';
}

export function choiceToOsrmProfile(choice: TravelChoice): 'driving' | 'walking' | 'cycling' {
  if (choice === 'walking') return 'walking';
  if (choice === 'driving') return 'driving';
  return 'cycling';
}

export function getSpeedMPerMin(choice: TravelChoice): number {
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
}

export function formatDurationMinutes(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  return `${m} دقيقة`;
}

export function travelChoiceToLabel(choice: TravelChoice): string {
  if (choice === 'walking') return 'مشي على الاقدام';
  if (choice === 'bike1') return 'بسكليت';
  if (choice === 'bike2') return 'دراجة';
  return 'سيارة';
}

export function geoJsonLineToPath(
  geometry: { coordinates?: number[][] } | null | undefined,
): Coord[] {
  const coords = geometry?.coordinates;
  if (!coords?.length) return [];
  return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

export function decodePolyline(encoded: string): Coord[] {
  const points: Coord[] = [];
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
}

/**
 * Compute a route from origin → destination. Tries OSRM (with alternatives),
 * falls back to Google Directions (if `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is
 * set), and finally to a straight line — always returning an estimate.
 */
export async function fetchRoute(
  origin: Coord,
  destination: Coord,
  travelChoice: TravelChoice,
): Promise<RouteResult> {
  const remainingMeters = haversineDistance(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );

  try {
    const profile = choiceToOsrmProfile(travelChoice);
    const osrmUrl =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}` +
      `?overview=full&geometries=geojson&alternatives=true`;
    const osrmRes = await fetch(osrmUrl);
    const osrmData = await osrmRes.json();
    if (osrmData.code === 'Ok' && Array.isArray(osrmData.routes) && osrmData.routes.length > 0) {
      const paths: Coord[][] = osrmData.routes
        .map((r: { geometry?: { coordinates?: number[][] } }) => geoJsonLineToPath(r.geometry))
        .filter((p: Coord[]) => p.length >= 2);
      if (paths.length > 0) {
        const main = osrmData.routes[0] as { duration?: number };
        const durationSec = typeof main.duration === 'number' ? main.duration : 0;
        const minutes = durationSec > 0 ? durationSec / 60 : remainingMeters / getSpeedMPerMin(travelChoice);
        return {
          path: paths[0],
          alternatives: paths.slice(1),
          info: {
            distance: formatRemainingMeters(remainingMeters),
            duration: formatDurationMinutes(minutes),
          },
        };
      }
    }
  } catch {
    // fall through to Google or straight-line
  }

  try {
    const apiKey = process?.env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      const apiMode = choiceToApiMode(travelChoice);
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${origin.latitude},${origin.longitude}` +
        `&destination=${destination.latitude},${destination.longitude}` +
        `&mode=${apiMode}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes?.length > 0) {
        const route = data.routes[0];
        const points = decodePolyline(route.overview_polyline.points);
        const minutes = remainingMeters / getSpeedMPerMin(travelChoice);
        return {
          path: points,
          alternatives: [],
          info: {
            distance: formatRemainingMeters(remainingMeters),
            duration: formatDurationMinutes(minutes),
          },
        };
      }
    }
  } catch {
    // fall through to straight line
  }

  const minutes = remainingMeters / getSpeedMPerMin(travelChoice);
  return {
    path: [origin, destination],
    alternatives: [],
    info: {
      distance: formatRemainingMeters(remainingMeters),
      duration: formatDurationMinutes(minutes),
    },
  };
}
