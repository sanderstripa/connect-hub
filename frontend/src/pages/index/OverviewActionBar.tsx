import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Modal, Tag, Tooltip } from 'antd';
import {
  ApiOutlined,
  ArrowUpOutlined,
  AreaChartOutlined,
  BarsOutlined,
  CloudServerOutlined,
  ControlOutlined,
  FileTextOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import SudokuMonitor from './SudokuMonitor';
import { formatPanelVersion } from '@/lib/panel-version';
import type { Status } from '@/models/status';

interface OverviewActionBarProps {
  status: Status;
  isMobile: boolean;
  accessLogEnable: boolean;
  panelVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  onStopXray: () => void | Promise<void>;
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
  disabled?: boolean;
  hint?: string;
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
  const [modal, modalContextHolder] = Modal.useModal();
  const stateText = t(XRAY_STATE_KEYS[status.xray.state] ?? 'pages.index.xrayStatusUnknown');
  const hasVersion = !!status.xray.version && status.xray.version !== 'Unknown';
  const size = isMobile ? ('small' as const) : ('middle' as const);
  const isStopped = status.xray.state === 'stop';

  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [moreOpen]);
  const actionGroups: BarAction[][] = [
    [
      {
        key: 'restart',
        icon: isStopped ? <PlayCircleOutlined aria-hidden /> : <ReloadOutlined aria-hidden />,
        text: t(isStopped ? 'pages.index.startXray' : 'pages.index.restartXray'),
        onClick: onRestartXray,
        primary: true,
      },
      {
        key: 'stop',
        icon: <PoweroffOutlined aria-hidden />,
        text: t('pages.index.stopXray'),
        disabled: isStopped,
        hint: isStopped ? t('pages.index.stopXrayDisabledHint') : undefined,
        onClick: () => {
          modal.confirm({
            title: t('pages.index.stopXrayConfirmTitle'),
            content: t('pages.index.stopXrayConfirmContent'),
            okText: t('pages.index.stopXrayConfirmOk'),
            okType: 'danger',
            cancelText: t('cancel'),
            focusable: { autoFocusButton: 'cancel' },
            onOk: onStopXray,
          });
        },
      },
    ],
    [
      {
        key: 'logs',
        icon: <BarsOutlined aria-hidden />,
        text: t('pages.index.logs'),
        onClick: onOpenLogs,
      },
      ...(accessLogEnable
        ? [
            {
              key: 'accessLogs',
              icon: <FileTextOutlined aria-hidden />,
              text: t('pages.index.accessLogs'),
              onClick: onOpenXrayLogs,
            },
          ]
        : []),
      ...(status.amneziawg.configured
        ? [
            {
              key: 'amneziawgLogs',
              icon: <ApiOutlined aria-hidden />,
              text: t('pages.index.amneziawgLogs'),
              onClick: onOpenAmneziaWGLogs,
            },
          ]
        : []),
      {
        key: 'config',
        icon: <ControlOutlined aria-hidden />,
        text: t('pages.index.config'),
        onClick: onOpenConfig,
      },
      {
        key: 'backup',
        icon: <CloudServerOutlined aria-hidden />,
        text: t('pages.index.backupTitle'),
        onClick: onOpenBackup,
      },
    ],
    [
      {
        key: 'history',
        icon: <AreaChartOutlined aria-hidden />,
        text: t('pages.index.systemHistoryTitle'),
        onClick: onOpenSystemHistory,
      },
      {
        key: 'metrics',
        icon: <ArrowUpOutlined aria-hidden />,
        text: t('pages.index.xrayMetricsTitle'),
        onClick: onOpenXrayMetrics,
      },
    ],
  ];

  const statePill = (
    <span className="ov-state" data-state={status.xray.state} title={stateText}>
      <span aria-label={`Xray: ${stateText}`}>Xray</span>
      {hasVersion && (
        <Tooltip title={t('pages.index.xraySwitch')}>
          <button type="button" className="ov-state-version" onClick={onOpenVersionSwitch}>
            {isMobile ? status.xray.version : `v${status.xray.version}`}
          </button>
        </Tooltip>
      )}
    </span>
  );

  return (
    <div className="ov-bar">
      {modalContextHolder}
      <div className="ov-versions">
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

        <SudokuMonitor compact={isMobile} />

        <span className="ov-state ov-panel-state">
          <span>{t('pages.index.panel')}</span>
          <Tooltip
            title={
              updateAvailable
                ? `${t('update')} ${formatPanelVersion(latestVersion)}`
                : t('pages.index.updatePanel')
            }
          >
            <button type="button" className={`ov-state-version ov-panel-version${updateAvailable ? ' ov-update-tag' : ''}`} onClick={onOpenPanelUpdate}>
              {isMobile ? panelVersion.replace(/^v(?=\d)/i, '') : formatPanelVersion(panelVersion)}
            </button>
          </Tooltip>
        </span>
      </div>

      <div className="ov-bar-actions">
        {[...actionGroups[0], actionGroups[1][0]].map((action) => (
          <Button
            key={action.key}
            type="text"
            className={`ov-icon-action ov-action-${action.key}`}
            title={action.hint || action.text}
            disabled={action.disabled}
            size={size}
            icon={action.icon}
            aria-label={action.text}
            onClick={action.onClick}
          ></Button>
        ))}
        <Dropdown
          trigger={['click']}
          open={moreOpen}
          onOpenChange={setMoreOpen}
          menu={{
            items: [
              {
                type: 'group',
                key: 'maintenance',
                label: t('pages.index.maintenance'),
                children: actionGroups[1]
                  .filter((a) => ['config', 'backup'].includes(a.key))
                  .map((a) => ({ key: a.key, icon: a.icon, label: a.text, onClick: a.onClick })),
              },
              { type: 'divider' },
              {
                type: 'group',
                key: 'diagnostics',
                label: t('pages.index.diagnostics'),
                children: [
                  ...actionGroups[2],
                  ...actionGroups[1].filter((a) => ['accessLogs', 'amneziawgLogs'].includes(a.key)),
                ].map((a) => ({ key: a.key, icon: a.icon, label: a.text, onClick: a.onClick })),
              },
            ],
          }}
        >
          <Button
            type="text"
            className="ov-icon-action ov-action-more"
            title={t('pages.index.more')}
            size={size}
            icon={<MoreOutlined rotate={90} aria-hidden />}
            aria-label={t('pages.index.more')}
            aria-expanded={moreOpen}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setMoreOpen(false);
            }}
          ></Button>
        </Dropdown>
      </div>
    </div>
  );
}
