import { MenuOutlined } from '@ant-design/icons';
import { ConfigProvider } from 'antd';
import { useTranslation } from 'react-i18next';
import { useMobileNavigation } from './MobileNavigation';
import { Link } from 'react-router';
import { useTheme } from '@/hooks/useTheme';
import AppSidebar from './AppSidebar';

export default function AppHeader() {
  const { open, setOpen } = useMobileNavigation();
  const { t } = useTranslation();
  const { antdThemeConfig } = useTheme();
  return (
    <header className="app-header">
      <button
        type="button"
        className="mobile-menu-trigger"
        aria-label={t('menu.navigation')}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen(!open)}
      >
        <MenuOutlined aria-hidden />
      </button>
      <Link className="app-brand" to="/">
        <img
          className="desktop-brand-icon"
          src={`${window.X_UI_BASE_PATH || '/'}icons/connect-hub.svg`}
          alt=""
        />
        Connect. Hub
      </Link>
      <ConfigProvider theme={antdThemeConfig}>
        <AppSidebar header />
      </ConfigProvider>
    </header>
  );
}
