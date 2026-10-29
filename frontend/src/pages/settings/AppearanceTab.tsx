import { useTranslation } from 'react-i18next';
import { Radio, Typography } from 'antd';
import { useTheme } from '@/hooks/useTheme';
import { themeTokens } from '@/lib/theme-palettes';

export default function AppearanceTab() {
  const { t } = useTranslation();
  const { palette, isDark, toggleTheme } = useTheme();
  return (
    <section className="appearance-settings">
      <Typography.Title level={4}>{t('appearance.title')}</Typography.Title>
      <Typography.Paragraph type="secondary">{t('appearance.subtitle')}</Typography.Paragraph>
      <div className="soulu-preview" aria-label={t('appearance.palette')}>
        <span className="palette-preview" aria-hidden="true">
          {[themeTokens(palette,isDark).bg,themeTokens(palette,isDark).surface,themeTokens(palette,isDark).input,themeTokens(palette,isDark).accent].map((color,i)=><i key={i} style={{background:color}} />)}
        </span><span>Soulu</span>
      </div>
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
