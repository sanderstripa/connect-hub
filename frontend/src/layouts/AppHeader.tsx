import { ConfigProvider } from 'antd';
import { Link } from 'react-router';
import { useTheme } from '@/hooks/useTheme';
import AppSidebar from './AppSidebar';

export default function AppHeader() {
  const { antdThemeConfig } = useTheme();
  return (
    <header className="app-header">
      <Link className="app-brand" to="/">
        Connect.Hub
      </Link>
      <ConfigProvider theme={antdThemeConfig}>
        <AppSidebar header />
      </ConfigProvider>
    </header>
  );
}
