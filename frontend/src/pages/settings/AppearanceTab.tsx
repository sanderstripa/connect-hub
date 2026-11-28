import { Card, Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { THEME_MODES } from '@/lib/theme-palettes';

export default function AppearanceTab() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const title = t('pages.settings.appearance', { defaultValue: 'Appearance' });
  const labels = {
    system: t('pages.settings.themeSystem', { defaultValue: 'System' }),
    light: t('pages.settings.themeLight', { defaultValue: 'Light' }),
    dark: t('pages.settings.themeDark', { defaultValue: 'Dark' }),
  };

  return (
    <Card title={title}>
      <Radio.Group
        aria-label={title}
        value={mode}
        options={THEME_MODES.map((value) => ({ value, label: labels[value] }))}
        onChange={({ target }) => setMode(target.value)}
      />
    </Card>
  );
}
