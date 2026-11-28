import { expect, it } from 'vitest';
import { contrast, DEFAULT_PALETTE, parsePalette, themeCSS, themeTokens } from '@/lib/theme-palettes';

it('ignores saved legacy appearance options and uses concept 3.0 colors', () => {
  expect(parsePalette('forest')).toBe(DEFAULT_PALETTE);
  expect(themeTokens('forest', true)).toEqual(themeTokens(DEFAULT_PALETTE, true));
  expect(themeTokens()).toMatchObject({
    bg: '#DCDEE4', surface: '#F3F3F6', text: '#17181B', accent: '#252629',
  });
  expect(themeCSS()).toContain(`data-palette="${DEFAULT_PALETTE}"`);
});

it('keeps text and button labels readable', () => {
  for (const dark of [false, true]) {
    const { bg, text, surface, secondary, button, foreground } = themeTokens(DEFAULT_PALETTE, dark);
    expect(contrast(bg, text)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(surface, secondary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(button, foreground)).toBeGreaterThanOrEqual(4.5);
  }
});
