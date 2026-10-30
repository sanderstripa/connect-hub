import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  ApiOutlined,
  ApartmentOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  CodeOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DiscordOutlined,
  ExportOutlined,
  GithubOutlined,
  GlobalOutlined,
  ImportOutlined,
  LogoutOutlined,
  MailOutlined,
  MoonOutlined,
  SafetyOutlined,
  SearchOutlined,
  SettingOutlined,
  SunOutlined,
  SwapOutlined,
  TelegramFilled,
  ToolOutlined,
} from '@ant-design/icons';
import { HttpUtil } from '@/utils';
import { formatPanelVersion } from '@/lib/panel-version';
import { useTheme } from '@/hooks/useTheme';
import { useAllSettings } from '@/api/queries/useAllSettings';
import { useCommandPalette } from '@/components/command-palette/useCommandPalette';
import './AppSidebar.css';

const REPO_URL = 'https://github.com/sanderstripa/connect-hub';

export default function AppSidebar() {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { open: openSearch } = useCommandPalette();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const { allSetting } = useAllSettings();
  const showSubFormats = !!(allSetting.subJsonEnable || allSetting.subClashEnable);
  const showSubBalancers = !!allSetting.subJsonEnable;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && openMenu) {
        document.querySelector<HTMLElement>(`[data-nav-group="${openMenu}"]`)?.focus();
        setOpenMenu(null);
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyK') setOpenMenu(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMenu]);
  const openLink = useCallback(
    (key: string) => {
      setOpenMenu(null);
      navigate(key);
    },
    [navigate],
  );
  const settingsChildren = useMemo<NonNullable<MenuProps['items']>>(() => {
    const children: NonNullable<MenuProps['items']> = [
      {
        key: '/settings#general',
        icon: <SettingOutlined aria-hidden />,
        label: t('pages.settings.panelSettings'),
      },
      {
        key: '/settings#security',
        icon: <SafetyOutlined aria-hidden />,
        label: t('pages.settings.securitySettings'),
      },
      {
        key: '/settings#telegram',
        icon: <TelegramFilled aria-hidden />,
        label: t('pages.settings.TGBotSettings'),
      },
      {
        key: '/settings#email',
        icon: <MailOutlined aria-hidden />,
        label: t('pages.settings.emailSettings'),
      },
      {
        key: '/settings#discord',
        icon: <DiscordOutlined aria-hidden />,
        label: t('pages.settings.discordSettings'),
      },
      {
        key: '/settings#subscription',
        icon: <CloudServerOutlined aria-hidden />,
        label: t('pages.settings.subSettings'),
      },
    ];
    if (showSubFormats) {
      children.push({
        key: '/settings#subscription-formats',
        icon: <CodeOutlined aria-hidden />,
        label: t('menu.subFormats'),
      });
    }
    if (showSubBalancers) {
      children.push({
        key: '/settings#subscription-balancers',
        icon: <ApartmentOutlined aria-hidden />,
        label: t('pages.settings.subBalancers.menu'),
      });
    }
    children.push({
      key: '/api-docs',
      icon: <ApiOutlined aria-hidden />,
      label: t('menu.apiDocs'),
    });
    return children;
  }, [t, showSubFormats, showSubBalancers]);

  const xrayChildren = useMemo<NonNullable<MenuProps['items']>>(
    () => [
      {
        key: '/xray#basic',
        icon: <SettingOutlined aria-hidden />,
        label: t('pages.xray.basicTemplate'),
      },
      {
        key: '/xray#balancer',
        icon: <ClusterOutlined aria-hidden />,
        label: t('pages.xray.Balancers'),
      },
      { key: '/xray#dns', icon: <DatabaseOutlined aria-hidden />, label: 'DNS' },
      {
        key: '/xray#advanced',
        icon: <CodeOutlined aria-hidden />,
        label: t('pages.xray.advancedTemplate'),
      },
    ],
    [t],
  );

  const items = [
    {
      key: '/',
      title: t('menu.dashboard'),
      icon: <DashboardOutlined aria-hidden />,
      active: pathname === '/',
    },
    {
      key: '/connections',
      title: t('menu.connections'),
      icon: <ImportOutlined aria-hidden />,
      active: ['/connections', '/inbounds', '/clients'].includes(pathname),
    },
    {
      key: 'infrastructure',
      title: t('menu.infrastructure'),
      icon: <ClusterOutlined aria-hidden />,
      active: ['/nodes', '/hosts'].includes(pathname),
      children: [
        { key: '/nodes', icon: <ClusterOutlined aria-hidden />, label: t('menu.nodes') },
        { key: '/hosts', icon: <GlobalOutlined aria-hidden />, label: t('menu.hosts') },
      ],
    },
    {
      key: 'network',
      title: t('menu.network'),
      icon: <SwapOutlined aria-hidden />,
      active: ['/outbound', '/routing'].includes(pathname),
      children: [
        { key: '/outbound', icon: <ExportOutlined aria-hidden />, label: t('menu.outbounds') },
        { key: '/routing', icon: <SwapOutlined aria-hidden />, label: t('menu.routing') },
      ],
    },
    {
      key: 'settings',
      title: t('menu.settings'),
      icon: <SettingOutlined aria-hidden />,
      active: ['/settings', '/api-docs'].includes(pathname),
      children: settingsChildren,
    },
    {
      key: 'xray',
      title: t('menu.xray'),
      icon: <ToolOutlined aria-hidden />,
      active: pathname === '/xray',
      children: xrayChildren,
    },
  ];
  const selected =
    pathname +
    (hash || (pathname === '/settings' ? '#general' : pathname === '/xray' ? '#basic' : ''));
  return (
    <>
      <aside className="ant-sidebar" aria-label="Connect Hub">
        <div className="compact-rail">
          <a
            className="rail-brand"
            href={(window.X_UI_BASE_PATH || '/') + 'panel/'}
            onClick={(event) => {
              event.preventDefault();
              openLink('/');
            }}
            aria-label="Connect Hub"
          >
            C.
          </a>
          <nav className="rail-nav">
            {items.map((item) => {
              const button = (
                <button
                  type="button"
                  className={'rail-button' + (item.active ? ' is-active' : '')}
                  aria-label={item.title}
                  aria-current={item.active ? 'page' : undefined}
                  data-nav-group={item.key}
                  aria-haspopup={item.children ? 'menu' : undefined}
                  aria-expanded={item.children ? openMenu === item.key : undefined}
                  onClick={() => {
                    if (!item.children) openLink(item.key);
                  }}
                >
                  {item.icon}
                </button>
              );
              return (
                <Tooltip
                  key={item.key}
                  title={openMenu === item.key ? null : item.title}
                  placement="right"
                >
                  {item.children ? (
                    <Dropdown
                      destroyOnHidden
                      trigger={['click']}
                      placement="rightTop"
                      open={openMenu === item.key}
                      onOpenChange={(open) => setOpenMenu(open ? item.key : null)}
                      autoAdjustOverflow
                      overlayClassName="rail-submenu"
                      menu={{
                        items: item.children,
                        selectedKeys: [selected],
                        onClick: ({ key }) => openLink(key),
                      }}
                    >
                      {button}
                    </Dropdown>
                  ) : (
                    button
                  )}
                </Tooltip>
              );
            })}
          </nav>
          <div className="rail-utilities">
            <Tooltip title={t('commandPalette.title')} placement="right">
              <button
                type="button"
                className="global-search-trigger rail-button"
                aria-label={t('commandPalette.title')}
                aria-keyshortcuts="Control+k Meta+k"
                onClick={() => {
                  setOpenMenu(null);
                  openSearch();
                }}
              >
                <SearchOutlined aria-hidden />
              </button>
            </Tooltip>
            <Tooltip title={t('menu.theme')} placement="right">
              <button
                id="theme-cycle"
                type="button"
                className="rail-button"
                aria-label={t('menu.theme')}
                onClick={toggleTheme}
              >
                {isDark ? <MoonOutlined aria-hidden /> : <SunOutlined aria-hidden />}
              </button>
            </Tooltip>
            <Tooltip
              title={'GitHub ' + formatPanelVersion(window.X_UI_CUR_VER || '')}
              placement="right"
            >
              <a
                className="rail-button"
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
              >
                <GithubOutlined aria-hidden />
              </a>
            </Tooltip>
            <Tooltip title={t('logout')} placement="right">
              <button
                type="button"
                className="rail-button"
                aria-label={t('logout')}
                onClick={async () => {
                  await HttpUtil.post('/logout');
                  window.location.href = window.X_UI_BASE_PATH || '/';
                }}
              >
                <LogoutOutlined aria-hidden />
              </button>
            </Tooltip>
          </div>
        </div>
      </aside>
    </>
  );
}
