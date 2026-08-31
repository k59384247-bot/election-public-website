interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

export type TenantThemeStyle = Record<string, string>;

const WHITE: RgbColor = { r: 255, g: 255, b: 255 };
const BLACK: RgbColor = { r: 0, g: 0, b: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseHexColor(value: string): RgbColor | null {
  const hex = value.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return null;

  const normalized = hex.length === 3
    ? hex.split('').map((digit) => `${digit}${digit}`).join('')
    : hex;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: lightness };

  const delta = max - min;
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);
  let hue: number;

  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
  }

  return { h: hue * 60, s: saturation, l: lightness };
}

function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const hue = ((h % 360) + 360) % 360 / 360;

  if (s === 0) {
    const channel = l * 255;
    return { r: channel, g: channel, b: channel };
  }

  const hueToRgb = (p: number, q: number, t: number): number => {
    let adjusted = t;
    if (adjusted < 0) adjusted += 1;
    if (adjusted > 1) adjusted -= 1;
    if (adjusted < 1 / 6) return p + (q - p) * 6 * adjusted;
    if (adjusted < 1 / 2) return q;
    if (adjusted < 2 / 3) return p + (q - p) * (2 / 3 - adjusted) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: hueToRgb(p, q, hue + 1 / 3) * 255,
    g: hueToRgb(p, q, hue) * 255,
    b: hueToRgb(p, q, hue - 1 / 3) * 255,
  };
}

function mix(first: RgbColor, second: RgbColor, secondWeight: number): RgbColor {
  const weight = clamp(secondWeight, 0, 1);
  return {
    r: first.r * (1 - weight) + second.r * weight,
    g: first.g * (1 - weight) + second.g * weight,
    b: first.b * (1 - weight) + second.b * weight,
  };
}

function channelLuminance(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color: RgbColor): number {
  return 0.2126 * channelLuminance(color.r)
    + 0.7152 * channelLuminance(color.g)
    + 0.0722 * channelLuminance(color.b);
}

function contrastRatio(first: RgbColor, second: RgbColor): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Darkens a color only as much as needed to remain readable on white. */
function readableOnWhite(color: RgbColor): RgbColor {
  if (contrastRatio(color, WHITE) >= 4.5) return color;

  const hsl = rgbToHsl(color);
  for (let lightness = hsl.l; lightness >= 0; lightness -= 0.02) {
    const candidate = hslToRgb({ ...hsl, l: lightness });
    if (contrastRatio(candidate, WHITE) >= 4.5) return candidate;
  }

  return BLACK;
}

function rgba(color: RgbColor, alpha: number): string {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
}

/**
 * Builds the complete tenant palette from one valid hex primary color.
 * Invalid or missing values return an empty style so the global AMSUL tokens
 * remain the safe fallback.
 */
export function buildTenantTheme(primaryColor: string | null): TenantThemeStyle {
  if (!primaryColor) return {};

  const parsedPrimary = parseHexColor(primaryColor);
  if (!parsedPrimary) return {};

  const primary = readableOnWhite(parsedPrimary);
  const primaryHsl = rgbToHsl(parsedPrimary);
  const primarySoft = readableOnWhite(
    hslToRgb({
      ...primaryHsl,
      l: clamp(primaryHsl.l + 0.12, 0.2, 0.72),
    })
  );
  const primaryDeep = mix(primary, BLACK, 0.28);

  // The action accent is complementary to the tenant brand color. It is
  // deliberately light enough for dark text, preserving the CTA's current
  // light-accent role while allowing every tenant to have its own palette.
  const accentHsl: HslColor = {
    h: primaryHsl.h + 180,
    s: clamp(primaryHsl.s * 0.9 + 0.12, 0.42, 0.78),
    l: 0.76,
  };
  const accent = hslToRgb({ ...accentHsl, l: 0.62 });
  const accentSoft = hslToRgb(accentHsl);
  const accentSubtle = rgba(accentSoft, 0.05);
  const accentMedium = rgba(accentSoft, 0.5);
  const accentWash = rgba(accentSoft, 0.45);
  const accentSkeletonLow = rgba(accentSoft, 0.08);
  const accentSkeletonHigh = rgba(accentSoft, 0.18);

  // Keep the action fill readable with the existing dark button text.
  const actionFill = contrastRatio(accentSoft, BLACK) >= 4.5
    ? accentSoft
    : hslToRgb({ ...accentHsl, l: 0.86 });

  return {
    '--color-wine': rgbToHex(primary),
    '--color-wine-200': rgbToHex(primarySoft),
    '--color-wine-500': rgbToHex(primaryDeep),
    '--color-gold': rgbToHex(accent),
    '--color-gold-100': rgbToHex(actionFill),
    '--color-amber': rgbToHex(accent),
    '--color-selected-bg': rgbToHex(mix(actionFill, WHITE, 0.72)),
    '--color-accent-muted': rgba(actionFill, 0.5),
    '--color-accent-subtle': accentSubtle,
    '--color-accent-medium': accentMedium,
    '--color-accent-wash': accentWash,
    '--color-accent-skeleton-low': accentSkeletonLow,
    '--color-accent-skeleton-high': accentSkeletonHigh,
    '--color-primary-overlay': rgba(primaryDeep, 0.8),
  };
}
