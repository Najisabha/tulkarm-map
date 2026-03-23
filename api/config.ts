/**
 * عنوان الخادم (API)
 * ضع في .env:
 *   EXPO_PUBLIC_API_URL=http://localhost:3000
 *   EXPO_PUBLIC_USE_API=true
 *
 * - للحاسوب/الويب: http://localhost:3000
 * - لجهاز Android محاكي: http://10.0.2.2:3000
 * - لجهاز حقيقي: http://192.168.x.x:3000 (IP جهازك على الشبكة)
 */
export const API_URL =
  (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:3000';

/** استخدام API بدلاً من AsyncStorage */
export const USE_API =
  (typeof process !== 'undefined' &&
    (process as any).env?.EXPO_PUBLIC_USE_API === 'true') ||
  false;
