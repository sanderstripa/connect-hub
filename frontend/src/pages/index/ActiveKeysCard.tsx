import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { keys } from '@/api/queryKeys';
import { useInboundOptions } from '@/api/queries/useInboundOptions';
import { fetchClientPage, useClients, type ClientRecord } from '@/hooks/useClients';
import { useWebSocket } from '@/hooks/useWebSocket';
import { SizeFormatter } from '@/utils';

async function fetchActiveClients(signal: AbortSignal) {
  const clients = new Map<string, ClientRecord>();
  const pageSize = 200;
  for (let page = 1; !signal.aborted; page += 1) {
    const result = await fetchClientPage({ page, pageSize, filter: 'online' }, signal);
    for (const row of result.items) clients.set(row.email, row);
    if (result.items.length < pageSize || page * pageSize >= result.filtered) break;
  }
  return Array.from(clients.values());
}

export default function ActiveKeysCard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const inbounds = useInboundOptions();
  const { clientSpeed, applyTrafficEvent } = useClients({ list: false });
  useWebSocket({ traffic: applyTrafficEvent });
  const clients = useQuery({
    queryKey: [...keys.clients.root(), 'dashboard-active'],
    queryFn: ({ signal }) => fetchActiveClients(signal),
    refetchInterval: 5000,
  });
  const inboundById = new Map(inbounds.data?.map((inbound) => [inbound.id, inbound]));
  const rows = clients.data ?? [];
  return (
    <Card className="ov-active-keys">
      <header className="ov-keys-head">
        <h2>
          {t('pages.index.activeKeys')}
          {clients.data && <span className="ov-keys-count">{rows.length}</span>}
        </h2>
        <Button type="dashed" onClick={() => navigate('/connections#keys')}>
          {t('connections.allKeys')}
        </Button>
      </header>
      {clients.isError && <Alert type="error" title={t('pages.index.activeKeysError')} />}
      {clients.isPending && <Spin />}
      {clients.isSuccess && !rows.length && <p>{t('noData')}</p>}
      {rows.length > 0 && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The scroll region needs keyboard focus.
        <div className="ov-keys-scroll" tabIndex={0} role="region" aria-label={t('pages.index.activeKeys')}>
          <table className="ov-keys-table">
            <thead>
              <tr>
                <th scope="col">{t('menu.clients')}</th>
                <th scope="col">{t('pages.index.download')}</th>
                <th scope="col">{t('pages.index.upload')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((client) => {
                const speed = clientSpeed[client.email];
                return (
                  <tr key={client.email}>
                    <th scope="row">
                      <div className="ov-key-name" dir="auto">{client.email}</div>
                      <span className="ov-key-online">{t('online')}</span>
                      <ul className="ov-key-inbounds">
                        {client.inboundIds?.map((id) => {
                          const inbound = inboundById.get(id);
                          return (
                            <li key={id}>
                              {inbound?.remark || inbound?.tag || `#${id}`}
                              {inbound?.protocol && ` · ${inbound.protocol.toUpperCase()}`}
                            </li>
                          );
                        })}
                      </ul>
                    </th>
                    <td dir="ltr">{speed ? SizeFormatter.speedFormat(speed.down).replace(' ', '\u00a0') : '—'}</td>
                    <td dir="ltr">{speed ? SizeFormatter.speedFormat(speed.up).replace(' ', '\u00a0') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
