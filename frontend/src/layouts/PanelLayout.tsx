import { useState } from 'react';
import { MobileNavigationContext } from './MobileNavigation';
import { Outlet } from 'react-router';

import { useWebSocketBridge } from '@/api/websocketBridge';
import { usePageTitle } from '@/hooks/usePageTitle';
import AppHeader from './AppHeader';
import './PanelLayout.css';
import CommandPalette from '@/components/command-palette/CommandPalette';

export default function PanelLayout() {
  const [open, setOpen] = useState(false);
  useWebSocketBridge();
  usePageTitle();
  return (
    <MobileNavigationContext.Provider value={{ open, setOpen }}>
      <div className="panel-app">
        <AppHeader />
        <Outlet />
        <CommandPalette />
      </div>
    </MobileNavigationContext.Provider>
  );
}
