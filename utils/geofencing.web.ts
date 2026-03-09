export const GEOFENCING_TASK = 'TULKARM_GEOFENCING_TASK';

export const TULKARM_REGION = {
  identifier: 'tulkarm-city',
  latitude: 32.3104,
  longitude: 35.0288,
  radius: 5000,
  notifyOnEnter: true,
  notifyOnExit: true,
};

export async function requestPermissions(): Promise<boolean> {
  return false;
}

export async function startGeofencing(): Promise<void> {
  // Not supported on web
}

export async function stopGeofencing(): Promise<void> {
  // Not supported on web
}

export function isInsideTulkarm(latitude: number, longitude: number): boolean {
  const dx = latitude - TULKARM_REGION.latitude;
  const dy = longitude - TULKARM_REGION.longitude;
  const distanceKm = Math.sqrt(dx * dx + dy * dy) * 111;
  return distanceKm * 1000 <= TULKARM_REGION.radius;
}
