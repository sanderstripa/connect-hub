import { MenuOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useMobileNavigation } from './MobileNavigation';
import { Link } from 'react-router';

export default function AppHeader() {
  const { open, setOpen } = useMobileNavigation();
  const { t } = useTranslation();
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
        Connect. Hub
      </Link>
    </header>
  );
}
