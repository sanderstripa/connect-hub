import { createContext, useContext, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';
import { DEFAULT_PALETTE, themeTokens, themeVariables } from '@/lib/theme-palettes';
import type { PaletteId } from '@/lib/theme-palettes';
import '@/styles/connect-brand.css';
import '@/styles/connect-density.css';
export const ACCENT_CHOICES = { graphite: '#252629' } as const;
export type AccentChoice = keyof typeof ACCENT_CHOICES;

function applyDom() {
  const root = document.documentElement;
  root.dataset.palette = DEFAULT_PALETTE;
  root.dataset.mode = 'light';
  for (const [key, value] of Object.entries(themeVariables(DEFAULT_PALETTE, false))) {
    root.style.setProperty('--' + key, value);
  }
  document.body.classList.remove('dark');
  document.body.classList.add('light');
  root.style.colorScheme = 'light';
}

applyDom();

export function buildAntdThemeConfig(
  _dark = false,
  _legacyUltra = false,
  _palette: PaletteId = DEFAULT_PALETTE,
  _accent?: string,
): ThemeConfig {
  const dark = false;
  const colors = themeTokens(DEFAULT_PALETTE, false);
  const {bg,surface:card,text,secondary:muted,border,accent:primary}=colors;
  const config: ThemeConfig = {
    hashed: false, cssVar: { key: 'xui' }, algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: { fontFamily: "Inter, Segoe UI, Arial, sans-serif", fontFamilyCode: "Inter, Segoe UI, Arial, sans-serif",
      colorBgBase: bg, colorBgLayout: bg, colorBgContainer: card, colorBgElevated: colors.raised,
      colorText: text, colorTextSecondary: muted, colorTextDescription: muted, colorTextTertiary: muted, colorTextPlaceholder: muted,
      colorBorder: border, colorBorderSecondary: border, colorPrimary: primary,
      colorPrimaryHover: dark ? '#ffffff' : '#363b40', colorPrimaryActive: dark ? '#c6c9ce' : '#000000',
      colorLink: primary, colorLinkHover: colors.hover, colorTextLightSolid: '#ffffff',
      colorPrimaryBg: dark ? '#232629' : '#e9eaec', borderRadius: 12,
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
const appearance = {
  isDark: false,
  isUltra: false,
  antdThemeConfig: buildAntdThemeConfig(),
};
const ThemeContext = createContext<typeof appearance | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(applyDom, []);
  return <ThemeContext.Provider value={appearance}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}

export function useChartTheme() {
  return { palette: DEFAULT_PALETTE, colors: themeTokens(DEFAULT_PALETTE, false) };
}
