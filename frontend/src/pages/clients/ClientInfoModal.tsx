import InfinityIcon from '@/components/ui/InfinityIcon';
import DetailSurface from '@/components/layout/DetailSurface';
import { CLIENT_GROUPS_UI_ENABLED } from '@/lib/client-groups-ui';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ClientSpeedTag from '@/components/clients/ClientSpeedTag';
import ClientWireguardDevices from './ClientWireguardDevices';
import { useClientWireguardDevices } from '@/hooks/useClientWireguardDevices';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Popover, Tag, Tooltip, message } from 'antd';
import {
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  QrcodeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import { ClipboardManager, FileManager, HttpUtil, IntlUtil, SizeFormatter } from '@/utils';
import { formatInboundLabel, formatTunnelConfigMeta } from '@/lib/inbounds/label';
import { normalizeClientIps, type ClientIpInfo } from '@/lib/clients/ip-log';
import { useDatepicker } from '@/hooks/useDatepicker';
import { useClientHwids } from '@/hooks/useClientHwids';
import type { ClientRecord, ClientSpeedEntry, InboundOption } from '@/hooks/useClients';
import { isPostQuantumLink } from '@/lib/xray/inbound-link';
import { LinkTags, linkMetaText, parseLinkParts } from '@/lib/xray/link-label';
import { QrPanel } from '@/pages/inbounds/qr';
import ClientHwidListModal from '@/components/clients/ClientHwidList';
import ConfigBlock from '@/components/clients/ConfigBlock';
import {
  buildWireguardDeviceConfigs,
  findWireguardInbounds,
  isWireguardClient,
} from './wireguardConfig';
import {
  buildAmneziaWGClientConfig,
  findAmneziaWGInbounds,
  isAmneziaWGClient,
} from './amneziawgConfig';
import { tunnelConfigEndpoints, tunnelEndpointLabel } from './tunnelEndpoints';
import type { HostRecord } from '@/schemas/api/host';
import './ClientInfoModal.css';

function InfoField({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="client-info-field">
      <dt>{label}</dt>
      <dd>
        <span className="client-info-value">{children}</span>
        {action}
      </dd>
    </div>
  );
}

interface SubSettings {
  enable: boolean;
  subURI: string;
  subJsonURI: string;
  subJsonEnable: boolean;
  subClashURI: string;
  subClashEnable: boolean;
  publicHost?: string;
}

interface ClientInfoModalProps {
  embedded?: boolean;
  inboundScope?: number;
  open: boolean;
  client: ClientRecord | null;
  inboundsById: Record<number, InboundOption>;
  tunnelAllowedIPs?: Record<number, string>;
  isOnline: boolean;
  speed?: ClientSpeedEntry;
  liveClient?: Pick<ClientRecord, 'enable' | 'traffic'>;
  subSettings?: SubSettings;
  hosts?: HostRecord[];
  onOpenChange: (open: boolean) => void;
}

const NO_HOSTS: HostRecord[] = [];

interface ApiMsg<T = unknown> {
  success?: boolean;
  obj?: T;
}

const DEFAULT_SUB: SubSettings = {
  enable: false,
  subURI: '',
  subJsonURI: '',
  subJsonEnable: false,
  subClashURI: '',
  subClashEnable: false,
  publicHost: '',
};

const SUBSCRIPTION_DOWNLOAD_NAMES = {
  standard: 'subscription-standard.txt',
  json: 'subscription-json.json',
  clash: 'subscription-clash.yaml',
} as const;

export default function ClientInfoModal({ embedded = false, inboundScope,
  open,
  client,
  inboundsById,
  tunnelAllowedIPs,
  isOnline,
  speed,
  liveClient,
  subSettings = DEFAULT_SUB,
  hosts = NO_HOSTS,
  onOpenChange,
}: ClientInfoModalProps) {
  const { datepicker } = useDatepicker();
  const { t } = useTranslation();
  const expiryLabel = (ts?: number) => {
    if (!ts) return <InfinityIcon />;
    if (ts < 0) {
      const days = Math.round(ts / -86400000);
      return `${t('pages.clients.delayedStart')}: ${days}d`;
    }
    return IntlUtil.formatDate(ts, datepicker);
  };
  const dateLabel = (ts?: number) => (!ts || ts <= 0 ? '-' : IntlUtil.formatDate(ts, datepicker));
  const [messageApi, messageContextHolder] = message.useMessage();
  const [links, setLinks] = useState<string[]>([]);
  const [clientIps, setClientIps] = useState<ClientIpInfo[]>([]);
  const [ipsLoading, setIpsLoading] = useState(false);
  const [ipsClearing, setIpsClearing] = useState(false);
  const [ipsModalOpen, setIpsModalOpen] = useState(false);
  const {
    clientHwids,
    hwidsLoading,
    hwidsClearing,
    deletingHwidId,
    blockingHwidId,
    loadHwids,
    clearHwids,
    deleteHwid,
    setHwidBlocked,
    resetHwids,
  } = useClientHwids(client?.email);
  const [hwidsModalOpen, setHwidsModalOpen] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<
    keyof typeof SUBSCRIPTION_DOWNLOAD_NAMES | null
  >(null);

  // Clearing on close happens during render; the effect owns only the fetch.
  const openSubId = open ? (client?.subId ?? '') : null;
  const [syncedSubId, setSyncedSubId] = useState(openSubId);
  if (openSubId !== syncedSubId) {
    setSyncedSubId(openSubId);
    if (openSubId === null) {
      setLinks([]);
      setClientIps([]);
      setIpsModalOpen(false);
      resetHwids();
      setHwidsModalOpen(false);
    }
  }

  useEffect(() => {
    if (!open || !client?.subId) return;
    let cancelled = false;
    (async () => {
      const msg = (await HttpUtil.get(
        inboundScope ? `/panel/api/clients/inboundLinks/${inboundScope}/${encodeURIComponent(client.email)}` : `/panel/api/clients/subLinks/${encodeURIComponent(client.subId!)}`,
      )) as ApiMsg<string[]>;
      if (cancelled) return;
      setLinks(msg?.success && Array.isArray(msg.obj) ? msg.obj : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, client?.subId, client?.email, inboundScope]);

  const traffic = liveClient?.traffic ?? client?.traffic;
  const enabled = liveClient?.enable ?? client?.enable;
  const totalBytes = client?.totalGB || 0;
  const used = (traffic?.up || 0) + (traffic?.down || 0);
  const remaining = useMemo(() => {
    if (totalBytes <= 0) return -1;
    const r = totalBytes - used;
    return r > 0 ? r : 0;
  }, [totalBytes, used]);

  const subId = client?.subId;
  const subLink = subId && subSettings?.subURI ? subSettings.subURI + subId : '';
  const subJsonLink =
    subId && subSettings?.subJsonEnable && subSettings?.subJsonURI
      ? subSettings.subJsonURI + subId
      : '';
  const subClashLink =
    subId && subSettings?.subClashEnable && subSettings?.subClashURI
      ? subSettings.subClashURI + subId
      : '';

  const showSubscription = !!(subSettings?.enable && client?.subId);
  const wgInbounds = useMemo(
    () => findWireguardInbounds(client, inboundsById),
    [client, inboundsById],
  );
  const wireguardDevices = useClientWireguardDevices(client?.email, open && wgInbounds.length > 0);
  const wgConfigs = useMemo(() => {
    if (!client || !isWireguardClient(client)) return [];
    return buildWireguardDeviceConfigs(
      client,
      wgInbounds,
      wireguardDevices.data,
      tunnelAllowedIPs,
      hosts,
      window.location.hostname,
      subSettings?.publicHost ?? '',
      true,
    );
  }, [client, wgInbounds, wireguardDevices.data, tunnelAllowedIPs, subSettings?.publicHost, hosts]);

  const awgInbounds = useMemo(
    () => findAmneziaWGInbounds(client, inboundsById),
    [client, inboundsById],
  );
  const awgConfigs = useMemo(() => {
    if (!client || !isAmneziaWGClient(client)) return [];
    const host = window.location.hostname;
    const publicHost = subSettings.publicHost ?? '';
    return awgInbounds
      .flatMap((ib) => {
        const address = tunnelAllowedIPs?.[ib.id] ?? '';
        return tunnelConfigEndpoints(ib, hosts, host, publicHost).map((ep) => ({
          inbound: ib,
          endpoint: tunnelEndpointLabel(ep),
          text: buildAmneziaWGClientConfig(client, ib, host, publicHost, address, ep),
        }));
      })
      .filter((c) => !!c.text);
  }, [client, awgInbounds, tunnelAllowedIPs, subSettings.publicHost, hosts]);

  async function copyValue(text: string) {
    if (!text) return;
    const ok = await ClipboardManager.copyText(String(text));
    if (ok) messageApi.success(t('copied'));
  }

  async function downloadSubscription(
    url: string,
    format: keyof typeof SUBSCRIPTION_DOWNLOAD_NAMES,
  ) {
    if (!url || downloadingFormat) return;
    setDownloadingFormat(format);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Subscription download failed');
      const content = await response.text();
      FileManager.downloadTextFile(content, SUBSCRIPTION_DOWNLOAD_NAMES[format]);
    } catch (_) {
      messageApi.error(t('somethingWentWrong'));
    } finally {
      setDownloadingFormat(null);
    }
  }

  async function loadIps() {
    if (!client?.email) return;
    setIpsLoading(true);
    try {
      const msg = (await HttpUtil.post(
        `/panel/api/clients/ips/${encodeURIComponent(client.email)}`,
      )) as ApiMsg<unknown[]>;
      if (!msg?.success) {
        setClientIps([]);
        return;
      }
      setClientIps(normalizeClientIps(msg.obj));
    } finally {
      setIpsLoading(false);
    }
  }

  async function clearIps() {
    if (!client?.email) return;
    setIpsClearing(true);
    try {
      const msg = (await HttpUtil.post(
        `/panel/api/clients/clearIps/${encodeURIComponent(client.email)}`,
      )) as ApiMsg;
      if (msg?.success) setClientIps([]);
    } finally {
      setIpsClearing(false);
    }
  }

  function openIpsModal() {
    setIpsModalOpen(true);
    if (clientIps.length === 0) void loadIps();
  }

  function openHwidsModal() {
    setHwidsModalOpen(true);
    if (clientHwids.length === 0) void loadHwids();
  }

  function copyButton(value: string | undefined, label: string) {
    if (!value) return null;
    return (
      <Tooltip title={t('copy')}>
        <Button
          size="small"
          type="text"
          icon={<CopyOutlined aria-hidden />}
          aria-label={`${t('copy')} · ${label}`}
          onClick={() => void copyValue(value)}
        />
      </Tooltip>
    );
  }

  return (
    <>
      {messageContextHolder}
      <DetailSurface embedded={embedded} className="client-info-surface"
        open={open}
        title={
          client
            ? `${t('pages.clients.clientInfo')} — ${client.email}`
            : t('pages.clients.clientInfo')
        }
        footer={null}
        width={640}
        onCancel={() => onOpenChange(false)}
      >
        {client && (
          <>
            <div className="client-info-grid">
              <section className="client-info-section">
                <h4>{t('pages.clients.infoOverview')}</h4>
                <dl>
                  <InfoField label={t('pages.clients.infoName')}>{client.email || '—'}</InfoField>
                  <InfoField label={t('pages.clients.infoConnectionState')}>
                    <Tag className={enabled && isOnline ? 'client-status is-active' : 'client-status'}>
                      {t(enabled && isOnline ? 'pages.clients.online' : 'pages.clients.offline')}
                    </Tag>
                  </InfoField>
                  <InfoField label={t('pages.clients.infoKeyStatus')}>
                    <Tag className={enabled ? 'client-status is-active' : 'client-status'}>
                      {t(enabled ? 'enabled' : 'disabled')}
                    </Tag>
                  </InfoField>
                  <InfoField label={t('lastOnline')}>{dateLabel(traffic?.lastOnline)}</InfoField>
                  {speed && (
                    <InfoField label={t('pages.clients.speed')}><ClientSpeedTag speed={speed} /></InfoField>
                  )}
                </dl>
              </section>

              <section className="client-info-section">
                <h4>{t('pages.clients.infoTrafficLimits')}</h4>
                <dl>
                  <InfoField label={t('pages.inbounds.traffic')}>
                    ↑ {SizeFormatter.sizeFormat(traffic?.up || 0)} / ↓ {SizeFormatter.sizeFormat(traffic?.down || 0)}
                  </InfoField>
                  <InfoField label={t('pages.clients.infoUsedTraffic')}>
                    {SizeFormatter.sizeFormat(used)} / {totalBytes > 0 ? SizeFormatter.sizeFormat(totalBytes) : <InfinityIcon />}
                  </InfoField>
                  <InfoField label={t('remained')}>
                    {remaining < 0 ? <InfinityIcon /> : (
                      <span className={remaining === 0 ? 'client-info-error' : undefined}>{SizeFormatter.sizeFormat(remaining)}</span>
                    )}
                  </InfoField>
                  <InfoField label={t('pages.inbounds.expireDate')}>
                    {expiryLabel(client.expiryTime)}
                    {(client.expiryTime ?? 0) > 0 && (
                      <span className="client-info-hint">{IntlUtil.formatRelativeTime(client.expiryTime!)}</span>
                    )}
                  </InfoField>
                  <InfoField label={t('pages.clients.ipLimit')}>{client.limitIp || <InfinityIcon />}</InfoField>
                  <InfoField label={t('pages.clients.limitHwid')}>{client.limitHwid || <InfinityIcon />}</InfoField>
                  {(traffic?.resetMax ?? 0) > 0 && (
                    <InfoField label={t('pages.clients.renewsUsed')}>
                      <span className={(traffic?.resetCount ?? 0) >= (traffic?.resetMax ?? 0) ? 'client-info-error' : undefined}>
                        {traffic?.resetCount ?? 0} / {traffic?.resetMax}
                      </span>
                    </InfoField>
                  )}
                </dl>
              </section>

              <section className="client-info-section">
                <h4>{t('pages.clients.infoConnection')}</h4>
                <dl>
                  <InfoField label={t('pages.clients.email')}>{client.email || t('none')}</InfoField>
                  {[
                    { label: t('pages.clients.subId'), value: client.subId },
                    { label: t('pages.clients.uuid'), value: client.uuid, optional: true },
                    { label: t('password'), value: client.password, optional: true },
                    { label: t('pages.clients.auth'), value: client.auth, optional: true },
                    { label: t('pages.clients.infoSudokuKey'), value: client.sudokuKey, optional: true },
                    { label: t('pages.clients.mtprotoSecret'), value: client.secret, optional: true },
                  ].filter(({ value, optional }) => value || !optional).map(({ label, value }) => (
                    <InfoField key={label} label={label} action={copyButton(value, label)}>{value || '—'}</InfoField>
                  ))}
                  <InfoField label={t('pages.clients.flow')}>{client.flow || t('none')}</InfoField>
                  {client.security && (
                    <InfoField label={t('pages.clients.vmessSecurity')}>{client.security}</InfoField>
                  )}
                  {client.adTag && (
                    <InfoField label={t('pages.clients.mtprotoAdTag')}>{client.adTag}</InfoField>
                  )}
                  {client.keepAlive !== undefined && (
                    <InfoField label={t('pages.clients.tunnelKeepAlive')}>{client.keepAlive}</InfoField>
                  )}
                  {client.allowedIPs && (
                    <InfoField label={t('pages.clients.wireguardAllowedIPs')}>{client.allowedIPs}</InfoField>
                  )}
                  <InfoField label={t('pages.clients.attachedInbounds')}>
                    {client.inboundIds?.length ? (
                      <span className="client-info-chips">
                        {client.inboundIds.map(id => {
                          const inbound = inboundsById[id];
                          return <Tag key={id}>{formatInboundLabel(inbound?.tag, inbound?.remark) || id}</Tag>;
                        })}
                      </span>
                    ) : '—'}
                  </InfoField>
                </dl>
              </section>

              <section className="client-info-section">
                <h4>{t('pages.clients.infoAdditional')}</h4>
                <dl>
                  <InfoField label={t('pages.inbounds.createdAt')}>{dateLabel(client.createdAt)}</InfoField>
                  <InfoField label={t('pages.inbounds.updatedAt')}>{dateLabel(client.updatedAt)}</InfoField>
                  <InfoField label={t('lastSubFetch')}>{dateLabel(traffic?.lastSubFetch)}</InfoField>
                  <InfoField label={t('pages.inbounds.IPLimitlog')}>
                    <Button size="small" icon={<EyeOutlined aria-hidden />} aria-label={t('pages.clients.ipLog')} loading={ipsLoading} onClick={openIpsModal}>
                      {clientIps.length || null}
                    </Button>
                  </InfoField>
                  <InfoField label={t('pages.clients.hwidLog')}>
                    <Button size="small" icon={<EyeOutlined aria-hidden />} aria-label={t('pages.clients.hwidLog')} loading={hwidsLoading} onClick={openHwidsModal}>
                      {clientHwids.length || null}
                    </Button>
                  </InfoField>
                  {CLIENT_GROUPS_UI_ENABLED && client.group && (
                    <InfoField label={t('pages.clients.group')}>{client.group}</InfoField>
                  )}
                  {client.comment && (
                    <InfoField label={t('pages.clients.comment')}>{client.comment}</InfoField>
                  )}
                </dl>
              </section>
            </div>

            {((showSubscription && subLink) || links.length > 0) && (
              <section className="client-info-section client-info-links">
                {showSubscription && subLink && (
                  <>
                    <h4>{t('subscription.title')}</h4>
                    {([
                      { format: 'standard', label: 'SUB', url: subLink, title: t('subscription.title') },
                      { format: 'json', label: 'JSON', url: subJsonLink, title: 'JSON' },
                      { format: 'clash', label: 'CLASH', url: subClashLink, title: 'Clash / Mihomo' },
                    ] as const).filter(({ url }) => url).map(({ format, label, url, title }) => (
                      <div key={format} className="link-row">
                        <Tag className="link-row-tag" title={title}>{label}</Tag>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-row-title link-row-title-anchor"
                          title={url}
                        >
                          {client.subId}
                        </a>
                        <div className="link-row-actions">
                          <Tooltip title={t('copy')}>
                            <Button size="small" icon={<CopyOutlined aria-hidden />} aria-label={t('copy')} onClick={() => void copyValue(url)} />
                          </Tooltip>
                          <Tooltip title={t('download')}>
                            <Button
                              size="small"
                              icon={<DownloadOutlined aria-hidden />}
                              aria-label={t('download')}
                              loading={downloadingFormat === format}
                              disabled={downloadingFormat !== null}
                              onClick={() => void downloadSubscription(url, format)}
                            />
                          </Tooltip>
                          <Popover
                            trigger="click"
                            placement="left"
                            destroyOnHidden
                            content={<QrPanel value={url} remark={`${client.email} — ${title}`} size={220} />}
                          >
                            <Tooltip title={t('pages.clients.qrCode')}>
                              <Button size="small" icon={<QrcodeOutlined aria-hidden />} aria-label={t('pages.clients.qrCode')} />
                            </Tooltip>
                          </Popover>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {links.length > 0 && (
                  <>
                    <h4>{t('pages.inbounds.copyLink')}</h4>
                    {links.map((link, idx) => {
                      const parts = parseLinkParts(link);
                      const fallback = `${t('pages.clients.link')} ${idx + 1}`;
                      const rowTitle = (parts && linkMetaText(parts)) || fallback;
                      const qrRemark = parts?.remark || rowTitle;
                      const canQr = !isPostQuantumLink(link);
                      return (
                        <div key={idx} className="link-row">
                          <div className="client-info-link-description">
                            {parts ? (
                              <LinkTags parts={parts} neutral />
                            ) : (
                              <Tag className="link-row-tag">LINK</Tag>
                            )}
                            <span className="link-row-title" title={rowTitle}>
                              {rowTitle}
                            </span>
                          </div>
                          <div className="link-row-actions">
                            <Tooltip title={t('copy')}>
                              <Button
                                size="small"
                                icon={<CopyOutlined aria-hidden />}
                                aria-label={t('copy')}
                                onClick={() => copyValue(link)}
                              />
                            </Tooltip>
                            {canQr && (
                              <Popover
                                trigger="click"
                                placement="left"
                                destroyOnHidden
                                content={<QrPanel value={link} remark={qrRemark} size={220} />}
                              >
                                <Tooltip title={t('pages.clients.qrCode')}>
                                  <Button
                                    size="small"
                                    icon={<QrcodeOutlined aria-hidden />}
                                    aria-label={t('pages.clients.qrCode')}
                                  />
                                </Tooltip>
                              </Popover>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

              </section>
            )}

            {wgInbounds.length > 0 && client && (
              <>
              <ClientWireguardDevices
                state={wireguardDevices}
                subLink={subLink}
                clientEmail={client.email}
                configs={wgConfigs}
              />

              {wgConfigs.filter(({ vkLink, enabled }) => enabled && vkLink).map(({ inbound, deviceId, endpoint, vkLink }) => {
                const meta = formatTunnelConfigMeta(inbound, client.email, wgConfigs.length, endpoint);
                return (
                  <ConfigBlock
                    key={`wg-vk-${inbound.id}-${deviceId}-${endpoint}`}
                    label={t('pages.xray.wireguard.vkTurnProfile')}
                    text={vkLink}
                    fileName={meta.fileName.replace(/\.conf$/, `-${deviceId}-vk.txt`)}
                    qrRemark={meta.qrRemark}
                    tagColor="default"
                  />
                );
              })}
              </>
            )}

            {awgConfigs.length > 0 && client && (
              <>
                <h4>{t('pages.clients.amneziaWgConfig')}</h4>
                {awgConfigs.map(({ inbound, endpoint, text }) => {
                  const meta = formatTunnelConfigMeta(
                    inbound,
                    client.email,
                    awgConfigs.length,
                    endpoint,
                  );
                  return (
                    <ConfigBlock
                      key={`awg-${inbound.id}-${endpoint}`}
                      label={meta.label || t('pages.clients.config')}
                      text={text}
                      fileName={meta.fileName}
                      qrRemark={meta.qrRemark}
                      tagColor="default"
                    />
                  );
                })}
              </>
            )}
          </>
        )}
      </DetailSurface>

      <Modal
        open={ipsModalOpen}
        title={`${t('pages.inbounds.IPLimitlog')}${client?.email ? ` — ${client.email}` : ''}`}
        width={440}
        onCancel={() => setIpsModalOpen(false)}
        footer={[
          <Button
            key="refresh"
            icon={<ReloadOutlined aria-hidden />}
            loading={ipsLoading}
            onClick={loadIps}
          >
            {t('refresh')}
          </Button>,
          <Button
            key="clear"
            danger
            loading={ipsClearing}
            disabled={clientIps.length === 0}
            onClick={clearIps}
          >
            {t('pages.clients.clearAll')}
          </Button>,
          <Button key="close" type="primary" onClick={() => setIpsModalOpen(false)}>
            {t('close')}
          </Button>,
        ]}
      >
        {clientIps.length > 0 ? (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {clientIps.map((entry, idx) => (
              <Tag
                key={idx}
                color="blue"
                style={{
                  display: 'block',
                  width: 'fit-content',
                  maxWidth: '100%',
                  marginBottom: 6,
                  padding: '2px 8px',
                  fontFamily: 'Onest, sans-serif',
                }}
              >
                {entry.ip}
                {entry.time ? ` (${entry.time})` : ''}
                {entry.node ? (
                  <span style={{ marginInlineStart: 6, opacity: 0.85, fontWeight: 600 }}>
                    @ {entry.node}
                  </span>
                ) : null}
              </Tag>
            ))}
          </div>
        ) : (
          <Tag>{t('tgbot.noIpRecord')}</Tag>
        )}
      </Modal>

      <ClientHwidListModal
        open={hwidsModalOpen}
        email={client?.email}
        hwids={clientHwids}
        loading={hwidsLoading}
        clearing={hwidsClearing}
        deletingId={deletingHwidId}
        blockingId={blockingHwidId}
        formatDate={dateLabel}
        onRefresh={loadHwids}
        onClearAll={clearHwids}
        onDelete={deleteHwid}
        onSetBlocked={setHwidBlocked}
        onClose={() => setHwidsModalOpen(false)}
      />
    </>
  );
}
