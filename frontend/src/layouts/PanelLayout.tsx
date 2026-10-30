import { Outlet } from 'react-router';

import { useWebSocketBridge } from '@/api/websocketBridge';
import { usePageTitle } from '@/hooks/usePageTitle';
import AppHeader from './AppHeader';
import './PanelLayout.css';
import CommandPalette from '@/components/command-palette/CommandPalette';

export default function PanelLayout() {
  useWebSocketBridge();
  usePageTitle();
  return (
    <div className="panel-app">
      <AppHeader />
      <Outlet />
      <CommandPalette />
    </div>
  );
}
