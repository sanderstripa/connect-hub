// Connect Hub modifications, 2026-10-23. GPL-3.0.
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  Layout,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
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
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<Profile>();
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
  async function action(name: string, values?: Profile) {
    setBusy(true);
    try {
      const r = await HttpUtil.post<{ privateKey?: string }>(
        `/panel/hub/api/sudoku/${name}`,
        values,
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (r.success && r.obj?.privateKey) setSecret(r.obj.privateKey);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
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
              <Card
                title={
                  <>
                    Sudoku transport{' '}
                    <Tag color={state?.sudoku.running ? 'green' : 'default'}>
                      {state?.sudoku.running ? 'Running' : 'Stopped'}
                    </Tag>
                  </>
                }
              >
                {!state?.sudoku.enabled && (
                  <Alert
                    type="info"
                    showIcon
                    title="Sudoku is disabled"
                    description="An administrator must enable CONNECT_HUB_SUDOKU=1 and provide a dedicated integration directory, compatible Core binary and SHA-256. See the repository integration guide."
                  />
                )}
                {state?.sudoku.error && <Alert type="error" title={state.sudoku.error} />}
                {state?.sudoku.profile && (
                  <Typography.Paragraph>
                    Server: {state.sudoku.profile.host}:{state.sudoku.profile.port} ·{' '}
                    {state.sudoku.profile.aead} · {state.sudoku.profile.table}
                  </Typography.Paragraph>
                )}
                {state?.sudoku.enabled && !state.sudoku.configured && (
                  <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                      port: 18443,
                      aead: 'chacha20-poly1305',
                      table: 'prefer_ascii',
                    }}
                    onFinish={(v) => void action('create', v)}
                  >
                    <Form.Item
                      name="host"
                      label="Public server IP or DNS name"
                      rules={[{ required: true }]}
                    >
                      <Input autoComplete="off" />
                    </Form.Item>
                    <Form.Item name="port" label="Sudoku TCP port" rules={[{ required: true }]}>
                      <InputNumber min={1024} max={65535} />
                    </Form.Item>
                    <Form.Item name="aead" label="AEAD">
                      <Select
                        options={[{ value: 'chacha20-poly1305' }, { value: 'aes-128-gcm' }]}
                      />
                    </Form.Item>
                    <Form.Item name="table" label="Table mode">
                      <Select options={[{ value: 'prefer_ascii' }, { value: 'prefer_entropy' }]} />
                    </Form.Item>
                    <Button htmlType="submit" type="primary" loading={busy}>
                      Create fresh Sudoku keys
                    </Button>
                  </Form>
                )}
                {secret && (
                  <Alert
                    type="warning"
                    title="Save this client private key now — it is displayed once and is not stored by Connect Hub"
                    description={
                      <>
                        <Typography.Paragraph copyable>{secret}</Typography.Paragraph>
                        <Button onClick={() => setSecret('')}>I saved the key</Button>
                      </>
                    }
                  />
                )}
                <Space style={{ marginTop: 16 }}>
                  <Button
                    disabled={!state?.sudoku.configured || state.sudoku.running || busy}
                    onClick={() => void action('start')}
                  >
                    Start
                  </Button>
                  <Button
                    disabled={!state?.sudoku.running || busy}
                    onClick={() => void action('stop')}
                  >
                    Stop
                  </Button>
                  <Popconfirm
                    title="Remove this profile? Existing clients will need new keys."
                    onConfirm={() => action('remove')}
                  >
                    <Button
                      danger
                      disabled={!state?.sudoku.configured || state.sudoku.running || busy}
                    >
                      Remove profile
                    </Button>
                  </Popconfirm>
                  <Button onClick={() => void refresh()}>Refresh</Button>
                </Space>
                <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
                  Initial integration: one TCP server and one generated client identity; no
                  automatic startup. Per-device revocation, traffic accounting and subscriptions are
                  not implemented for Sudoku yet. Xray settings remain independent.
                </Typography.Paragraph>
              </Card>
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
