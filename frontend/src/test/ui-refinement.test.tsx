import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { expect, test, vi } from 'vitest';
import AppSidebar from '@/layouts/AppSidebar';
import OverviewActionBar from '@/pages/index/OverviewActionBar';
import PanelUpdateModal from '@/pages/index/PanelUpdateModal';
import { Status } from '@/models/status';
import { HttpUtil } from '@/utils';
import { renderWithProviders } from './test-utils';

vi.mock('@/api/queries/useAllSettings', () => ({ useAllSettings: () => ({ allSetting: {} }) }));

test('Clients title navigates in one click and keeps Groups available', async () => {
  localStorage.setItem('sidebar-pinned', 'true');
  function Location() { return <output data-testid="current-route">{useLocation().pathname}</output>; }
  const view = renderWithProviders(<MemoryRouter initialEntries={['/']}><AppSidebar /><Location /></MemoryRouter>);
  await act(async () => {});
  fireEvent.click(view.container.querySelector('[data-menu-id$="-__clients"]')!);
  await waitFor(() => expect(screen.getByTestId('current-route').textContent).toBe('/clients'));
  expect(screen.getByRole('menuitem', { name: /Groups/ })).not.toBeNull();
  fireEvent.click(screen.getByRole('menuitem', { name: /Groups/ }));
  await waitFor(() => expect(screen.getByTestId('current-route').textContent).toBe('/groups'));
  localStorage.clear();
});

test('groups existing routes, supports manual collapse and reopens on navigation', async () => {
  localStorage.setItem('sidebar-pinned', 'true');
  function Navigate() { const go = useNavigate(); return <button onClick={() => go('/groups')}>Go groups</button>; }
  const view = renderWithProviders(<MemoryRouter initialEntries={['/clients']}><AppSidebar /><Navigate /></MemoryRouter>);
  await act(async () => {});
  const clientGroup = view.container.querySelector('[data-menu-id$="-__clients"]')?.closest('.ant-menu-submenu');
  expect(clientGroup?.classList.contains('ant-menu-submenu-open')).toBe(true);
  expect(screen.getByRole('menuitem', { name: /Client List/ })).not.toBeNull();
  fireEvent.click(clientGroup!.querySelector('.ant-menu-submenu-title')!);
  expect(clientGroup?.classList.contains('ant-menu-submenu-open')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Go groups' }));
  await waitFor(() => expect(clientGroup?.classList.contains('ant-menu-submenu-open')).toBe(true));
  expect(screen.getByRole('menuitem', { name: /Infrastructure/ })).not.toBeNull();
  expect(screen.getByRole('menuitem', { name: /Network/ })).not.toBeNull();
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
