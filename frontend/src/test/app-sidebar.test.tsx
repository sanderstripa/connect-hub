import { useState } from 'react';
import AppHeader from '@/layouts/AppHeader';
import {
  MobileNavigationContext,
  MobileSettingsNavigationTrigger,
} from '@/layouts/MobileNavigation';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import AppSidebar from '@/layouts/AppSidebar';
import { commandPaletteStore } from '@/components/command-palette/useCommandPalette';
import { renderWithProviders } from './test-utils';
vi.mock('@/api/queries/useAllSettings', () => ({
  useAllSettings: () => ({ allSetting: { subJsonEnable: true, subClashEnable: true } }),
}));
afterEach(() => {
  localStorage.clear();
  commandPaletteStore.close();
});
function Location() {
  const l = useLocation();
  return <output data-testid="location">{l.pathname + l.hash}</output>;
}
async function renderSidebar() {
  const view = renderWithProviders(
    <MemoryRouter>
      <AppHeader />
      <AppSidebar />
      <Location />
    </MemoryRouter>,
  );
  await act(async () => {});
  return view;
}

test('keeps primary desktop navigation and utilities in the shared header', async () => {
  const view = await renderSidebar();
  const header = view.container.querySelector('.app-header')!;
  expect(header.querySelector('.desktop-navigation')).not.toBeNull();
  expect(screen.getByRole('link', { name: 'Connect.Hub' })).not.toBeNull();
  expect(screen.getByRole('link', { name: 'Connections' })).not.toBeNull();
  expect(header.querySelectorAll('.desktop-navigation > a')).toHaveLength(2);
  expect(screen.queryByRole('button', { name: 'Xray Configs' })).toBeNull();
  expect(view.container.querySelector('.ant-sidebar')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Command Palette/ }));
  expect(commandPaletteStore.getSnapshot()).toBe(true);
});

test('keeps all eight Network routes under Settings', async () => {
  const view = await renderSidebar();
  fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
  const network = view.container.querySelector('.settings-network') as HTMLDetailsElement;
  expect(network.open).toBe(false);
  fireEvent.click(network.querySelector('summary')!);
  expect(network.open).toBe(true);
  const links = Array.from(network.querySelectorAll('a'));
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/groups',
    '/nodes',
    '/hosts',
    '/clean-ip',
    '/dns-tunnel',
    '/tunnels',
    '/outbound',
    '/routing',
  ]);
  for (const link of links) {
    fireEvent.click(link);
    expect(screen.getByTestId('location').textContent).toBe(link.getAttribute('href'));
    expect(link.getAttribute('aria-current')).toBe('page');
  }
});

test('opens Settings directly and keeps Xray and Logs in its internal navigation', async () => {
  const view = await renderSidebar();
  const settings = screen.getByRole('link', { name: 'Settings' });
  fireEvent.click(settings);
  expect(screen.getByTestId('location').textContent).toBe('/settings');
  const settingsNav = view.container.querySelector('.settings-navigation')!;
  expect(settingsNav.querySelector('[aria-current="page"]')?.textContent).toBe('General');
  fireEvent.click(screen.getByRole('link', { name: 'DNS' }));
  expect(screen.getByTestId('location').textContent).toBe('/xray#dns');
  expect(settings.getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('link', { name: 'Logs' }));
  expect(screen.getByTestId('location').textContent).toBe('/logs');
});

test('mobile settings navigation retains nested routes and closes after navigation', async () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('768'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })) as unknown as typeof window.matchMedia;
  function MobileShell() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    return (
      <MobileNavigationContext.Provider value={{ open, setOpen }}>
        <AppHeader />
        <AppSidebar />
        {pathname === '/settings' && <MobileSettingsNavigationTrigger />}
        <Location />
      </MobileNavigationContext.Provider>
    );
  }
  try {
    const view = renderWithProviders(
      <MemoryRouter>
        <MobileShell />
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(view.container.querySelector('.ant-sidebar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
    const trigger = screen.getByRole('button', { name: 'Navigation' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'General' }));
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/settings#general'),
    );
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
    fireEvent.click(screen.getByText('Network', { selector: '.ant-menu-title-content' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Hosts' }));
    expect(screen.getByTestId('location').textContent).toBe('/hosts');
    expect(screen.getByRole('button', { name: 'Navigation' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  } finally {
    window.matchMedia = original;
  }
});
