// Connect. Hub: two explicit monochrome themes. Fonts are bundled locally.
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';
import { DEFAULT_PALETTE, PALETTE_KEY, parsePalette, themeTokens, themeVariables } from '@/lib/theme-palettes';
import type { PaletteId } from '@/lib/theme-palettes';
import '@/styles/connect-brand.css';
import '@/styles/connect-density.css';
import '@/styles/palettes.css';
import '@/styles/glass.css';
export const ACCENT_CHOICES = {blue:'#0671FF',red:'#DC4E58',pink:'#D45597',orange:'#D87832',yellow:'#A97805',green:'#268B65',purple:'#805AD5'} as const;
export type AccentChoice = keyof typeof ACCENT_CHOICES;
const ACCENT_KEY = 'connect-hub-accent';
const GLASS_KEY = 'connect-hub-glass';
const SYSTEM_KEY = 'connect-hub-system-mode';
const readSetting = (key:string) => {try{return localStorage.getItem(key);}catch{return null;}};
const savedAccent = ():AccentChoice => {const value=readSetting(ACCENT_KEY);return value && Object.prototype.hasOwnProperty.call(ACCENT_CHOICES,value) ? value as AccentChoice : 'blue';};
const rgbMix = (a:string,b:string,w:number) => '#'+[0,1,2].map(i=>Math.round(parseInt(a.slice(1+i*2,3+i*2),16)*(1-w)+parseInt(b.slice(1+i*2,3+i*2),16)*w).toString(16).padStart(2,'0')).join('');
const initialDark = (()=>{try{return localStorage.getItem('dark-mode') !== 'false';}catch{return true;}})();
function applyDom(dark: boolean, palette: PaletteId = DEFAULT_PALETTE, accent:AccentChoice = 'blue', glass=false) {
  const root = document.documentElement;
  root.dataset.palette = palette; root.dataset.mode = dark ? 'dark' : 'light';
  for (const [key,value] of Object.entries(themeVariables(palette,dark))) root.style.setProperty('--'+key,value);
  const color=accent==='blue' ? themeTokens(palette,dark).accent : ACCENT_CHOICES[accent];
  const hovered=accent==='blue' ? themeTokens(palette,dark).hover : rgbMix(color,dark?'#FFFFFF':'#000000',0.16);
  root.style.setProperty('--accent',color);root.style.setProperty('--accent-hover',hovered);
  root.style.setProperty('--focus-ring',color);root.style.setProperty('--chart-primary',color);root.style.setProperty('--button-bg',color);root.style.setProperty('--button-hover',hovered);
  root.style.setProperty('--accent-subtle',rgbMix(themeTokens(palette,dark).surface,color,dark?0.18:0.1));
  root.style.setProperty('--accent-foreground',accent==='yellow'?'#161616':'#FFFFFF');
  root.dataset.accent=accent;root.dataset.glass=glass?'on':'off';
  document.body.classList.remove('dark', 'light'); document.body.classList.add(dark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.removeAttribute('data-theme'); try {localStorage.removeItem('isUltraDarkThemeEnabled');} catch { /* Storage can be blocked. */ }
  const msg = document.getElementById('message');
  if (msg) { msg.classList.remove('dark', 'light'); msg.classList.add(dark ? 'dark' : 'light'); }
}
function savedPalette(): PaletteId { try {return parsePalette(localStorage.getItem(PALETTE_KEY));} catch {return DEFAULT_PALETTE;} }
applyDom(initialDark, savedPalette(), savedAccent(), readSetting(GLASS_KEY)==='true');
export function buildAntdThemeConfig(dark: boolean, _legacyUltra = false, palette: PaletteId = DEFAULT_PALETTE, accent: AccentChoice = 'blue'): ThemeConfig {
  const colors=themeTokens(palette,dark);
  if(accent!=='blue') { const color=ACCENT_CHOICES[accent];Object.assign(colors,{accent:color,button:color,hover:rgbMix(color,dark?'#FFFFFF':'#000000',0.16),buttonHover:rgbMix(color,dark?'#FFFFFF':'#000000',0.16),foreground:accent==='yellow'?'#161616':'#FFFFFF',subtle:rgbMix(colors.surface,color,dark?0.18:0.10),chartPrimary:color,info:color});}
  const {bg,surface:card,text,secondary:muted,border,accent:primary}=colors;
  const config: ThemeConfig = {
    hashed: false, cssVar: { key: 'xui' }, algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: { fontFamily: 'Onest, sans-serif', fontFamilyCode: 'Onest, sans-serif',
      colorBgBase: bg, colorBgLayout: bg, colorBgContainer: card, colorBgElevated: colors.raised,
      colorText: text, colorTextSecondary: muted, colorTextDescription: muted, colorTextTertiary: muted, colorTextPlaceholder: muted,
      colorBorder: border, colorBorderSecondary: border, colorPrimary: primary,
      colorPrimaryHover: dark ? '#ffffff' : '#363b40', colorPrimaryActive: dark ? '#c6c9ce' : '#000000',
      colorLink: primary, colorLinkHover: colors.hover, colorTextLightSolid: '#ffffff',
      colorPrimaryBg: dark ? '#232629' : '#e9eaec', borderRadius: 8,
      controlHeight: 34, controlHeightSM: 34, controlHeightLG: 34, fontSize: 14, lineHeight: 1.54 },
    components: {
      Layout: { bodyBg: bg, headerBg: bg, footerBg: bg, siderBg: bg, headerColor: text },
      Menu: { darkItemBg: bg, darkSubMenuItemBg: bg, darkPopupBg: card, darkItemSelectedBg: '#232629', darkItemSelectedColor: '#ffffff', itemSelectedBg: dark ? '#232629' : '#e9eaec', itemSelectedColor: text },
      Button: { primaryColor: '#ffffff', primaryShadow: 'none' },
      Switch: { colorPrimary: primary, colorPrimaryHover: primary, colorTextQuaternary: border,
        trackHeight: 22, trackHeightSM: 22, trackMinWidth: 44, trackMinWidthSM: 44,
        handleSize: 18, handleSizeSM: 18, trackPadding: 2,
        innerMinMargin: 9, innerMinMarginSM: 9, innerMaxMargin: 24, innerMaxMarginSM: 24 },
      Table: { cellPaddingBlock: 8, cellPaddingBlockMD: 8, cellPaddingBlockSM: 8,
        cellPaddingInline: 12, cellPaddingInlineMD: 12, cellPaddingInlineSM: 12 },
      Card: { bodyPadding: 16, bodyPaddingSM: 16, headerPadding: 16, headerPaddingSM: 16,
        headerHeight: 50, headerHeightSM: 50 },
      Form: { itemMarginBottom: 16, verticalLabelPadding: '0 0 8px' },
      Select: { optionHeight: 34, optionSelectedColor: text,
        optionSelectedBg: dark ? '#303338' : '#e9eaec',
        optionActiveBg: dark ? '#25282c' : '#f0f1f2' },
      Pagination: { itemSize: 34, itemSizeSM: 34 },
      Statistic: { contentFontSize: 17, titleFontSize: 11 },
    },
  };
    Object.assign(config.token!, {colorBgElevated:colors.raised, colorPrimaryHover:colors.hover,
      colorPrimaryActive:colors.hover,colorPrimaryBg:colors.subtle,colorTextLightSolid:colors.foreground,
      colorLink:colors.text,colorLinkHover:colors.hover,colorBorder:colors.controlBorder,colorBorderSecondary:border,
      colorSuccess:colors.success,colorWarning:colors.warning,colorError:colors.error,colorInfo:colors.info,
      colorTextDisabled:muted,colorFillAlter:colors.raised,colorFillSecondary:colors.subtle});
    Object.assign(config.components!.Menu!, {darkItemBg:card,darkSubMenuItemBg:card,darkPopupBg:colors.raised,
      darkItemSelectedBg:colors.subtle,darkItemSelectedColor:text,itemSelectedBg:colors.subtle,itemSelectedColor:text,
      itemHoverBg:colors.subtle, darkItemColor:muted, darkItemHoverColor:text});
    Object.assign(config.components!.Layout!, {siderBg:card});
    Object.assign(config.components!.Button!, {primaryColor:colors.foreground,colorPrimary:colors.button,colorPrimaryHover:colors.buttonHover});
    config.components!.Tooltip = {colorBgSpotlight:colors.raised,colorTextLightSolid:colors.text};
    Object.assign(config.components!.Switch!, {colorPrimaryHover:colors.hover,colorTextQuaternary:colors.controlBorder});
    Object.assign(config.components!.Select!, {optionSelectedBg:colors.subtle,optionActiveBg:colors.raised});
    Object.assign(config.components!.Table!, {headerBg:colors.raised,rowHoverBg:colors.subtle,rowSelectedBg:colors.subtle});
  return config;
}
export function pauseAnimationsUntilLeave(elementId: string): void {
  document.documentElement.setAttribute('data-theme-animations', 'off'); const el = document.getElementById(elementId); if (!el) return;
  const restore = () => { document.documentElement.removeAttribute('data-theme-animations'); el.removeEventListener('mouseleave', restore); el.removeEventListener('touchend', restore); };
  el.addEventListener('mouseleave', restore); el.addEventListener('touchend', restore);
}
interface ThemeContextValue { isDark: boolean; isUltra: boolean; palette: PaletteId; setPalette: (id: PaletteId) => void; accent: AccentChoice; setAccent: (id: AccentChoice) => void; glass: boolean; setGlass:(next:boolean)=>void; followSystem:boolean; setFollowSystem:(next:boolean)=>void; toggleTheme: () => void; toggleUltra: () => void; antdThemeConfig: ThemeConfig; }
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(()=>{try{return localStorage.getItem('dark-mode')!=='false';}catch{return initialDark;}});
  const [palette,setPaletteState] = useState<PaletteId>(savedPalette);
  const [accent,setAccentState] = useState<AccentChoice>(savedAccent);
  const [glass,setGlassState] = useState(()=>readSetting(GLASS_KEY)==='true');
  const [followSystem,setFollowSystemState] = useState(()=>readSetting(SYSTEM_KEY)==='true');
  const setAccent=useCallback((next:AccentChoice)=>{if(Object.prototype.hasOwnProperty.call(ACCENT_CHOICES,next))setAccentState(next);},[]);
  const setGlass=useCallback((next:boolean)=>setGlassState(next),[]);
  const setFollowSystem=useCallback((next:boolean)=>setFollowSystemState(next),[]);
  const setPalette=useCallback((id: PaletteId)=>setPaletteState(parsePalette(id)),[]);
  useLayoutEffect(() => { applyDom(isDark,palette,accent,glass); try {localStorage.setItem('dark-mode', String(isDark)); localStorage.setItem(PALETTE_KEY,palette);localStorage.setItem(ACCENT_KEY,accent);localStorage.setItem(GLASS_KEY,String(glass));localStorage.setItem(SYSTEM_KEY,String(followSystem));} catch { /* Private storage must not break rendering. */ } }, [isDark,palette,accent,glass,followSystem]);
  useLayoutEffect(()=>{if(!followSystem || typeof window.matchMedia!=='function')return;const query=window.matchMedia('(prefers-color-scheme: dark)');const sync=()=>setIsDark(query.matches);sync();query.addEventListener?.('change',sync);return()=>query.removeEventListener?.('change',sync)},[followSystem]);
  const toggleTheme = useCallback(() => {setFollowSystemState(false);setIsDark(v => !v);}, []);
  // Compatibility for upstream consumers; no third theme remains selectable.
  const toggleUltra = useCallback(() => {}, []);
  const antdThemeConfig = useMemo(() => buildAntdThemeConfig(isDark,false,palette,accent), [isDark,palette,accent]);
  const value = useMemo(() => ({ isDark, isUltra: false, palette,setPalette,accent,setAccent,glass,setGlass,followSystem,setFollowSystem,toggleTheme,toggleUltra,antdThemeConfig }), [isDark,palette,setPalette,accent,setAccent,glass,setGlass,followSystem,setFollowSystem,toggleTheme,toggleUltra,antdThemeConfig]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme(): ThemeContextValue { const ctx = useContext(ThemeContext); if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>'); return ctx; }
export function useChartTheme() { const ctx=useContext(ThemeContext);const palette=ctx?.palette ?? DEFAULT_PALETTE;return {palette,colors:themeTokens(palette,ctx?.isDark ?? document.body.classList.contains('dark'))}; }
