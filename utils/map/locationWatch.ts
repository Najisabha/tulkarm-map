import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type LocationWatchHandle = { remove: () => void };

/**
 * On web, tearing down `expo-location` watches calls `removeSubscription`,
 * which is not available on RN-web's event emitter; use the Geolocation API
 * directly there. On native we delegate to `expo-location`.
 */
export async function watchPositionWebOrNative(
  mode: 'routing' | 'general',
  onCoords: (latitude: number, longitude: number) => void,
): Promise<LocationWatchHandle> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => onCoords(pos.coords.latitude, pos.coords.longitude),
      () => {},
      {
        enableHighAccuracy: mode === 'routing',
        maximumAge: mode === 'routing' ? 500 : 3000,
        timeout: 20000,
      },
    );
    return { remove: () => navigator.geolocation.clearWatch(watchId) };
  }

  const opts =
    mode === 'routing'
      ? { accuracy: Location.Accuracy.High, distanceInterval: 8 }
      : { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 };
  return Location.watchPositionAsync(opts, (loc) => {
    onCoords(loc.coords.latitude, loc.coords.longitude);
  });
}
