import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ConfigProvider, Layout } from 'antd';
import AppSidebar from '@/layouts/AppSidebar';
import { useTheme } from '@/hooks/useTheme';
import InboundsPage from '@/pages/inbounds/InboundsPage';
import ClientsPage from '@/pages/clients/ClientsPage';
import './ConnectionsPage.css';

export default function ConnectionsPage() {
  const { t } = useTranslation();
  const { isDark, antdThemeConfig } = useTheme();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#keys') document.getElementById('connection-keys')?.scrollIntoView();
  }, [hash]);
  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className={`connections-page inbounds-page${isDark ? ' is-dark' : ''}`}>
        <AppSidebar />
        <Layout className="content-shell">
          <Layout.Content id="content-layout" className="content-area">
            <h1 className="section-page-title">{t('menu.connections')}</h1>
            <p className="connections-intro">{t('connections.intro')}</p>
            <div id="connection-inbounds"><InboundsPage embedded /></div>
            <div id="connection-keys"><ClientsPage embedded /></div>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
