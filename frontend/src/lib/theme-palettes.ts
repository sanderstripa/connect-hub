export const DEFAULT_PALETTE = 'midnight-steel' as const;
export const PALETTE_KEY = 'connect-hub-palette';
export const PALETTE_IDS = [
  'classic',
  'graphite-sage',
  'obsidian-champagne',
  'midnight-steel',
] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
export const PALETTE_NAMES: Record<PaletteId, string> = {
  classic: 'Classic Monochrome',
  'graphite-sage': 'Graphite & Sage',
  'obsidian-champagne': 'Obsidian & Champagne',
  'midnight-steel': 'Midnight & Steel',
};
type Base = {
  bg: string;
  surface: string;
  raised: string;
  border: string;
  text: string;
  secondary: string;
  accent: string;
  hover: string;
};
const base = (
  bg: string,
  surface: string,
  raised: string,
  border: string,
  text: string,
  secondary: string,
  accent: string,
  hover: string,
): Base => ({ bg, surface, raised, border, text, secondary, accent, hover });
export const PALETTES: Record<PaletteId, { light: Base; dark: Base }> = {
  classic: {
    light: base(
      '#f7f7f5',
      '#ffffff',
      '#ffffff',
      '#d7d9dd',
      '#171a1d',
      '#6d747e',
      '#171a1d',
      '#363b40',
    ),
    dark: base(
      '#141618',
      '#1c1f22',
      '#25292d',
      '#3c4147',
      '#eceef0',
      '#9399a2',
      '#e7e8ea',
      '#ffffff',
    ),
  },
  'graphite-sage': {
    light: base(
      '#F3F5F0',
      '#FFFFFF',
      '#EAEFE8',
      '#D4DFD3',
      '#1A241D',
      '#637064',
      '#627F64',
      '#4D6B50',
    ),
    dark: base(
      '#121715',
      '#202622',
      '#27302A',
      '#354339',
      '#F3F5F1',
      '#A8B5AA',
      '#8DA78E',
      '#A5BCA5',
    ),
  },
  'obsidian-champagne': {
    light: base(
      '#F5F2ED',
      '#FFFEFB',
      '#EEE7DE',
      '#DCD3C7',
      '#28231E',
      '#766B5E',
      '#96764A',
      '#7D603A',
    ),
    dark: base(
      '#151515',
      '#22211F',
      '#2B2925',
      '#403B33',
      '#F4F0E8',
      '#B5AEA2',
      '#C2A578',
      '#D3BA90',
    ),
  },
  'midnight-steel': {
    light: base(
      '#F2F6F9',
      '#FFFFFF',
      '#E9F0F5',
      '#D3DFE8',
      '#1A2937',
      '#637789',
      '#627F98',
      '#4F6B83',
    ),
    dark: base(
      '#10161E',
      '#1C252F',
      '#24313E',
      '#344353',
      '#F2F6F9',
      '#9DABB8',
      '#849EB5',
      '#A0B7CA',
    ),
  },
};
export function parsePalette(value: unknown): PaletteId {
  return PALETTE_IDS.includes(value as PaletteId) ? (value as PaletteId) : DEFAULT_PALETTE;
}
const rgb = (hex: string) =>
  hex
    .slice(1)
    .match(/../g)!
    .map((v) => parseInt(v, 16));
export function mix(a: string, b: string, weight: number): string {
  const x = rgb(a),
    y = rgb(b);
  return (
    '#' +
    x
      .map((v, i) =>
        Math.round(v * (1 - weight) + y[i] * weight)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function contrast(a: string, b: string): number {
  const lum = (c: string) =>
    rgb(c)
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function readable(color: string, surfaces: string[], dark: boolean, ratio = 4.5): string {
  let result = color;
  for (let i = 0; i < 24 && surfaces.some((s) => contrast(result, s) < ratio); i++)
    result = mix(result, dark ? '#ffffff' : '#000000', 0.07);
  return result;
}
export function themeTokens(id: PaletteId, dark: boolean) {
  const b = PALETTES[id][dark ? 'dark' : 'light'],
    surfaces = [b.bg, b.surface, b.raised];
  const secondary = id === 'classic' ? b.secondary : readable(b.secondary, surfaces, dark);
  const foreground =
    id === 'classic'
      ? dark
        ? '#101214'
        : '#ffffff'
      : !dark
        ? '#ffffff'
        : contrast(b.accent, '#ffffff') > contrast(b.accent, '#000000')
          ? '#ffffff'
          : '#000000';
  return {
    ...b,
    secondary,
    foreground,
    button: id === 'classic' || dark ? b.accent : readable(b.accent, ['#ffffff'], false),
    buttonHover: id === 'classic' || dark ? b.hover : readable(b.hover, ['#ffffff'], false),
    subtle:
      id === 'classic'
        ? dark
          ? '#232629'
          : '#e9eaec'
        : mix(b.surface, b.accent, dark ? 0.19 : 0.12),
    controlBorder:
      id === 'classic' ? b.border : readable(mix(b.surface, b.text, 0.4), surfaces, dark, 3),
    chartPrimary: id === 'classic' ? '#1890ff' : readable(b.accent, surfaces, dark, 3),
    chartSecondary: secondary,
    chartThird: readable(mix(b.accent, b.text, 0.5), surfaces, dark, 3),
    success: dark ? '#8ac99b' : '#28723f',
    warning: dark ? '#e1b76b' : '#825400',
    error: dark ? '#ff9b9b' : '#b4232c',
    info: dark ? '#9ebdde' : '#245d88',
  };
}
export function themeVariables(id: PaletteId, dark: boolean): Record<string, string> {
  const t = themeTokens(id, dark);
  return {
    'app-bg': t.bg,
    surface: t.surface,
    'surface-raised': t.raised,
    'surface-hover': t.subtle,
    border: t.border,
    'border-strong': t.controlBorder,
    'text-primary': t.text,
    'text-secondary': t.secondary,
    'text-muted': t.secondary,
    accent: t.accent,
    'accent-hover': t.hover,
    'accent-subtle': t.subtle,
    'accent-foreground': t.foreground,
    'button-bg': t.button,
    'button-hover': t.buttonHover,
    'accent-hover-foreground': !dark
      ? '#ffffff'
      : contrast(t.hover, '#ffffff') > contrast(t.hover, '#000000')
        ? '#ffffff'
        : '#000000',
    'control-bg': t.surface,
    'control-border': t.controlBorder,
    'control-disabled': t.raised,
    'focus-ring': t.accent,
    'chart-primary': t.chartPrimary,
    'chart-secondary': t.chartSecondary,
    'chart-third': t.chartThird,
    'chart-grid': id === 'classic' ? 'rgba(128, 128, 140, 0.35)' : mix(t.surface, t.text, 0.22),
    'chart-fill': mix(t.surface, t.chartPrimary, 0.18),
    'status-success': t.success,
    'status-warning': t.warning,
    'status-error': t.error,
    'status-info': t.info,
    'status-disabled': t.secondary,
    'status-error-foreground':
      contrast(t.error, '#ffffff') > contrast(t.error, '#000000') ? '#ffffff' : '#000000',
    'connect-bg': t.bg,
    'connect-card': t.surface,
    'connect-text': t.text,
    'connect-muted': t.secondary,
    'connect-border': t.border,
  };
}
// Both early HTML paint and the existing React provider use these same tokens.
export function themeCSS(): string {
  return PALETTE_IDS.flatMap((id) =>
    [false, true].map(
      (dark) =>
        `html[data-palette="${id}"][data-mode="${dark ? 'dark' : 'light'}"]{${Object.entries(
          themeVariables(id, dark),
        )
          .map(([k, v]) => `--${k}:${v}`)
          .join(
            ';',
          )};background:${themeTokens(id, dark).bg};color-scheme:${dark ? 'dark' : 'light'}}`,
    ),
  ).join('\n');
}
