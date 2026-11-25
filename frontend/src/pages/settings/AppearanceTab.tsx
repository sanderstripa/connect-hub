import { Card, Form, Segmented, Select, Switch } from 'antd';
import { useTranslation } from 'react-i18next';

import { ACCENT_CHOICES, useTheme } from '@/hooks/useTheme';
import type { AccentChoice } from '@/hooks/useTheme';
import { PALETTE_IDS, PALETTE_NAMES } from '@/lib/theme-palettes';

type ThemeMode = 'light' | 'dark' | 'system';

export default function AppearanceTab() {
  const { t } = useTranslation();
  const {
    isDark, toggleTheme, followSystem, setFollowSystem, palette, setPalette,
    accent, setAccent, glass, setGlass,
  } = useTheme();

  function changeMode(mode: ThemeMode) {
    if (mode === 'system') {
      setFollowSystem(true);
    } else if (isDark !== (mode === 'dark')) {
      toggleTheme();
    } else {
      setFollowSystem(false);
    }
  }

  return (
    <Card title={t('menu.appearance')}>
      <Form layout="vertical">
        <Form.Item label={t('menu.theme')} htmlFor="theme-mode">
          <Segmented<ThemeMode>
            id="theme-mode"
            value={followSystem ? 'system' : isDark ? 'dark' : 'light'}
            options={[
              { value: 'light', label: t('menu.themeLight') },
              { value: 'dark', label: t('menu.themeDark') },
              { value: 'system', label: t('menu.themeSystem') },
            ]}
            onChange={changeMode}
          />
        </Form.Item>
        <Form.Item label={t('menu.themePalette')} htmlFor="theme-palette">
          <Select
            id="theme-palette"
            style={{ width: 'min(100%, 280px)' }}
            value={palette}
            options={PALETTE_IDS.map((id) => ({ value: id, label: PALETTE_NAMES[id] }))}
            onChange={setPalette}
          />
        </Form.Item>
        <Form.Item label={t('menu.themeAccent')} htmlFor="theme-accent">
          <Select<AccentChoice>
            id="theme-accent"
            style={{ width: 'min(100%, 280px)' }}
            value={accent}
            options={(Object.keys(ACCENT_CHOICES) as AccentChoice[]).map((id) => ({
              value: id,
              label: id[0].toUpperCase() + id.slice(1),
            }))}
            onChange={setAccent}
          />
        </Form.Item>
        <Form.Item label={t('menu.themeGlass')} htmlFor="theme-glass">
          <Switch id="theme-glass" checked={glass} onChange={setGlass} />
        </Form.Item>
      </Form>
    </Card>
  );
}
