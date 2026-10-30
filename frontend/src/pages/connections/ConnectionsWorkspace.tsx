import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Input, Space, Tag } from 'antd';
import { PlusOutlined, SearchOutlined, SettingOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { SizeFormatter } from '@/utils';
import { readStreamHints, networkLabel } from '@/pages/inbounds/list/helpers';
import { buildRowActionsMenu } from '@/pages/inbounds/list/RowActions';
import type { DBInboundRecord, ClientCountEntry, GeneralAction } from '@/pages/inbounds/list/types';
import ClientsPage from '@/pages/clients/ClientsPage';
import type { MenuProps } from 'antd';
import { Dropdown } from 'antd';

interface Props {
  inbounds: DBInboundRecord[];
  counts: Record<number, ClientCountEntry>;
  subEnable: boolean;
  onAdd: () => void;
  onAction: (key: string, inbound: DBInboundRecord) => void;
  onGeneral: (key: GeneralAction) => void;
}

export default function ConnectionsWorkspace({ inbounds, counts, subEnable, onAdd, onAction, onGeneral }: Props) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const location = useLocation();
  const initial = () => location.hash === '#keys' ? 'all' as const : Number(new URLSearchParams(location.search).get('inbound')) || null;
  const [choice, setChoice] = useState<number | 'all' | null>(initial);
  const [routeKey, setRouteKey] = useState(location.key);
  const [search, setSearch] = useState('');
  if (routeKey !== location.key) { setRouteKey(location.key); setChoice(initial()); }
  const selected = inbounds.find(row => row.id === choice) ?? inbounds[0] ?? null;
  const all = choice === 'all';
  const visible = inbounds.filter(row => `${row.remark} ${row.protocol} ${row.port}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const general: MenuProps['items'] = [
    { key: 'import', label: t('import') },
    { key: 'export', label: t('pages.inbounds.export') },
    { key: 'subs', label: t('subscription.title'), disabled: !subEnable },
    { key: 'resetInbounds', label: t('pages.inbounds.resetAllTrafficTitle'), danger: true },
  ];
  return <div className="connections-workspace">
    <aside id="connection-inbounds" className="inbound-browser" aria-label={t('menu.inbounds')}>
      <div className="inbound-browser-tools">
        <Button type="primary" block icon={<PlusOutlined aria-hidden />} onClick={onAdd}>{t('connections.addInbound')}</Button>
        <Input value={search} onChange={event => setSearch(event.target.value)} prefix={<SearchOutlined aria-hidden />} placeholder={t('connections.findInbound')} aria-label={t('connections.findInbound')} allowClear />
      </div>
      <Button className="all-keys-view" block type={all ? 'primary' : 'default'} icon={<UnorderedListOutlined aria-hidden />} aria-pressed={all} onClick={() => setChoice('all')}>{t('connections.allKeys')}</Button>
      <div className="inbound-card-list">
        {visible.map(row => {
          const active = row.enable && (!row.expiryTime || row.expiryTime > now) && (!row.total || row.up + row.down < row.total);
          const stream = readStreamHints(row.streamSettings);
          const protocol = row.protocol === 'vless' && stream.network === 'xhttp' ? 'VLESS · XHTTP' : row.protocol.toUpperCase();
          return <button type="button" key={row.id} className={'inbound-card' + (!all && selected?.id === row.id ? ' is-selected' : '')} aria-pressed={!all && selected?.id === row.id} onClick={() => setChoice(row.id)}>
            <span className="inbound-card-title">{row.remark || `Inbound ${row.id}`}<i className={active ? 'state-active' : 'state-inactive'} aria-label={t(active ? 'enabled' : 'disabled')} /></span>
            <span className="inbound-card-meta">{protocol} · {row.port} · {t(active ? 'enabled' : 'disabled')}</span>
            <span className="inbound-card-stats"><span>{t('connections.keyCount', { count: counts[row.id]?.clients ?? 0 })}</span><span>↑ {SizeFormatter.sizeFormat(row.up)} · ↓ {SizeFormatter.sizeFormat(row.down)}</span></span>
          </button>;
        })}
        {!visible.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noData')} />}
      </div>
      <Dropdown menu={{items: general, onClick: ({ key }) => onGeneral(key as GeneralAction)}}><Button block>{t('pages.inbounds.generalActions')}</Button></Dropdown>
    </aside>
    <section id="connection-keys" className="connections-pane" aria-label={all ? t('connections.allKeys') : selected?.remark || t('menu.inbounds')}>
      <header className="connections-pane-header">
        <div><h2>{all ? t('connections.allKeys') : selected?.remark || t('connections.chooseInbound')}</h2>
          {all ? <p>{t('connections.allKeysHint')}</p> : selected && <Space size={8} wrap><Tag>{selected.protocol.toUpperCase()}</Tag><span>{selected.port} · {networkLabel(readStreamHints(selected.streamSettings).network)}</span><span>{t('connections.keyCount', { count: counts[selected.id]?.clients ?? 0 })}</span><span>↑ {SizeFormatter.sizeFormat(selected.up)} · ↓ {SizeFormatter.sizeFormat(selected.down)}</span></Space>}
        </div>
        {!all && selected && <Space><Button icon={<SettingOutlined aria-hidden />} onClick={() => onAction('edit', selected)}>{t('menu.settings')}</Button><Dropdown menu={{ items: buildRowActionsMenu({ record: selected, subEnable, hasClients: (counts[selected.id]?.clients ?? 0) > 0, t }), onClick: ({ key }) => onAction(key, selected) }}><Button>{t('more')}</Button></Dropdown></Space>}
      </header>
      {(all || selected) ? <ClientsPage key={all ? 'all' : selected!.id} embedded explorer inboundId={all ? undefined : selected!.id} /> : <Empty description={t('connections.chooseInbound')} />}
    </section>
  </div>;
}
