// Connect Hub Sudoku inbounds and device credentials, 2026-10-24. GPL-3.0.
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  QRCode,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { HttpUtil } from '@/utils';

type Device = { id: string; name: string; status: string; created: string };
type Inbound = {
  id: string;
  name: string;
  enabled: boolean;
  devices: Device[];
  status: {
    running: boolean;
    error?: string;
    profile?: { host: string; port: number; aead: string; table: string };
  };
};
type Credentials = { privateKey: string; uri: string; config: Record<string, unknown> };
const base = '/panel/hub/api/sudoku/inbounds';
export default function SudokuInbounds({ enabled }: { enabled: boolean }) {
  const { i18n } = useTranslation();
  const ru = (i18n.resolvedLanguage || i18n.language).startsWith('ru');
  const text = (r: string, e: string) => (ru ? r : e);
  const [items, setItems] = useState<Inbound[]>([]);
  const [creating, setCreating] = useState(false);
  const [deviceInbound, setDeviceInbound] = useState<string>();
  const [deviceName, setDeviceName] = useState('');
  const [credentials, setCredentials] = useState<Credentials>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm();
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const r = await HttpUtil.get<Inbound[]>(base);
    if (r.success && r.obj) setItems(r.obj);
  }, [enabled]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);
  async function action(path: string, payload?: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const r = await HttpUtil.post<Credentials>(base + path, payload || {}, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (r.success) {
        if (r.obj?.uri) setCredentials(r.obj);
        if (path === '') {
          setCreating(false);
          form.resetFields();
        }
        if (path.endsWith('/devices')) {
          setDeviceInbound(undefined);
          setDeviceName('');
        }
      } else {
        setError(r.msg || text('Не удалось выполнить действие', 'Action failed'));
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!credentials) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(credentials.config, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'connect-hub-sudoku-client.json';
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Card
      title={text('Sudoku: подключения и устройства', 'Sudoku inbounds and devices')}
      extra={<Button onClick={() => void refresh()}>{text('Обновить', 'Refresh')}</Button>}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      {!enabled ? (
        <Alert
          type="info"
          showIcon
          title={text('Sudoku недоступен', 'Sudoku unavailable')}
          description={text(
            'Установите актуальный пакет Connect Hub с совместимым Sudoku Core. Если Sudoku отключён администратором, его необходимо включить.',
            'Install the current Connect Hub package with its compatible Sudoku Core. An explicit administrator disable must be removed.',
          )}
        />
      ) : (
        <>
          <Typography.Paragraph>
            {text(
              'Создайте inbound со свободным TCP-портом, затем добавьте устройства. Каждое устройство получает собственный ключ, ссылку и конфигурацию.',
              'Create an inbound on a free TCP port, then add devices. Each device receives its own key, link and configuration.',
            )}
          </Typography.Paragraph>
          <Button type="primary" onClick={() => setCreating(true)}>
            {text('Создать inbound', 'Create inbound')}
          </Button>
          <Space orientation="vertical" style={{ width: '100%', marginTop: 16 }} size="large">
            {items.map((item) => (
              <Card
                key={item.id}
                size="small"
                title={
                  <>
                    {item.name}{' '}
                    <Tag color={item.status.running ? 'green' : 'default'}>
                      {item.status.running
                        ? text('Работает', 'Running')
                        : text('Остановлен', 'Stopped')}
                    </Tag>
                  </>
                }
              >
                <Typography.Paragraph>
                  {item.status.profile?.host}:{item.status.profile?.port} ·{' '}
                  {item.status.profile?.aead} · {item.status.profile?.table}
                </Typography.Paragraph>
                {item.status.error && <Alert type="error" title={item.status.error} />}
                <Space wrap style={{ marginBottom: 16 }}>
                  <Button
                    disabled={busy || item.status.running}
                    onClick={() => void action(`/${item.id}/start`)}
                  >
                    {text('Запустить', 'Start')}
                  </Button>
                  <Button
                    disabled={busy || !item.status.running}
                    onClick={() => void action(`/${item.id}/stop`)}
                  >
                    {text('Остановить', 'Stop')}
                  </Button>
                  <Button
                    onClick={() => {
                      setDeviceInbound(item.id);
                      setDeviceName('');
                    }}
                  >
                    {text('Добавить устройство', 'Add device')}
                  </Button>
                  <Popconfirm
                    title={text(
                      'Удалить inbound? Его ключи будут сохранены в закрытом архиве.',
                      'Remove inbound? Its keys will be retained in a private archive.',
                    )}
                    onConfirm={() => action(`/${item.id}/remove`)}
                  >
                    <Button danger disabled={busy || item.status.running}>
                      {text('Удалить', 'Remove')}
                    </Button>
                  </Popconfirm>
                </Space>
                <Table<Device>
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ x: 560 }}
                  dataSource={item.devices}
                  columns={[
                    { title: text('Устройство', 'Device'), dataIndex: 'name' },
                    {
                      title: text('Доступ', 'Access'),
                      render: (_, device) => (
                        <Tag color={device.status === 'enabled' ? 'green' : 'default'}>
                          {device.status === 'enabled'
                            ? text('Разрешён', 'Enabled')
                            : device.status === 'disabled'
                              ? text('Отключён', 'Disabled')
                              : text('Отозван', 'Revoked')}
                        </Tag>
                      ),
                    },
                    {
                      title: text('Действия', 'Actions'),
                      render: (_, device) => (
                        <Space wrap>
                          <Button
                            size="small"
                            disabled={busy || device.status !== 'enabled'}
                            onClick={() => void action(`/${item.id}/devices/${device.id}/export`)}
                          >
                            {text('Ключ / QR / конфигурация', 'Key / QR / configuration')}
                          </Button>
                          {device.status !== 'revoked' && (
                            <>
                              <Button
                                size="small"
                                disabled={busy}
                                onClick={() =>
                                  void action(
                                    `/${item.id}/devices/${device.id}/${device.status === 'enabled' ? 'disabled' : 'enabled'}`,
                                  )
                                }
                              >
                                {device.status === 'enabled'
                                  ? text('Отключить', 'Disable')
                                  : text('Включить', 'Enable')}
                              </Button>
                              <Popconfirm
                                title={text(
                                  'Навсегда отозвать ключ этого устройства?',
                                  'Permanently revoke this device key?',
                                )}
                                onConfirm={() => action(`/${item.id}/devices/${device.id}/revoked`)}
                              >
                                <Button danger size="small" disabled={busy}>
                                  {text('Отозвать', 'Revoke')}
                                </Button>
                              </Popconfirm>
                            </>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ))}
          </Space>
          {!items.length && (
            <Typography.Paragraph style={{ marginTop: 16 }}>
              {text('Подключений пока нет.', 'No inbounds yet.')}
            </Typography.Paragraph>
          )}
        </>
      )}
      <Modal
        title={text('Новый Sudoku inbound', 'New Sudoku inbound')}
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={() => form.submit()}
        confirmLoading={busy}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ port: 18443, aead: 'chacha20-poly1305', table: 'prefer_ascii' }}
          onFinish={(v) => void action('', v)}
        >
          <Form.Item
            name="name"
            label={text('Название', 'Name')}
            rules={[{ required: true, max: 120 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="host"
            label={text(
              'Адрес сервера для клиентов (IP или домен)',
              'Server address for clients (IP or domain)',
            )}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="port"
            label={text('Свободный TCP-порт', 'Free TCP port')}
            rules={[{ required: true }]}
          >
            <InputNumber min={1024} max={65535} />
          </Form.Item>
          <Form.Item name="aead" label={text('Шифрование', 'Encryption')}>
            <Select options={[{ value: 'chacha20-poly1305' }, { value: 'aes-128-gcm' }]} />
          </Form.Item>
          <Form.Item name="table" label={text('Режим таблицы', 'Table mode')}>
            <Select options={[{ value: 'prefer_ascii' }, { value: 'prefer_entropy' }]} />
          </Form.Item>
        </Form>
        <Typography.Paragraph type="secondary">
          {text(
            'Порт нужно разрешить в вашем firewall; в Docker также опубликовать его. Connect Hub не меняет эти настройки автоматически.',
            'Allow this port in your firewall; publish it separately when using Docker. Connect Hub does not change these settings automatically.',
          )}
        </Typography.Paragraph>
      </Modal>
      <Modal
        title={text('Добавить устройство', 'Add device')}
        open={!!deviceInbound}
        onCancel={() => setDeviceInbound(undefined)}
        confirmLoading={busy}
        okButtonProps={{ disabled: !deviceName.trim() }}
        onOk={() => void action(`/${deviceInbound}/devices`, { name: deviceName })}
      >
        <Input
          aria-label={text('Название устройства', 'Device name')}
          placeholder={text('Например: мой телефон', 'For example: my phone')}
          maxLength={120}
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
        />
      </Modal>
      <Modal
        title={text('Подключение устройства', 'Device connection')}
        open={!!credentials}
        onCancel={() => setCredentials(undefined)}
        footer={
          <Button onClick={() => setCredentials(undefined)}>{text('Закрыть', 'Close')}</Button>
        }
        width={640}
      >
        {credentials && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Alert
              type="warning"
              title={text(
                'Это секретные данные выбранного устройства. Не передавайте их другим людям.',
                'These are secret credentials for this device. Do not share them with others.',
              )}
            />
            <Typography.Text>
              {text('Ссылка для совместимого клиента', 'Link for a compatible client')}
            </Typography.Text>
            <Typography.Paragraph copyable style={{ overflowWrap: 'anywhere' }}>
              {credentials.uri}
            </Typography.Paragraph>
            <QRCode value={credentials.uri} size={220} />
            <Typography.Text>{text('Приватный ключ', 'Private key')}</Typography.Text>
            <Typography.Paragraph copyable style={{ overflowWrap: 'anywhere' }}>
              {credentials.privateKey}
            </Typography.Paragraph>
            <Button onClick={download}>
              {text(
                'Скачать конфигурацию клиента (.json)',
                'Download client configuration (.json)',
              )}
            </Button>
          </Space>
        )}
      </Modal>
    </Card>
  );
}
