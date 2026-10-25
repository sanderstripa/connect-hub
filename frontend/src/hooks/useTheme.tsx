// Connect. Hub: two explicit monochrome themes. Fonts are bundled locally.
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';
import '@/styles/connect-brand.css';
import '@/styles/connect-density.css';
const initialDark = localStorage.getItem('dark-mode') !== 'false';
function applyDom(dark: boolean) {
  document.body.classList.remove('dark', 'light'); document.body.classList.add(dark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.removeAttribute('data-theme'); localStorage.removeItem('isUltraDarkThemeEnabled');
  const msg = document.getElementById('message');
  if (msg) { msg.classList.remove('dark', 'light'); msg.classList.add(dark ? 'dark' : 'light'); }
}
applyDom(initialDark);
export function buildAntdThemeConfig(dark: boolean, _legacyUltra = false): ThemeConfig {
  const bg = dark ? '#141618' : '#f7f7f5', card = dark ? '#1c1f22' : '#ffffff';
  const text = dark ? '#eceef0' : '#171a1d', muted = dark ? '#9399a2' : '#6d747e';
  const border = dark ? '#3c4147' : '#d7d9dd', primary = dark ? '#e7e8ea' : '#171a1d';
  return {
    hashed: false, cssVar: { key: 'xui' }, algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: { fontFamily: 'Montserrat, sans-serif', fontFamilyCode: 'Montserrat, sans-serif',
      colorBgBase: bg, colorBgLayout: bg, colorBgContainer: card, colorBgElevated: dark ? '#25292d' : '#ffffff',
      colorText: text, colorTextSecondary: muted, colorTextDescription: muted, colorTextTertiary: muted, colorTextPlaceholder: muted,
      colorBorder: border, colorBorderSecondary: border, colorPrimary: primary,
      colorPrimaryHover: dark ? '#ffffff' : '#363b40', colorPrimaryActive: dark ? '#c6c9ce' : '#000000',
      colorLink: text, colorLinkHover: muted, colorTextLightSolid: dark ? '#101214' : '#ffffff',
      colorPrimaryBg: dark ? '#232629' : '#e9eaec', borderRadius: 8,
      controlHeight: 34, controlHeightSM: 34, controlHeightLG: 34, fontSize: 13, lineHeight: 1.54 },
    components: {
      Layout: { bodyBg: bg, headerBg: bg, footerBg: bg, siderBg: bg, headerColor: text },
      Menu: { darkItemBg: bg, darkSubMenuItemBg: bg, darkPopupBg: card, darkItemSelectedBg: '#232629', darkItemSelectedColor: '#ffffff', itemSelectedBg: dark ? '#232629' : '#e9eaec', itemSelectedColor: text },
      Button: { primaryColor: dark ? '#101214' : '#ffffff', primaryShadow: 'none' },
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
}
export function pauseAnimationsUntilLeave(elementId: string): void {
  document.documentElement.setAttribute('data-theme-animations', 'off'); const el = document.getElementById(elementId); if (!el) return;
  const restore = () => { document.documentElement.removeAttribute('data-theme-animations'); el.removeEventListener('mouseleave', restore); el.removeEventListener('touchend', restore); };
  el.addEventListener('mouseleave', restore); el.addEventListener('touchend', restore);
}
interface ThemeContextValue { isDark: boolean; isUltra: boolean; toggleTheme: () => void; toggleUltra: () => void; antdThemeConfig: ThemeConfig; }
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(initialDark);
  useLayoutEffect(() => { applyDom(isDark); localStorage.setItem('dark-mode', String(isDark)); }, [isDark]);
  const toggleTheme = useCallback(() => setIsDark(v => !v), []);
  // Compatibility for upstream consumers; no third theme remains selectable.
  const toggleUltra = useCallback(() => {}, []);
  const antdThemeConfig = useMemo(() => buildAntdThemeConfig(isDark), [isDark]);
  const value = useMemo(() => ({ isDark, isUltra: false, toggleTheme, toggleUltra, antdThemeConfig }), [isDark, toggleTheme, toggleUltra, antdThemeConfig]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme(): ThemeContextValue { const ctx = useContext(ThemeContext); if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>'); return ctx; }
