export const HEADING_FONT_VALUES = [
  'georgia',
  'space-grotesk',
  'inter',
  'manrope',
  'dm-sans',
  'nunito-sans',
  'rubik',
  'sora',
] as const;

export type HeadingFont = (typeof HEADING_FONT_VALUES)[number];

/**
 * Thurkle remains available for code-owned presentation choices, but is not
 * part of the public tenant branding contract.
 */
export const INTERNAL_HEADING_FONT_VALUES = ['thurkle'] as const;
export type InternalHeadingFont = (typeof INTERNAL_HEADING_FONT_VALUES)[number];
export type CodeHeadingFont = HeadingFont | InternalHeadingFont;

export const DEFAULT_HEADING_FONT: HeadingFont = 'dm-sans';

const HEADING_FONT_SET = new Set<string>(HEADING_FONT_VALUES);

export function isHeadingFont(value: unknown): value is HeadingFont {
  return typeof value === 'string' && HEADING_FONT_SET.has(value);
}

/**
 * Tenant data is public input. Keep the CSS mapping closed over the supported
 * enum instead of allowing arbitrary font-family strings to reach the DOM.
 */
export function normalizeHeadingFont(value: unknown): HeadingFont {
  return isHeadingFont(value) ? value : DEFAULT_HEADING_FONT;
}
