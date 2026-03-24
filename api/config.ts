/**
 * عنوان خادم الـ API (مجلد server/ — نفس PORT في server/.env).
 *
 * في وضع التطوير: إذا كان EXPO_PUBLIC_API_URL يشير لنطاق Vercel/واجهة ثابتة فقط
 * (بدون مسارات /api/*)، يُشتق تلقائياً عنوان الـ API من مضيف Metro (نفس IP جهازك)
 * حتى يعمل التطبيق من هاتف حقيقي أو محاكي دون تعديل يدوي لكل شبكة.
 *
 * يمكنك تجاوز المنفذ: EXPO_PUBLIC_API_PORT=3000
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = '3000';

function envPort(): string {
  const raw =
    typeof process !== 'undefined' ? (process as { env?: Record<string, string> }).env?.EXPO_PUBLIC_API_PORT : undefined;
  const p = typeof raw === 'string' ? raw.trim() : '';
  return p || DEFAULT_PORT;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function getExpoDevHost(): string | null {
  try {
    const expoConfig = Constants.expoConfig as { hostUri?: string } | null | undefined;
    const expoGo = Constants.expoGoConfig as { debuggerHost?: string } | null | undefined;
    const manifest = Constants.manifest as { debuggerHost?: string } | null | undefined;
    const manifest2 = Constants.manifest2 as {
      extra?: { expoClient?: { hostUri?: string }; expoGo?: { debuggerHost?: string } };
      debuggerHost?: string;
    } | null | undefined;

    const candidates = [
      expoConfig?.hostUri,
      expoGo?.debuggerHost,
      manifest?.debuggerHost,
      manifest2?.extra?.expoGo?.debuggerHost,
      manifest2?.extra?.expoClient?.hostUri,
      manifest2?.debuggerHost,
    ];

    for (const v of candidates) {
      if (typeof v === 'string' && v.trim().length > 0) {
        return v.trim();
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** نطاقات غالباً لا تخدم Express API تحت /api من نفس الأصل */
function looksLikeFrontendOnlyHost(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('vercel.app') || u.includes('netlify.app') || u.includes('github.io');
}

function isLikelyTunnelHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.includes('ngrok') || h.includes('exp.direct');
}

function deriveApiUrlFromExpoHost(): string | null {
  const host = getExpoDevHost();
  if (!host) return null;
  // قد يكون "192.168.1.5:8081" أو "localhost:8081"
  const hostname = host.split(':')[0];
  if (!hostname) return null;
  if (isLikelyTunnelHostname(hostname)) return null;
  return `http://${hostname}:${envPort()}`;
}

function isDev(): boolean {
  try {
    return typeof __DEV__ !== 'undefined' && __DEV__;
  } catch {
    return process.env.NODE_ENV !== 'production';
  }
}

/**
 * يُفضَّل استدعاؤها عند كل طلب حتى يبقى العنوان صحيحاً بعد إعادة تحميل Metro.
 */
export function getApiUrl(): string {
  const rawEnv =
    typeof process !== 'undefined'
      ? (process as { env?: Record<string, string> }).env?.EXPO_PUBLIC_API_URL
      : undefined;
  const envUrl = typeof rawEnv === 'string' && rawEnv.trim() ? stripTrailingSlash(rawEnv.trim()) : '';

  const dev = isDev();

  if (dev && envUrl && looksLikeFrontendOnlyHost(envUrl)) {
    const derived = deriveApiUrlFromExpoHost();
    if (derived) {
      return derived;
    }
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${envPort()}`;
    }
    return `http://127.0.0.1:${envPort()}`;
  }

  return envUrl || `http://127.0.0.1:${envPort()}`;
}

/** @deprecated استخدم getApiUrl() لضمان العنوان الصحيح بعد اشتقاق المضيف */
export const API_URL = getApiUrl();

/** استخدام API بدلاً من التخزين المحلي فقط */
export const USE_API =
  (typeof process !== 'undefined' &&
    (process as { env?: Record<string, string> }).env?.EXPO_PUBLIC_USE_API === 'true') ||
  false;
