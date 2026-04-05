/** يجب أن يبقى متطابقاً مع constants/tulkarmRegion.ts */

import { ApiError } from '../utils/ApiError.js';

export const TULKARM_GOVERNORATE_LAT = 32.30787;
export const TULKARM_GOVERNORATE_LNG = 35.0286;
export const TULKARM_GOVERNORATE_RADIUS_METERS = 1_560;

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isWithinTulkarmGovernorate(lat, lng) {
  return (
    haversineDistanceMeters(TULKARM_GOVERNORATE_LAT, TULKARM_GOVERNORATE_LNG, lat, lng) <=
    TULKARM_GOVERNORATE_RADIUS_METERS
  );
}

export function assertWithinTulkarmGovernorate(lat, lng) {
  if (!isWithinTulkarmGovernorate(lat, lng)) {
    throw ApiError.badRequest(
      'يجب أن يكون الموقع داخل دائرة منطقة طولكرم على الخريطة (المدينة والجوار المباشر فقط).'
    );
  }
}
