import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { expect, test, vi } from 'vitest';
import AppSidebar from '@/layouts/AppSidebar';
import OverviewActionBar from '@/pages/index/OverviewActionBar';
import PanelUpdateModal from '@/pages/index/PanelUpdateModal';
import { Status } from '@/models/status';
import { HttpUtil } from '@/utils';
import { renderWithProviders } from './test-utils';

vi.mock('@/api/queries/useAllSettings', () => ({ useAllSettings: () => ({ allSetting: {} }) }));

test('Connections replaces separate Inbounds and Clients navigation', async () => {
  localStorage.setItem('sidebar-pinned', 'true');
  function Location() { return <output data-testid="current-route">{useLocation().pathname}</output>; }
  const view = renderWithProviders(<MemoryRouter initialEntries={['/']}><AppSidebar /><Location /></MemoryRouter>);
  await act(async () => {});
  const item = screen.getByRole('button', { name: 'Connections' });
  expect(screen.queryByRole('button', { name: 'Inbounds' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Clients' })).toBeNull();
  expect(item.getAttribute('aria-haspopup')).toBeNull();
  expect(view.container.querySelector('.compact-rail')).not.toBeNull();
  fireEvent.click(item);
  await waitFor(() => expect(screen.getByTestId('current-route').textContent).toBe('/connections'));
  expect(screen.queryByRole('menuitem', { name: /Groups|Client List/ })).toBeNull();
  localStorage.clear();
});

test('keeps route groups compact and closed until clicked, then closes after choosing a child', async () => {
  localStorage.setItem('sidebar-pinned', 'true');
  function Location() { return <output data-testid="group-route">{useLocation().pathname}</output>; }
  const view = renderWithProviders(<MemoryRouter initialEntries={['/hosts']}><AppSidebar /><Location /></MemoryRouter>);
  await act(async () => {});
  const group = screen.getByRole('button', { name: 'Infrastructure' });
  expect(group.getAttribute('aria-current')).toBe('page');
  expect(group.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('menuitem', { name: /Nodes/ })).toBeNull();
  fireEvent.click(group);
  fireEvent.click(await screen.findByRole('menuitem', { name: /Nodes/ }));
  await waitFor(() => expect(screen.getByTestId('group-route').textContent).toBe('/nodes'));
  expect(group.getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByRole('button', { name: 'Network' })).not.toBeNull();
  expect(view.container.querySelector('.sidebar-command-kbd')).toBeNull();
  localStorage.clear();
});

test('More groups existing actions, opens no server action by itself and closes with Escape', async () => {
  const handlers = Object.fromEntries(['onStopXray', 'onRestartXray', 'onOpenLogs', 'onOpenXrayLogs',
    'onOpenAmneziaWGLogs', 'onOpenConfig', 'onOpenBackup', 'onOpenSystemHistory', 'onOpenXrayMetrics',
    'onOpenPanelUpdate', 'onOpenVersionSwitch'].map(key => [key, vi.fn()]));
  renderWithProviders(<OverviewActionBar status={new Status()} isMobile={false} accessLogEnable
    panelVersion="0.1.0-alpha.8" latestVersion="" updateAvailable={false}
    onStopXray={handlers.onStopXray} onRestartXray={handlers.onRestartXray} onOpenLogs={handlers.onOpenLogs}
    onOpenXrayLogs={handlers.onOpenXrayLogs} onOpenAmneziaWGLogs={handlers.onOpenAmneziaWGLogs}
    onOpenConfig={handlers.onOpenConfig} onOpenBackup={handlers.onOpenBackup}
    onOpenSystemHistory={handlers.onOpenSystemHistory} onOpenXrayMetrics={handlers.onOpenXrayMetrics}
    onOpenPanelUpdate={handlers.onOpenPanelUpdate} onOpenVersionSwitch={handlers.onOpenVersionSwitch} />);
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  expect(await screen.findByText('Maintenance')).not.toBeNull();
  expect(screen.getByText('Diagnostics')).not.toBeNull();
  expect(Object.values(handlers).every(fn => fn.mock.calls.length === 0)).toBe(true);
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'More' }).getAttribute('aria-expanded')).toBe('false'));
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /Config/ }));
  expect(handlers.onOpenConfig).toHaveBeenCalledOnce();
  expect(handlers.onRestartXray).not.toHaveBeenCalled();
  expect(handlers.onStopXray).not.toHaveBeenCalled();
});

test('opening update details offers no channel switch and does not update or change settings', () => {
  const post = vi.mocked(HttpUtil.post); post.mockClear();
  renderWithProviders(<PanelUpdateModal open info={{ currentVersion: '0.1.0-alpha.8', latestVersion: '', updateAvailable: false }}
    onClose={vi.fn()} onBusy={vi.fn()} />);
  expect(screen.queryByRole('switch')).toBeNull();
  expect(screen.queryByText('Development channel')).toBeNull();
  expect(post).not.toHaveBeenCalled();
});

test('preserves a previously selected development channel and warns without changing it', () => {
  const post = vi.mocked(HttpUtil.post); post.mockClear();const change = vi.fn();
  renderWithProviders(<PanelUpdateModal open devChannelEnable onChannelChange={change}
    info={{ channel: 'dev', currentVersion: 'dev+old', latestVersion: 'dev+new', updateAvailable: true }}
    onClose={vi.fn()} onBusy={vi.fn()} />);
  expect(screen.queryByRole('switch')).toBeNull();
  expect(screen.getByText(/Dev builds track every commit/)).not.toBeNull();
  expect(change).not.toHaveBeenCalled();expect(post).not.toHaveBeenCalled();
});
