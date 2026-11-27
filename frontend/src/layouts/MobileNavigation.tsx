import { MenuOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { createContext, useContext } from 'react';

export const MobileNavigationContext = createContext({
  open: false,
  setOpen: (_open: boolean) => {},
});
export const useMobileNavigation = () => useContext(MobileNavigationContext);

export function MobileSettingsNavigationTrigger() {
  const { t } = useTranslation();
  const { open, setOpen } = useMobileNavigation();
  return (
    <Button
      className="settings-mobile-menu"
      icon={<MenuOutlined aria-hidden />}
      aria-label={t('menu.navigation')}
      aria-expanded={open}
      aria-controls="mobile-navigation"
      onClick={() => setOpen(!open)}
    >
      {t('menu.settings')}
    </Button>
  );
}
