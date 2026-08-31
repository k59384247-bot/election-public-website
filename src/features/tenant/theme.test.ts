import { describe, expect, it } from 'vitest';
import { buildTenantTheme } from './theme';

describe('buildTenantTheme', () => {
  it('returns the global fallback for missing or invalid colors', () => {
    expect(buildTenantTheme(null)).toEqual({});
    expect(buildTenantTheme('not-a-color')).toEqual({});
  });

  it('generates a complete palette from a tenant primary color', () => {
    const theme = buildTenantTheme('#123456');

    expect(theme['--color-wine']).toBe('#123456');
    expect(theme['--color-wine-200']).toBeTruthy();
    expect(theme['--color-wine-500']).toBeTruthy();
    expect(theme['--color-gold']).toBeTruthy();
    expect(theme['--color-gold-100']).toBeTruthy();
    expect(theme['--color-accent-muted']).toContain('0.5');
    expect(theme['--color-accent-wash']).toContain('0.45');
  });

  it('changes the action accent when the tenant primary changes', () => {
    const blueTheme = buildTenantTheme('#123456');
    const redTheme = buildTenantTheme('#900000');

    expect(blueTheme['--color-gold-100']).not.toBe(redTheme['--color-gold-100']);
  });

  it('normalizes shorthand hex colors', () => {
    expect(buildTenantTheme('#345')['--color-wine']).toBe('#334455');
  });
});
