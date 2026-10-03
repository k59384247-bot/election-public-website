import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HEADING_FONT,
  HEADING_FONT_VALUES,
  INTERNAL_HEADING_FONT_VALUES,
  isHeadingFont,
  normalizeHeadingFont,
} from './headingFont';

describe('tenant heading font contract', () => {
  it('accepts only the published enum values', () => {
    expect(HEADING_FONT_VALUES).toEqual([
      'georgia',
      'space-grotesk',
      'inter',
      'manrope',
      'dm-sans',
      'nunito-sans',
      'rubik',
      'sora',
    ]);

    expect(isHeadingFont('space-grotesk')).toBe(true);
    expect(isHeadingFont('font-family: Comic Sans')).toBe(false);
    expect(isHeadingFont(null)).toBe(false);
  });

  it('falls back to Georgia for missing or unrecognized values', () => {
    expect(normalizeHeadingFont(undefined)).toBe(DEFAULT_HEADING_FONT);
    expect(normalizeHeadingFont(null)).toBe(DEFAULT_HEADING_FONT);
    expect(normalizeHeadingFont('not-a-supported-font')).toBe(DEFAULT_HEADING_FONT);
    expect(normalizeHeadingFont('sora')).toBe('sora');
  });

  it('keeps Thurkle as an internal option without accepting it from tenant data', () => {
    expect(INTERNAL_HEADING_FONT_VALUES).toEqual(['thurkle']);
    expect(isHeadingFont('thurkle')).toBe(false);
    expect(normalizeHeadingFont('thurkle')).toBe(DEFAULT_HEADING_FONT);
  });
});
