import { expect, it } from 'vitest';
import { contrast, DEFAULT_PALETTE, parsePalette, themeCSS, themeTokens } from '@/lib/theme-palettes';

it('ignores saved legacy appearance options and uses concept 3.0 colors', () => {
  expect(parsePalette('forest')).toBe(DEFAULT_PALETTE);
  expect(themeTokens('forest', true)).toEqual(themeTokens());
  expect(themeTokens()).toMatchObject({
    bg: '#DCDEE4', surface: '#F3F3F6', text: '#17181B', accent: '#252629',
  });
  expect(themeCSS()).toContain(`data-palette="${DEFAULT_PALETTE}"`);
});

it('keeps text and button labels readable', () => {
  const { bg, text, surface, button, foreground } = themeTokens();
  expect(contrast(bg, text)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(surface, text)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(button, foreground)).toBeGreaterThanOrEqual(4.5);
});
