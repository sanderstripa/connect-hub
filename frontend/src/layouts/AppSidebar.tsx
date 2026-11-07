import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Drawer, Dropdown, Menu, Tooltip } from 'antd';
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
  FileTextOutlined,
  GithubOutlined,
  GlobalOutlined,
  ImportOutlined,
  LogoutOutlined,
  MailOutlined,
  MoonOutlined,
  SafetyOutlined,
  SearchOutlined,
  RobotOutlined,
  SettingOutlined,
  SunOutlined,
  SwapOutlined,
  TelegramFilled,
  WechatOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { HttpUtil } from '@/utils';
import { formatPanelVersion } from '@/lib/panel-version';
import { PALETTE_IDS, PALETTE_NAMES } from '@/lib/theme-palettes';
import { ACCENT_CHOICES, useTheme } from '@/hooks/useTheme';
import { useAllSettings } from '@/api/queries/useAllSettings';
import { useCommandPalette } from '@/components/command-palette/useCommandPalette';
import './AppSidebar.css';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useMobileNavigation } from './MobileNavigation';

const REPO_URL = 'https://github.com/sanderstripa/connect-hub';

export default function AppSidebar() {
  const { t } = useTranslation();
  const { isMobile } = useMediaQuery();
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileNavigation();

  const { isDark, toggleTheme, palette, setPalette, accent, setAccent, glass, setGlass, followSystem, setFollowSystem } = useTheme();
  const themeMenu: MenuProps = {
    selectedKeys: [palette],
    items: [
      { key: 'mode', label: t('menu.theme'), onClick: toggleTheme },
      { key: 'system-mode', label: `${followSystem ? '✓ ' : ''}${t('menu.theme')} · Auto`, onClick: () => setFollowSystem(!followSystem) },
      { type: 'divider' },
      ...PALETTE_IDS.map((id) => ({
        key: id,
        label: PALETTE_NAMES[id],
        onClick: () => setPalette(id),
      })),
      { type: 'divider' },
      { key: 'accent-group', type: 'group', label: 'Accent colors', children: Object.entries(ACCENT_CHOICES).map(([id,color]) => ({
        key: `accent-${id}`,
        label: <span style={{display:'inline-flex',alignItems:'center',gap:8}}><span style={{width:12,height:12,borderRadius:12,background:color,display:'inline-block',border:'1px solid var(--border)'}}/>{id[0].toUpperCase()+id.slice(1)}{accent === id ? ' ✓' : ''}</span>,
        onClick: () => setAccent(id as keyof typeof ACCENT_CHOICES),
      })) },
      { type: 'divider' },
      { key: 'glassy-mode', label: `Glassy style ${glass ? '✓' : ''}`, onClick: () => setGlass(!glass) },
    ],
  };
  const { open: openSearch } = useCommandPalette();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, hash, isMobile, setMobileOpen]);
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
      setMobileOpen(false);
      navigate(key);
    },
    [navigate, setMobileOpen],
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
        key: '/settings#wechat',
        icon: <WechatOutlined aria-hidden />,
        label: t('pages.settings.wechatSettings'),
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
      key: '/logs',
      title: t('menu.logs'),
      icon: <FileTextOutlined aria-hidden />,
      active: pathname === '/logs',
    },
    {
      key: '/assistant',
      title: t('menu.assistant', { defaultValue: 'AI Assistant' }),
      icon: <RobotOutlined aria-hidden />,
      active: pathname === '/assistant',
    },
    {
      key: 'network',
      title: t('menu.network'),
      icon: <SwapOutlined aria-hidden />,
      active: ['/nodes', '/hosts', '/outbound', '/routing', '/clean-ip', '/dns-tunnel', '/tunnels'].includes(pathname),
      children: [
        { key: '/nodes', icon: <ClusterOutlined aria-hidden />, label: t('menu.nodes') },
        { key: '/hosts', icon: <GlobalOutlined aria-hidden />, label: t('menu.hosts') },
        { key: '/clean-ip', icon: <SearchOutlined aria-hidden />, label: 'Clean IP' },
        { key: '/dns-tunnel', icon: <DatabaseOutlined aria-hidden />, label: 'DNS Tunnel' },
        { key: '/tunnels', icon: <SwapOutlined aria-hidden />, label: t('menu.tunnels') },
        { key: '/outbound', icon: <ExportOutlined aria-hidden />, label: t('menu.outbounds') },
        { key: '/routing', icon: <SwapOutlined aria-hidden />, label: t('menu.routing') },
      ],
    },
    {
      key: 'xray',
      title: t('menu.xray'),
      icon: <ToolOutlined aria-hidden />,
      active: pathname === '/xray',
      children: xrayChildren,
    },
  ];
  const settingsItem = {
    key: 'settings',
    title: t('menu.settings'),
    icon: <SettingOutlined aria-hidden />,
    active: ['/settings', '/api-docs'].includes(pathname),
    children: settingsChildren,
  };
  const selected =
    pathname +
    (hash || (pathname === '/settings' ? '#general' : pathname === '/xray' ? '#basic' : ''));
  function renderItem(item: typeof settingsItem | (typeof items)[number]) {
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
      <Tooltip key={item.key} title={openMenu === item.key ? null : item.title} placement="right">
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
  }
  if (isMobile)
    return (
      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Connect. Hub"
        size="min(320px, 86vw)"
        rootClassName="mobile-navigation-drawer"
      >
        <nav id="mobile-navigation" aria-label={t('menu.navigation')}>
          <Menu
            mode="inline"
            selectedKeys={[selected, pathname]}
            items={[...items, settingsItem].map((item) => ({
              key: item.key,
              label: item.title,
              icon: item.icon,
              children: item.children,
            }))}
            onClick={({ key }) => openLink(key)}
          />
          <div className="mobile-nav-utilities">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openSearch();
              }}
            >
              <SearchOutlined aria-hidden />
              {t('commandPalette.title')}
            </button>
            <Dropdown menu={themeMenu} trigger={['click']}>
              <button type="button">
                {isDark ? <MoonOutlined aria-hidden /> : <SunOutlined aria-hidden />}
                {t('menu.theme')}
              </button>
            </Dropdown>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              <GithubOutlined aria-hidden />
              GitHub
            </a>
            <button
              type="button"
              onClick={async () => {
                await HttpUtil.post('/logout');
                window.location.href = window.X_UI_BASE_PATH || '/';
              }}
            >
              <LogoutOutlined aria-hidden />
              {t('logout')}
            </button>
          </div>
        </nav>
      </Drawer>
    );
  return (
    <>
      <aside className="ant-sidebar" aria-label="Connect Hub">
        <div className="compact-rail">
          <nav className="rail-nav">{items.map((item) => renderItem(item))}</nav>
          <div className="rail-utilities">
            {renderItem(settingsItem)}
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
            <Dropdown menu={themeMenu} trigger={['click']} placement="topRight">
              <Tooltip title={t('menu.theme')} placement="right">
                <button
                  id="theme-cycle"
                  type="button"
                  className="rail-button"
                  aria-label={t('menu.theme')}
                >
                  {isDark ? <MoonOutlined aria-hidden /> : <SunOutlined aria-hidden />}
                </button>
              </Tooltip>
            </Dropdown>
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
