import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Tag, Tooltip } from 'antd';
import {
  ApiOutlined,
  ArrowUpOutlined,
  AreaChartOutlined,
  BarsOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  ControlOutlined,
  FileTextOutlined,
  MoreOutlined,
  PoweroffOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import { formatPanelVersion } from '@/lib/panel-version';
import type { Status } from '@/models/status';

interface OverviewActionBarProps {
  status: Status;
  isMobile: boolean;
  accessLogEnable: boolean;
  panelVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  onStopXray: () => void;
  onRestartXray: () => void;
  onOpenLogs: () => void;
  onOpenXrayLogs: () => void;
  onOpenAmneziaWGLogs: () => void;
  onOpenConfig: () => void;
  onOpenBackup: () => void;
  onOpenSystemHistory: () => void;
  onOpenXrayMetrics: () => void;
  onOpenPanelUpdate: () => void;
  onOpenVersionSwitch: () => void;
}

interface BarAction {
  key: string;
  icon: ReactNode;
  text: string;
  onClick: () => void;
  primary?: boolean;
}

const XRAY_STATE_KEYS: Record<string, string> = {
  running: 'pages.index.xrayStatusRunning',
  stop: 'pages.index.xrayStatusStop',
  error: 'pages.index.xrayStatusError',
};

export default function OverviewActionBar({
  status,
  isMobile,
  accessLogEnable,
  panelVersion,
  latestVersion,
  updateAvailable,
  onStopXray,
  onRestartXray,
  onOpenLogs,
  onOpenXrayLogs,
  onOpenAmneziaWGLogs,
  onOpenConfig,
  onOpenBackup,
  onOpenSystemHistory,
  onOpenXrayMetrics,
  onOpenPanelUpdate,
  onOpenVersionSwitch,
}: OverviewActionBarProps) {
  const { t } = useTranslation();
  const stateText = t(XRAY_STATE_KEYS[status.xray.state] ?? 'pages.index.xrayStatusUnknown');
  const hasVersion = !!status.xray.version && status.xray.version !== 'Unknown';
  const size = isMobile ? ('small' as const) : ('middle' as const);

  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [moreOpen]);
  const actionGroups: BarAction[][] = [
    [
      {
        key: 'restart',
        icon: <ReloadOutlined />,
        text: t('pages.index.restartXray'),
        onClick: onRestartXray,
        primary: true,
      },
      {
        key: 'stop',
        icon: <PoweroffOutlined />,
        text: t('pages.index.stopXray'),
        onClick: onStopXray,
      },
    ],
    [
      { key: 'logs', icon: <BarsOutlined />, text: t('pages.index.logs'), onClick: onOpenLogs },
      ...(accessLogEnable
        ? [
            {
              key: 'accessLogs',
              icon: <FileTextOutlined />,
              text: t('pages.index.accessLogs'),
              onClick: onOpenXrayLogs,
            },
          ]
        : []),
      ...(status.amneziawg.configured
        ? [
            {
              key: 'amneziawgLogs',
              icon: <ApiOutlined />,
              text: t('pages.index.amneziawgLogs'),
              onClick: onOpenAmneziaWGLogs,
            },
          ]
        : []),
      {
        key: 'config',
        icon: <ControlOutlined />,
        text: t('pages.index.config'),
        onClick: onOpenConfig,
      },
      {
        key: 'backup',
        icon: <CloudServerOutlined />,
        text: t('pages.index.backupTitle'),
        onClick: onOpenBackup,
      },
    ],
    [
      {
        key: 'history',
        icon: <AreaChartOutlined />,
        text: t('pages.index.systemHistoryTitle'),
        onClick: onOpenSystemHistory,
      },
      {
        key: 'metrics',
        icon: <ArrowUpOutlined />,
        text: t('pages.index.xrayMetricsTitle'),
        onClick: onOpenXrayMetrics,
      },
    ],
  ];

  const statePill = (
    <span className="ov-state" data-state={status.xray.state}>
      <span className="ov-state-dot" style={{ color: status.xray.color }} />
      <span>{`${t('pages.index.xrayStatus')} · ${stateText}`}</span>
      {hasVersion && (
        <Tooltip title={t('pages.index.xraySwitch')}>
          <button type="button" className="ov-state-version" onClick={onOpenVersionSwitch}>
            {`v${status.xray.version}`}
          </button>
        </Tooltip>
      )}
    </span>
  );

  return (
    <div className="ov-bar">
      {status.xray.errorMsg ? (
        <Tooltip title={<span className="ov-error-detail">{status.xray.errorMsg}</span>}>
          {statePill}
        </Tooltip>
      ) : (
        statePill
      )}

      {status.xray.state === 'running' && status.xray.errorMsg ? (
        <Tooltip title={<span className="ov-error-detail">{status.xray.errorMsg}</span>}>
          <Tag color="error">{t('pages.index.xrayStatusError')}</Tag>
        </Tooltip>
      ) : null}

      {updateAvailable ? (
        <Tag
          className="ov-update-tag"
          color="warning"
          icon={<CloudDownloadOutlined />}
          onClick={onOpenPanelUpdate}
        >
          {`${t('update')} ${formatPanelVersion(latestVersion)}`}
        </Tag>
      ) : (
        <Tooltip title={t('pages.index.updatePanel')}>
          <button type="button" className="ov-panel-version ov-mono" onClick={onOpenPanelUpdate}>
            {formatPanelVersion(panelVersion)}
          </button>
        </Tooltip>
      )}

      <div className="ov-bar-actions">
        {[...actionGroups[0], actionGroups[1][0]].map(action => (
          <Button key={action.key} type={action.primary ? undefined : 'text'}
            color={action.primary ? 'primary' : undefined} variant={action.primary ? 'outlined' : undefined}
            size={size} icon={action.icon} aria-label={action.text} onClick={action.onClick}>
            {isMobile ? undefined : action.text}
          </Button>
        ))}
        <Dropdown trigger={['click']} open={moreOpen} onOpenChange={setMoreOpen}
          menu={{ items: [
            { type: 'group', key: 'maintenance', label: t('pages.index.maintenance'),
              children: actionGroups[1].filter(a => ['config', 'backup'].includes(a.key)).map(a =>
                ({ key: a.key, icon: a.icon, label: a.text, onClick: a.onClick })) },
            { type: 'divider' },
            { type: 'group', key: 'diagnostics', label: t('pages.index.diagnostics'),
              children: [...actionGroups[2], ...actionGroups[1].filter(a => ['accessLogs', 'amneziawgLogs'].includes(a.key))].map(a =>
                ({ key: a.key, icon: a.icon, label: a.text, onClick: a.onClick })) },
          ] }}>
          <Button size={size} icon={<MoreOutlined />} aria-label={t('pages.index.more')}
            aria-expanded={moreOpen} onKeyDown={event => { if (event.key === 'Escape') setMoreOpen(false); }}>
            {t('pages.index.more')}
          </Button>
        </Dropdown>
      </div>
    </div>
  );
}
