import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, ConfigProvider, Input, Layout, Space, Spin, Typography } from 'antd';
import { RobotOutlined, SendOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTheme } from '@/hooks/useTheme';
import AppSidebar from '@/layouts/AppSidebar';
import { HttpUtil } from '@/utils';
import './AssistantPage.css';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ProviderStatus = { configured: boolean; model: string; advisoryOnly: boolean };
type ProviderReply = { content: string; model: string };

export default function AssistantPage() {
  const { i18n } = useTranslation();
  const ru = i18n.language.startsWith('ru');
  const { antdThemeConfig } = useTheme();
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void HttpUtil.get('/panel/api/assistant/status', undefined, { silent: true })
      .then((response) => {
        if (!alive) return;
        if (response?.success) setProvider(response.obj as ProviderStatus);
        else setStatusError(response?.msg || 'Provider status unavailable');
      })
      .catch(() => { if (alive) setStatusError(ru ? 'Ошибка подключения' : 'Connection error'); });
    return () => { alive = false; };
  }, [ru]);
  async function send() {
    const content = draft.trim();
    if (!content || busy || !provider?.configured) return;
    const next: ChatMessage[] = [...messages, { role: 'user' as const, content }].slice(-15);
    setMessages(next);
    setDraft('');
    setBusy(true);
    setError('');
    try {
      const response = await HttpUtil.post('/panel/api/assistant/chat', { messages: next }, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response?.success) throw new Error(response?.msg || 'Provider error');
      const answer = response.obj as ProviderReply;
      if (!answer?.content) throw new Error('Empty provider response');
      setMessages((prev) => [...prev, { role: 'assistant' as const, content: answer.content }].slice(-16));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI provider unavailable');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className="assistant-layout">
        <AppSidebar />
        <Layout className="content-shell">
          <Layout.Content id="content-layout" className="content-area">
            <div className="assistant-page">
              <div className="assistant-heading">
                <RobotOutlined aria-hidden style={{ fontSize: 28 }} />
                <div>
                  <Typography.Title level={2} style={{ margin: 0 }}>
                    {ru ? 'ИИ-помощник Connect Hub' : 'Connect Hub AI Assistant'}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {ru ? 'Помощь с настройкой VPN, узлов, маршрутизации и безопасностью' : 'Help with VPN, nodes, routing and security'}
                  </Typography.Text>
                </div>
              </div>
              <Alert type="info" showIcon description={ru ?
                'Помощник даёт рекомендации, но не изменяет сервер самостоятельно. Сообщения передаются выбранному внешнему AI-провайдеру только после отправки.' :
                'The assistant advises but does not modify servers. Messages are sent to the configured external AI provider only when you submit them.'} />
              {statusError && <Alert type="error" showIcon title={statusError} />}
              {!provider && !statusError && <Spin />}
              {provider && !provider.configured && (
                <Alert type="warning" showIcon title={ru ? 'Провайдер не настроен' : 'AI provider not configured'}
                  description={ru ?
                    'Задайте CONNECT_HUB_AI_API_KEY на сервере. Не вводите ключи в сообщения. При необходимости установите CONNECT_HUB_AI_MODEL и CONNECT_HUB_AI_URL.' :
                    'Set CONNECT_HUB_AI_API_KEY on the server. Never send keys in chat. Optionally set CONNECT_HUB_AI_MODEL and CONNECT_HUB_AI_URL.'} />
              )}
              {provider?.configured && (
                <Typography.Text type="secondary">
                  {ru ? 'Модель' : 'Model'}: {provider.model}
                </Typography.Text>
              )}
              <Card className="assistant-chat-card" styles={{ body: { padding: 0 } }}>
                <div className="assistant-history" role="log" aria-live="polite">
                  {messages.length === 0 && (
                    <div className="assistant-empty">
                      <RobotOutlined aria-hidden style={{ fontSize: 32, opacity: 0.6 }} />
                      <Typography.Paragraph type="secondary">
                        {ru ? 'Спроси, как настроить REALITY, WatTunnel, DNS или управлять сервером.' :
                          'Ask how to configure REALITY, WatTunnel, DNS or manage a server.'}
                      </Typography.Paragraph>
                    </div>
                  )}
                  {messages.map((m, index) => (
                    <div key={index} className={'assistant-bubble ' + m.role}>
                      <Typography.Text strong>{m.role === 'user' ? (ru ? 'Ты' : 'You') : 'Connect Hub AI'}</Typography.Text>
                      <div className="assistant-bubble-content">{m.content}</div>
                    </div>
                  ))}
                  {busy && <Spin size="small" aria-label={ru ? 'Формируется ответ' : 'Generating answer'} />}
                </div>
                <div className="assistant-compose">
                  <Input.TextArea aria-label={ru ? 'Сообщение для ИИ-помощника' : 'Message to AI assistant'} autoSize={{ minRows: 2, maxRows: 5 }} maxLength={4000}
                    disabled={!provider?.configured || busy}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={ru ? 'Задай вопрос… (Enter — отправить, Shift+Enter — новая строка)' : 'Ask a question… (Enter sends, Shift+Enter inserts a newline)'}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  />
                  <Space>
                    <Button icon={<DeleteOutlined aria-hidden />} disabled={busy || messages.length === 0} onClick={() => setMessages([])}>
                      {ru ? 'Очистить' : 'Clear'}
                    </Button>
                    <Button type="primary" icon={<SendOutlined aria-hidden />} loading={busy}
                      disabled={!provider?.configured || !draft.trim()} onClick={() => void send()}>
                      {ru ? 'Отправить' : 'Send'}
                    </Button>
                  </Space>
                  {error && <Alert type="error" showIcon title={error} />}
                </div>
              </Card>
            </div>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
