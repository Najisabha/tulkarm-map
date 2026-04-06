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

function isLocalhostHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

function isLocalhostApiUrl(url: string): boolean {
  try {
    const u = new URL(url.includes('://') ? url : `http://${url}`);
    return isLocalhostHostname(u.hostname);
  } catch {
    return false;
  }
}

function resolveDevLocalhostApiUrl(url: string): string {
  if (!isDev() || Platform.OS === 'web' || !isLocalhostApiUrl(url)) {
    return stripTrailingSlash(url);
  }

  let port = envPort();
  try {
    const u = new URL(url.includes('://') ? url : `http://${url}`);
    if (u.port) port = u.port;
  } catch {
    /* keep envPort */
  }

  const derived = deriveApiUrlFromExpoHost();
  if (derived) {
    try {
      const dh = new URL(derived).hostname;
      if (!isLikelyTunnelHostname(dh) && !isLocalhostHostname(dh)) {
        return stripTrailingSlash(derived);
      }
    } catch {
      /* fall through */
    }
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${port}`;
  }

  return stripTrailingSlash(url);
}

export function getApiUrl(): string {
  const rawEnv =
    typeof process !== 'undefined'
      ? (process as { env?: Record<string, string> }).env?.EXPO_PUBLIC_API_URL
      : undefined;
  const envUrl = typeof rawEnv === 'string' && rawEnv.trim() ? stripTrailingSlash(rawEnv.trim()) : '';
  const useProvidedApiUrl =
    (typeof process !== 'undefined' &&
      (process as { env?: Record<string, string> }).env?.EXPO_PUBLIC_USE_API === 'true') ||
    false;

  const dev = isDev();

  if (useProvidedApiUrl && envUrl) {
    return resolveDevLocalhostApiUrl(envUrl);
  }

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

  const fallback = envUrl || `http://127.0.0.1:${envPort()}`;
  return resolveDevLocalhostApiUrl(fallback);
}

