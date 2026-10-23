// Connect Hub modifications, 2026-10-23. GPL-3.0.
import { useCallback, useEffect, useState } from 'react';
import { Card, ConfigProvider, Layout, Space, Tag, Typography } from 'antd';
import SudokuInbounds from './SudokuInbounds';
import AppSidebar from '@/layouts/AppSidebar';
import { HttpUtil } from '@/utils';
import { useTheme } from '@/hooks/useTheme';
import './HubPage.css';

type Profile = { host: string; port: number; publicKey: string; aead: string; table: string };
type State = {
  sudoku: {
    enabled: boolean;
    configured: boolean;
    running: boolean;
    error?: string;
    profile?: Profile;
  };
  mist: { enabled: boolean; stage: string; reason: string; status?: string; version?: string };
  connectCore: {
    enabled: boolean;
    stage: string;
    reason: string;
    status?: string;
    version?: string;
  };
};
export default function HubPage() {
  const { antdThemeConfig } = useTheme();
  const [state, setState] = useState<State>();
  const refresh = useCallback(async () => {
    const r = await HttpUtil.get<State>('/panel/hub/api/status');
    if (r.success && r.obj) setState(r.obj);
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => void refresh(), 5000);
    return () => {
      clearTimeout(initial);
      clearInterval(t);
    };
  }, [refresh]);
  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className="hub-page">
        <AppSidebar />
        <Layout className="content-shell">
          <Layout.Content className="content-area">
            <Typography.Title level={2}>Connect Hub</Typography.Title>
            <Typography.Paragraph>
              Independent server panel based on{' '}
              <a href="https://github.com/MHSanaei/3x-ui">3x-ui by MHSanaei and contributors</a>.
              Modified by Sander Stripa and contributors, 23 October 2026.{' '}
              <a href="https://github.com/sanderstripa/connect-hub/blob/main/LICENSE">
                GNU GPL-3.0
              </a>{' '}
              · <a href="https://github.com/sanderstripa/connect-hub">Source and modifications</a>.
              No warranty.
            </Typography.Paragraph>
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <SudokuInbounds enabled={!!state?.sudoku.enabled} />
              {[
                ['Mist', state?.mist],
                ['Connect Core', state?.connectCore],
              ].map(([name, cap]) => (
                <Card key={String(name)} title={String(name)}>
                  <Tag color="orange">
                    Experimental alpha ·{' '}
                    {typeof cap === 'object' && cap?.enabled ? cap.status || 'enabled' : 'disabled'}
                  </Tag>
                  <Typography.Paragraph>
                    {typeof cap === 'object' ? cap?.reason : 'Loading…'}
                  </Typography.Paragraph>
                </Card>
              ))}
            </Space>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
