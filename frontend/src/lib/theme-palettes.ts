export const DEFAULT_PALETTE = 'concept-3' as const;
export const PALETTE_KEY = 'connect-hub-palette';
export const PALETTE_IDS = [DEFAULT_PALETTE] as const;
export type PaletteId = string;
export const PALETTE_NAMES = { [DEFAULT_PALETTE]: 'Connect Hub' };
export const parsePalette = (_value: unknown) => DEFAULT_PALETTE;

export function contrast(a: string, b: string): number {
  const lum = (color: string) =>
    color.slice(1).match(/../g)!
      .map((value) => parseInt(value, 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function themeTokens(_id: PaletteId = DEFAULT_PALETTE, _dark = false) {
  return {
    bg: '#DCDEE4',
    surface: '#F3F3F6',
    raised: '#F8F8FA',
    input: '#EDEEF2',
    border: '#D5D7DD',
    text: '#17181B',
    secondary: '#565A64',
    accent: '#252629',
    hover: '#45464A',
    foreground: '#FFFFFF',
    button: '#252629',
    buttonHover: '#45464A',
    subtle: '#E8E9ED',
    controlBorder: '#C7C9D0',
    chartPrimary: '#252629',
    chartSecondary: '#777C86',
    chartThird: '#748B17',
    success: '#536313',
    warning: '#82540B',
    error: '#AE3444',
    info: '#45464A',
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
    'accent-hover-foreground': contrast(t.hover, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#000000',
    'control-bg': t.input,
    'control-border': t.controlBorder,
    'control-disabled': t.raised,
    'focus-ring': t.accent,
    'chart-primary': t.chartPrimary,
    'chart-secondary': t.chartSecondary,
    'chart-third': t.chartThird,
    'chart-grid': t.border,
    'chart-fill': t.subtle,
    'status-success': t.success,
    'status-warning': t.warning,
    'status-error': t.error,
    'status-info': t.info,
    'status-disabled': t.secondary,
    'status-error-foreground': '#FFFFFF',
    'connect-bg': t.bg,
    'connect-card': t.surface,
    'connect-text': t.text,
    'connect-muted': t.secondary,
    'connect-border': t.border,
  };
}
export function themeCSS(): string {
  const variables = Object.entries(themeVariables(DEFAULT_PALETTE, false))
    .map(([key, value]) => `--${key}:${value}`)
    .join(';');
  return `html[data-palette="${DEFAULT_PALETTE}"]{${variables};background:var(--app-bg);color-scheme:light}`;
}
