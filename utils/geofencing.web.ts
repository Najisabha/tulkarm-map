export const GEOFENCING_TASK = 'TULKARM_GEOFENCING_TASK';

/** محافظة طولكرم - حدود كاملة (المدينة + واد الشعير + الشعراوية + كل القرى) */
export const TULKARM_BOUNDS = {
  minLat: 32.19,
  maxLat: 32.47,
  minLng: 35.0,
  maxLng: 35.18,
};

export const TULKARM_REGION = {
  identifier: 'tulkarm-governorate',
  latitude: 32.327,
  longitude: 35.088,
  radius: 20_000,
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
  const { minLat, maxLat, minLng, maxLng } = TULKARM_BOUNDS;
  return (
    latitude >= minLat &&
    latitude <= maxLat &&
    longitude >= minLng &&
    longitude <= maxLng
  );
}
