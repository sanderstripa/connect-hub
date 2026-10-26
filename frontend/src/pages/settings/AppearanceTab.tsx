import { useTranslation } from 'react-i18next';
import { Radio, Typography } from 'antd';
import { useTheme } from '@/hooks/useTheme';
import { PALETTE_IDS, PALETTE_NAMES, themeTokens } from '@/lib/theme-palettes';
import type { PaletteId } from '@/lib/theme-palettes';

export default function AppearanceTab() {
  const { t } = useTranslation();
  const { palette, setPalette, isDark, toggleTheme } = useTheme();
  return (
    <section className="appearance-settings">
      <Typography.Title level={4}>{t('appearance.title')}</Typography.Title>
      <Typography.Paragraph type="secondary">{t('appearance.subtitle')}</Typography.Paragraph>
      <Radio.Group
        className="palette-options"
        value={palette}
        onChange={(e) => setPalette(e.target.value as PaletteId)}
        aria-label={t('appearance.palette')}
      >
        {PALETTE_IDS.map((id) => {
          const colors = themeTokens(id, isDark);
          return (
            <Radio
              key={id}
              value={id}
              className="palette-option"
              style={{ borderColor: palette === id ? 'var(--accent)' : 'var(--border)' }}
            >
              <span className="palette-preview" aria-hidden="true">
                {[colors.bg, colors.surface, colors.raised, colors.accent].map((color, i) => (
                  <i key={i} style={{ background: color }} />
                ))}
              </span>
              <span>{PALETTE_NAMES[id]}</span>
            </Radio>
          );
        })}
      </Radio.Group>
      <Typography.Title level={5}>{t('appearance.mode')}</Typography.Title>
      <Radio.Group
        value={isDark ? 'dark' : 'light'}
        onChange={(e) => {
          if ((e.target.value === 'dark') !== isDark) toggleTheme();
        }}
        aria-label={t('appearance.mode')}
      >
        <Radio.Button value="light">{t('appearance.light')}</Radio.Button>
        <Radio.Button value="dark">{t('appearance.dark')}</Radio.Button>
      </Radio.Group>
      <Typography.Paragraph type="secondary" className="appearance-storage-note">
        {t('appearance.local')}
      </Typography.Paragraph>
    </section>
  );
}
