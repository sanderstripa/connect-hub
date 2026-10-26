import { describe, it, expect } from 'vitest';
import {
  PALETTE_IDS,
  PALETTES,
  parsePalette,
  themeTokens,
  themeVariables,
  contrast,
  themeCSS,
} from '@/lib/theme-palettes';
describe('palette contracts', () => {
  it('has eight complete variants and preserves the published Classic colors', () => {
    expect(PALETTE_IDS).toHaveLength(4);
    expect(themeTokens('classic', false).bg).toBe('#f7f7f5');
    expect(themeTokens('classic', true).bg).toBe('#141618');
    for (const id of PALETTE_IDS)
      for (const dark of [false, true]) {
        const tokens = themeVariables(id, dark);
        for (const key of [
          'app-bg',
          'surface',
          'surface-raised',
          'accent',
          'accent-foreground',
          'focus-ring',
          'control-border',
          'chart-primary',
          'chart-grid',
          'status-error',
        ])
          expect(tokens[key]).toBeTruthy();
        expect(themeTokens(id, dark).accent).toBe(PALETTES[id][dark ? 'dark' : 'light'].accent);
      }
  });
  it('keeps secondary text, button labels and control edges readable in the new palettes', () => {
    for (const id of PALETTE_IDS.filter((id) => id !== 'classic'))
      for (const dark of [false, true]) {
        const t = themeTokens(id, dark),
          v = themeVariables(id, dark);
        for (const surface of [t.bg, t.surface, t.raised]) {
          expect(contrast(t.secondary, surface), `${id} secondary`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.controlBorder, surface), `${id} controls`).toBeGreaterThanOrEqual(3);
        }
        expect(contrast(t.accent, t.foreground)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.hover, v['accent-hover-foreground'])).toBeGreaterThanOrEqual(4.5);
        expect(new Set([t.success, t.warning, t.error, t.info]).size).toBe(4);
      }
  });
  it('uses Classic for missing or invalid storage and includes all first-paint selectors', () => {
    for (const value of [null, undefined, '', 'garbage', '__proto__'])
      expect(parsePalette(value)).toBe('classic');
    for (const id of PALETTE_IDS)
      for (const mode of ['dark', 'light'])
        expect(themeCSS()).toContain(`data-palette="${id}"][data-mode="${mode}"`);
  });
});
