import { Platform } from 'react-native';

interface ShadowOpts {
  color?: string;
  offset?: { width: number; height: number };
  opacity?: number;
  radius?: number;
  elevation?: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Cross-platform shadow: boxShadow on web (avoids deprecation), shadow* on native */
export function shadow(opts: ShadowOpts = {}) {
  const {
    color = '#000',
    offset = { width: 0, height: 0 },
    opacity = 0.2,
    radius = 6,
    elevation,
  } = opts;

  if (Platform.OS === 'web') {
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px 0 ${hexToRgba(color, opacity)}`,
    } as const;
  }

  const base = {
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
  } as const;
  return elevation !== undefined ? { ...base, elevation } : base;
}
