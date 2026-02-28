import { MD3LightTheme } from 'react-native-paper';
import { PersonalityType } from '../types';

// ---------------------------------------------------------------------------
// HSL ↔ Hex conversion utilities for care mode desaturation
// ---------------------------------------------------------------------------

function hexToHsl(hex: string): [number, number, number] {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 50];

  var r = parseInt(result[1], 16) / 255;
  var g = parseInt(result[2], 16) / 255;
  var b = parseInt(result[3], 16) / 255;

  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var h = 0;
  var s = 0;
  var l = (max + min) / 2;

  if (max !== min) {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
  }

  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  var r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    var hue2rgb = function (p: number, q: number, t: number) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  var toHex = function (x: number) {
    var hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function desaturateHex(hex: string, amount: number): string {
  var hsl = hexToHsl(hex);
  return hslToHex(hsl[0], Math.max(0, hsl[1] - amount), hsl[2]);
}

export function getCareTheme(personality: PersonalityType) {
  var base = themes[personality];
  var desaturatedColors: Record<string, any> = {};
  var keys = Object.keys(base.colors) as Array<keyof typeof base.colors>;

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var val = base.colors[key];
    if (typeof val === 'string' && val.startsWith('#') && val.length === 7) {
      desaturatedColors[key] = desaturateHex(val, 40);
    } else {
      desaturatedColors[key] = val;
    }
  }

  return {
    ...base,
    colors: {
      ...base.colors,
      ...desaturatedColors,
    },
  };
}

// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------

const baseTheme = {
  ...MD3LightTheme,
};

export const themes: Record<PersonalityType, typeof baseTheme> = {
  standard: {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: '#6366F1',
      primaryContainer: '#E0E7FF',
      secondary: '#8B5CF6',
      secondaryContainer: '#EDE9FE',
      tertiary: '#06B6D4',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      surfaceVariant: '#F1F5F9',
      error: '#EF4444',
      onPrimary: '#FFFFFF',
      onBackground: '#1E293B',
      onSurface: '#334155',
      outline: '#CBD5E1',
    },
  },
  yuru: {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: '#F472B6',
      primaryContainer: '#FFF1F2',
      secondary: '#FB923C',
      secondaryContainer: '#FFF7ED',
      tertiary: '#FBBF24',
      background: '#FFFBEB',
      surface: '#FFFFFF',
      surfaceVariant: '#FFF1F2',
      error: '#FB7185',
      onPrimary: '#FFFFFF',
      onBackground: '#78350F',
      onSurface: '#92400E',
      outline: '#FED7AA',
    },
  },
  maji: {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: '#3B82F6',
      primaryContainer: '#1E293B',
      secondary: '#64748B',
      secondaryContainer: '#334155',
      tertiary: '#06B6D4',
      background: '#0F172A',
      surface: '#1E293B',
      surfaceVariant: '#334155',
      error: '#EF4444',
      onPrimary: '#FFFFFF',
      onBackground: '#E2E8F0',
      onSurface: '#CBD5E1',
      outline: '#475569',
    },
  },
};
