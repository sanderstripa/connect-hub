import { lazy } from 'react';
import { Navigate } from 'react-router';
import type { ComponentType } from 'react';
import {
  ApiOutlined,
  ClusterOutlined,
  DashboardOutlined,
  ExportOutlined,
  GlobalOutlined,
  ImportOutlined,
  SettingOutlined,
  SwapOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons';

const IndexPage = lazy(() => import('@/pages/index/IndexPage'));
const InboundsPage = lazy(() => import('@/pages/inbounds/InboundsPage'));
const ClientsPage = lazy(() => import('@/pages/clients/ClientsPage'));
const GroupsPage = () => <Navigate to="/clients" replace />;
const NodesPage = lazy(() => import('@/pages/nodes/NodesPage'));
const HostsPage = lazy(() => import('@/pages/hosts/HostsPage'));
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
  { path: '/inbounds', titleKey: 'menu.inbounds', icon: ImportOutlined, component: InboundsPage },
  { path: '/clients', titleKey: 'menu.clients', icon: TeamOutlined, component: ClientsPage },
  { path: '/groups', titleKey: 'menu.groups', icon: TeamOutlined, component: GroupsPage, hidden: true },
  { path: '/nodes', titleKey: 'menu.nodes', icon: ClusterOutlined, component: NodesPage },
  { path: '/hosts', titleKey: 'menu.hosts', icon: GlobalOutlined, component: HostsPage },
  { path: '/outbound', titleKey: 'menu.outbounds', icon: ExportOutlined, component: XrayPage },
  { path: '/routing', titleKey: 'menu.routing', icon: SwapOutlined, component: XrayPage },
  { path: '/settings', titleKey: 'menu.settings', icon: SettingOutlined, component: SettingsPage },
  { path: '/xray', titleKey: 'menu.xray', icon: ToolOutlined, component: XrayPage },
  { path: '/api-docs', titleKey: 'menu.apiDocs', icon: ApiOutlined, component: ApiDocsPage },
  { path: '/hub', titleKey: 'menu.hub', icon: ToolOutlined, component: HubPage, hidden: true },
];

export const PANEL_ROUTE_PATHS = PANEL_ROUTES.map((route) => route.path);

export const PANEL_TITLE_KEYS: Record<string, string> = Object.fromEntries(
  PANEL_ROUTES.map((route) => [route.path, route.titleKey]),
);
