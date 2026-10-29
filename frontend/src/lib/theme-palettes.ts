// Soulu design system. Legacy palette IDs migrate without changing data or mode.
export const DEFAULT_PALETTE = 'soulu' as const;
export const PALETTE_KEY = 'connect-hub-palette';
export const PALETTE_IDS = ['soulu'] as const;
export type PaletteId = 'soulu' | 'classic' | 'graphite-sage' | 'obsidian-champagne' | 'midnight-steel';
export const PALETTE_NAMES: Record<PaletteId,string> = {soulu:'Soulu',classic:'Soulu','graphite-sage':'Soulu','obsidian-champagne':'Soulu','midnight-steel':'Soulu'};
const soulu = {
 light:{bg:'#F6F6F8',surface:'#F8F8FA',raised:'#FCFCFD',input:'#FFFFFF',border:'#0000001F',text:'#292A2E',secondary:'#797B81',accent:'#0671FF',hover:'#005DDA'},
 dark:{bg:'#08090B',surface:'#111215',raised:'#16171B',input:'#16171B',border:'#FFFFFF17',text:'#EEEEEF',secondary:'#96979D',accent:'#0671FF',hover:'#2584FF'},
};
export const PALETTES = {soulu,classic:soulu,'graphite-sage':soulu,'obsidian-champagne':soulu,'midnight-steel':soulu};
export function parsePalette(_value: unknown): PaletteId { return DEFAULT_PALETTE; }
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

export function themeTokens(_id: PaletteId, dark: boolean) {
 const b=soulu[dark?'dark':'light'];
 return {...b,foreground:'#FFFFFF',button:b.accent,buttonHover:b.hover,
 subtle:dark?'#102039':'#EAF2FF',controlBorder:b.border,
 chartPrimary:b.accent,chartSecondary:b.secondary,chartThird:dark?'#57D6A3':'#087F5B',
 success:dark?'#57D6A3':'#087F5B',warning:dark?'#E6B66B':'#9A640D',error:dark?'#F47983':'#C13C4B',info:b.accent};
}
export function themeVariables(id: PaletteId, dark: boolean): Record<string,string> {
 const t=themeTokens(id,dark);
 return {'app-bg':t.bg,surface:t.surface,'surface-raised':t.raised,'surface-hover':t.subtle,border:t.border,'border-strong':t.controlBorder,
 'text-primary':t.text,'text-secondary':t.secondary,'text-muted':t.secondary,accent:t.accent,'accent-hover':t.hover,'accent-subtle':t.subtle,'accent-foreground':'#FFFFFF',
 'button-bg':t.button,'button-hover':t.buttonHover,'accent-hover-foreground':'#FFFFFF','control-bg':t.input,'control-border':t.controlBorder,'control-disabled':t.raised,'focus-ring':t.accent,
 'chart-primary':t.chartPrimary,'chart-secondary':t.chartSecondary,'chart-third':t.chartThird,'chart-grid':t.border,'chart-fill':dark?'#102039':'#EAF2FF',
 'status-success':t.success,'status-warning':t.warning,'status-error':t.error,'status-info':t.info,'status-disabled':t.secondary,'status-error-foreground':'#FFFFFF',
 'connect-bg':t.bg,'connect-card':t.surface,'connect-text':t.text,'connect-muted':t.secondary,'connect-border':t.border};
}
export function themeCSS(): string {
 return [false,true].map(dark=>`html[data-palette="soulu"][data-mode="${dark?'dark':'light'}"]{${Object.entries(themeVariables('soulu',dark)).map(([k,v])=>`--${k}:${v}`).join(';')};background:${themeTokens('soulu',dark).bg};color-scheme:${dark?'dark':'light'}}`).join('\n');
}
