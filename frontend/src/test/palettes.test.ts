import { describe, it, expect } from 'vitest';
import {
  PALETTE_IDS,
  parsePalette,
  themeTokens,
  themeVariables,
  themeCSS,
  contrast,
} from '@/lib/theme-palettes';
describe('Soulu visual contract', () => {
  it('migrates saved palettes without losing light/dark support', () => {
    expect(PALETTE_IDS).toEqual(['soulu', 'warm-sand', 'forest', 'rose', 'lavender', 'warm-taupe']);
    for (const id of PALETTE_IDS) expect(parsePalette(id)).toBe(id);
    for (const value of [null, undefined, 'classic', 'midnight-steel', 'graphite-sage', 'garbage'])
      expect(parsePalette(value)).toBe('soulu');
  });
  it('uses supplied neutral surfaces, blue actions and green VPN states', () => {
    expect(themeTokens('soulu', false)).toMatchObject({
      bg: '#F6F6F8',
      surface: '#F8F8FA',
      text: '#292A2E',
      secondary: '#797B81',
      accent: '#0671FF',
      success: '#087F5B',
    });
    expect(themeTokens('soulu', true)).toMatchObject({
      bg: '#08090B',
      surface: '#111215',
      text: '#EEEEEF',
      secondary: '#96979D',
      accent: '#0671FF',
      success: '#57D6A3',
    });
    for (const dark of [false, true]) {
      expect(themeVariables('soulu', dark)['accent-foreground']).toBe('#FFFFFF');
      expect(themeCSS()).toContain(`data-mode="${dark ? 'dark' : 'light'}"`);
    }
  });
});

it('keeps text and action labels readable in all supplied palettes and modes', () => {
  for (const id of PALETTE_IDS)
    for (const dark of [false, true]) {
      const t = themeTokens(id, dark);
      expect(contrast(t.bg, t.text)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.surface, t.text)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.button, t.foreground)).toBeGreaterThanOrEqual(id === 'soulu' ? 4 : 4.5);
      expect(themeCSS()).toContain(`data-palette="${id}"`);
    }
});
