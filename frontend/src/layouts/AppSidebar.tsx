import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Drawer, Dropdown, Menu, Tooltip } from 'antd';
import {
  ApiOutlined,
  ApartmentOutlined,
  BgColorsOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  CodeOutlined,
  DashboardOutlined,
  DownOutlined,
  DatabaseOutlined,
  DiscordOutlined,
  ExportOutlined,
  FileTextOutlined,
  GithubOutlined,
  GlobalOutlined,
  ImportOutlined,
  LogoutOutlined,
  MailOutlined,
  SafetyOutlined,
  SearchOutlined,
  RobotOutlined,
  SettingOutlined,
  SwapOutlined,
  TelegramFilled,
  WechatOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { HttpUtil } from '@/utils';
import { formatPanelVersion } from '@/lib/panel-version';
import { useAllSettings } from '@/api/queries/useAllSettings';
import { useCommandPalette } from '@/components/command-palette/useCommandPalette';
import './AppSidebar.css';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useMobileNavigation } from './MobileNavigation';

type NavigationEntry = { key: string; label: React.ReactNode; icon: React.ReactNode };
const REPO_URL = 'https://github.com/sanderstripa/connect-hub';

export default function AppSidebar({ header = false }: { header?: boolean }) {
  const { t } = useTranslation();
  const { isMobile } = useMediaQuery();
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileNavigation();

  const { open: openSearch } = useCommandPalette();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!header) setMobileOpen(false);
  }, [pathname, hash, isMobile, header, setMobileOpen]);
  const { allSetting } = useAllSettings();
  const showSubFormats = !!(allSetting.subJsonEnable || allSetting.subClashEnable);
  const showSubBalancers = !!allSetting.subJsonEnable;
  const [networkOpen, setNetworkOpen] = useState(false);
  const networkTrigger = useRef<HTMLButtonElement>(null);
  const focusNetworkMenu = useCallback((popup: HTMLDivElement | null) => {
    if (!popup) return;
    requestAnimationFrame(() => {
      if (networkTrigger.current?.getAttribute('aria-expanded') === 'true') {
        popup.querySelector<HTMLElement>('[role="menu"]')?.focus({ preventScroll: true });
      }
    });
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setNetworkOpen(false);
        networkTrigger.current?.focus();
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyK') {
        setNetworkOpen(false);
      }
    }
    if (!networkOpen) return;
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [networkOpen]);
  const openLink = useCallback(
    (key: string) => {
      setNetworkOpen(false);
      setMobileOpen(false);
      navigate(key);
    },
    [navigate, setMobileOpen],
  );
  const settingsChildren = useMemo<NavigationEntry[]>(() => {
    const children: NavigationEntry[] = [
      {
        key: '/settings#general',
        icon: <SettingOutlined aria-hidden />,
        label: t('pages.settings.panelSettings'),
      },
      {
        key: '/settings#appearance',
        icon: <BgColorsOutlined aria-hidden />,
        label: t('menu.appearance'),
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
    children.push(
      { key: '/logs', icon: <FileTextOutlined aria-hidden />, label: t('menu.logs') },
      { key: '/assistant', icon: <RobotOutlined aria-hidden />, label: t('menu.assistant') },
      { key: '/api-docs', icon: <ApiOutlined aria-hidden />, label: t('menu.apiDocs') },
    );
    return children;
  }, [t, showSubFormats, showSubBalancers]);

  const xrayChildren = useMemo<NavigationEntry[]>(
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
      key: 'network',
      title: t('menu.network'),
      icon: <SwapOutlined aria-hidden />,
      active: [
        '/groups',
        '/nodes',
        '/hosts',
        '/outbound',
        '/routing',
        '/clean-ip',
        '/dns-tunnel',
        '/tunnels',
        '/node-routing',
      ].includes(pathname),
      children: [
        { key: '/groups', icon: <ApartmentOutlined aria-hidden />, label: t('menu.groups') },
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
    active: ['/settings', '/logs', '/assistant', '/api-docs'].includes(pathname),
    children: settingsChildren,
  };
  const selected =
    pathname +
    (hash || (pathname === '/settings' ? '#general' : pathname === '/xray' ? '#basic' : ''));
  const network = items[2];
  const settingsActive = settingsItem.active || pathname === '/xray';

  function logout() {
    return HttpUtil.post('/logout').then(() => {
      window.location.href = window.X_UI_BASE_PATH || '/';
    });
  }

  if (header) {
    if (isMobile) return null;
    return (
      <>
        <nav className="desktop-navigation" aria-label={t('menu.navigation')}>
          {items.slice(0, 2).map((item) => (
            <Link
              key={item.key}
              to={item.key}
              className="header-control"
              aria-label={item.key === '/' ? t('pages.logs.tabs.overview') : item.title}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.key === '/' ? t('pages.logs.tabs.overview') : item.title}</span>
            </Link>
          ))}
          <Dropdown
            popupRender={(menu) => <div ref={focusNetworkMenu}>{menu}</div>}
            destroyOnHidden
            trigger={['click']}
            placement="bottomLeft"
            open={networkOpen}
            onOpenChange={setNetworkOpen}
            classNames={{ root: 'network-menu' }}
            menu={{
              items: network.children,
              selectedKeys: [pathname],
              onClick: ({ key }) => openLink(key),
            }}
          >
            <button
              type="button"
              className="header-control"
              ref={networkTrigger}
              aria-label={network.title}
              aria-current={network.active ? 'page' : undefined}
              aria-haspopup="menu"
              aria-expanded={networkOpen}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setNetworkOpen(true);
                }
              }}
            >
              {network.icon}
              <span>{network.title}</span>
              <DownOutlined className="header-chevron" aria-hidden />
            </button>
          </Dropdown>
        </nav>
        <div className="header-utilities">
          <Tooltip title={t('commandPalette.title')}>
            <button
              type="button"
              className="header-control global-search-trigger"
              aria-label={t('commandPalette.title')}
              aria-keyshortcuts="Control+k Meta+k"
              onClick={() => {
                setNetworkOpen(false);
                openSearch();
              }}
            >
              <SearchOutlined aria-hidden />
            </button>
          </Tooltip>
          <Tooltip title={settingsItem.title}>
            <Link
              className="header-control"
              to="/settings"
              aria-label={settingsItem.title}
              aria-current={settingsActive ? 'page' : undefined}
            >
              {settingsItem.icon}
              <span className="header-settings-label">{settingsItem.title}</span>
            </Link>
          </Tooltip>
          <Tooltip title={'GitHub ' + formatPanelVersion(window.X_UI_CUR_VER || '')}>
            <a
              className="header-control"
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <GithubOutlined aria-hidden />
            </a>
          </Tooltip>
          <Tooltip title={t('logout')}>
            <button
              type="button"
              className="header-control"
              aria-label={t('logout')}
              onClick={logout}
            >
              <LogoutOutlined aria-hidden />
            </button>
          </Tooltip>
        </div>
      </>
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
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              <GithubOutlined aria-hidden />
              GitHub
            </a>
            <button type="button" onClick={logout}>
              <LogoutOutlined aria-hidden />
              {t('logout')}
            </button>
          </div>
        </nav>
      </Drawer>
    );
  if (!settingsActive) return null;

  const sectionKeys = [
    ['/settings#general', '/settings#appearance', '/settings#security'],
    ['/settings#telegram', '/settings#email', '/settings#discord', '/settings#wechat'],
    [
      '/settings#subscription',
      '/settings#subscription-formats',
      '/settings#subscription-balancers',
      '/settings#subscription-chains',
    ],
    ['/logs', '/assistant', '/api-docs'],
    ['/settings#about'],
  ];
  const labels = [
    t('pages.settings.panelSettings'),
    t('pages.settings.notifications'),
    t('pages.settings.subSettings'),
    t('pages.index.diagnostics'),
    t('pages.index.currentPanelVersion'),
  ];
  const entries: Record<string, { label: React.ReactNode; icon?: React.ReactNode }> = {};
  for (const item of [...settingsChildren, ...xrayChildren]) {
    entries[item.key] = item;
  }
  if (showSubBalancers) {
    entries['/settings#subscription-chains'] = {
      label: t('pages.settings.chainProxies.menu'),
      icon: <SwapOutlined aria-hidden />,
    };
  }

  entries['/settings#about'] = {
    label: t('pages.index.updatePanel'),
    icon: <CloudServerOutlined aria-hidden />,
  };

  function settingsLink(key: string) {
    const entry = entries[key];
    if (!entry) return null;
    return (
      <Link key={key} to={key} aria-current={selected === key ? 'page' : undefined}>
        {entry.icon}
        <span>{entry.label}</span>
      </Link>
    );
  }

  return (
    <nav className="settings-navigation" aria-label={t('menu.settings')}>
      <div className="settings-navigation-inner">
        <h2>{t('menu.settings')}</h2>
        {sectionKeys.map((keys, index) => (
          <section key={keys[0]}>
            {index !== 0 && <h3>{labels[index]}</h3>}
            {keys.map(settingsLink)}
          </section>
        ))}
        <section>
          <h3>{t('menu.networkCores')}</h3>
          <h4>Xray</h4>
          {['/xray#basic', '/xray#balancer', '/xray#dns', '/xray#advanced'].map(settingsLink)}
        </section>
      </div>
    </nav>
  );
}
