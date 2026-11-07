import { lazy } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { ComponentType } from 'react';
import {
  ApiOutlined,
  ClusterOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  ExportOutlined,
  FileTextOutlined,
  GlobalOutlined,
  ImportOutlined,
  RobotOutlined,
  SettingOutlined,
  SwapOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';

const IndexPage = lazy(() => import('@/pages/index/IndexPage'));
const ConnectionsPage = lazy(() => import('@/pages/connections/ConnectionsPage'));
function LegacyConnections({ keys = false }: { keys?: boolean }) {
  const location = useLocation();
  return <Navigate to={'/connections' + location.search + (keys ? '#keys' : location.hash)} replace />;
}
const LegacyInbounds = () => <LegacyConnections />;
const LegacyClients = () => <LegacyConnections keys />;
const GroupsPage = lazy(() => import('@/pages/groups/GroupsPage'));
const TunnelsPage = lazy(() => import('@/pages/tunnels/TunnelsPage'));
const NodesPage = lazy(() => import('@/pages/nodes/NodesPage'));
const HostsPage = lazy(() => import('@/pages/hosts/HostsPage'));
const CleanIpPage = lazy(() => import('@/pages/clean-ip/CleanIpPage'));
const DnsTunnelPage = lazy(() => import('@/pages/dns-tunnel/DnsTunnelPage'));
const LogsPage = lazy(() => import('@/pages/logs/LogsPage'));
const AssistantPage = lazy(() => import('@/pages/assistant/AssistantPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const XrayPage = lazy(() => import('@/pages/xray/XrayPage'));
const ApiDocsPage = lazy(() => import('@/pages/api-docs/ApiDocsPage'));
const HubPage = lazy(() => import('@/pages/hub/HubPage'));

export interface PanelRoute {
  path: string;
  titleKey: string;
  icon: ComponentType;
  component: ComponentType;
  hidden?: boolean;
}

// The router, the sidebar, the page titles and the command palette all read this list, so a
// page cannot go missing from one of them.
export const PANEL_ROUTES: PanelRoute[] = [
  { path: '/', titleKey: 'menu.dashboard', icon: DashboardOutlined, component: IndexPage },
  { path: '/connections', titleKey: 'menu.connections', icon: ImportOutlined, component: ConnectionsPage },
  { path: '/inbounds', titleKey: 'menu.connections', icon: ImportOutlined, component: LegacyInbounds, hidden: true },
  { path: '/clients', titleKey: 'menu.connections', icon: TeamOutlined, component: LegacyClients, hidden: true },
  { path: '/groups', titleKey: 'menu.groups', icon: TeamOutlined, component: GroupsPage },
  { path: '/tunnels', titleKey: 'menu.tunnels', icon: SwapOutlined, component: TunnelsPage },
  { path: '/nodes', titleKey: 'menu.nodes', icon: ClusterOutlined, component: NodesPage },
  { path: '/hosts', titleKey: 'menu.hosts', icon: GlobalOutlined, component: HostsPage },
  {
    path: '/clean-ip',
    titleKey: 'menu.cleanIp',
    icon: ThunderboltOutlined,
    component: CleanIpPage,
  },
  {
    path: '/dns-tunnel',
    titleKey: 'menu.dnsTunnel',
    icon: CloudServerOutlined,
    component: DnsTunnelPage,
  },
  { path: '/outbound', titleKey: 'menu.outbounds', icon: ExportOutlined, component: XrayPage },
  { path: '/routing', titleKey: 'menu.routing', icon: SwapOutlined, component: XrayPage },
  { path: '/logs', titleKey: 'menu.logs', icon: FileTextOutlined, component: LogsPage },
  { path: '/assistant', titleKey: 'menu.assistant', icon: RobotOutlined, component: AssistantPage },
  { path: '/settings', titleKey: 'menu.settings', icon: SettingOutlined, component: SettingsPage },
  { path: '/xray', titleKey: 'menu.xray', icon: ToolOutlined, component: XrayPage },
  { path: '/api-docs', titleKey: 'menu.apiDocs', icon: ApiOutlined, component: ApiDocsPage },
  { path: '/hub', titleKey: 'menu.hub', icon: ToolOutlined, component: HubPage, hidden: true },
];

export const PANEL_ROUTE_PATHS = PANEL_ROUTES.map((route) => route.path);

export const PANEL_TITLE_KEYS: Record<string, string> = Object.fromEntries(
  PANEL_ROUTES.map((route) => [route.path, route.titleKey]),
);
