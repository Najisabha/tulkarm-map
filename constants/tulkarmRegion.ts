/**
 * دائرة منطقة مدينة طولكرم والجوار المباشر (طريق 57، دنابة، إرتاح…)
 * — أضيق من محافظة طولكرم بالكامل؛ يجب أن يبقى متطابقاً مع server/src/lib/tulkarmGovernorate.js
 */
/** مركز الدائرة (نقطة المستخدم على الخريطة) */
export const TULKARM_GOVERNORATE_LAT = 32.30787;
export const TULKARM_GOVERNORATE_LNG = 35.0286;
/** ~1.56 كم (نقص 20% عن 1.95 كم) */
export const TULKARM_GOVERNORATE_RADIUS_METERS = 1_560;

/** مركز افتراضي للخرائط والنماذج الإدارية */
export const TULKARM_REGION = {
  latitude: TULKARM_GOVERNORATE_LAT,
  longitude: TULKARM_GOVERNORATE_LNG,
};
