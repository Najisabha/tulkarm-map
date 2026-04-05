import {
  TULKARM_GOVERNORATE_LAT,
  TULKARM_GOVERNORATE_LNG,
  TULKARM_GOVERNORATE_RADIUS_METERS,
} from '../constants/tulkarmRegion';
import { isInsideTulkarm as isInsideTulkarmGovernorate } from './tulkarmGovernorate';

export const GEOFENCING_TASK = 'TULKARM_GEOFENCING_TASK';

/** مرجع تقريبي لمنطقة المدينة (عرض فقط؛ التحقق الفعلي بالدائرة في tulkarmGovernorate) */
export const TULKARM_BOUNDS = {
  minLat: 32.294,
  maxLat: 32.322,
  minLng: 35.012,
  maxLng: 35.045,
};

export const TULKARM_REGION = {
  identifier: 'tulkarm-governorate',
  latitude: TULKARM_GOVERNORATE_LAT,
  longitude: TULKARM_GOVERNORATE_LNG,
  radius: TULKARM_GOVERNORATE_RADIUS_METERS,
  notifyOnEnter: true,
  notifyOnExit: true,
};

export { isInsideTulkarmGovernorate as isInsideTulkarm };

export async function requestPermissions(): Promise<boolean> {
  return false;
}

export async function startGeofencing(): Promise<void> {
  // Not supported on web
}

export async function stopGeofencing(): Promise<void> {
  // Not supported on web
}
