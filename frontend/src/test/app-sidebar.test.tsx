import { useState } from 'react';
import AppHeader from '@/layouts/AppHeader';
import { MobileNavigationContext } from '@/layouts/MobileNavigation';
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
      <AppSidebar />
      <Location />
    </MemoryRouter>,
  );
  await act(async () => {});
  return view;
}

test('keeps the icon rail compact on hover and ignores the old pin preference', async () => {
  localStorage.setItem('sidebar-pinned', 'true');
  const view = await renderSidebar();
  const rail = view.container.querySelector('.ant-sidebar')!;
  expect(screen.queryByRole('link', { name: 'Connect Hub' })).toBeNull();
  expect(view.container.querySelector('.rail-brand')).toBeNull();
  fireEvent.mouseEnter(rail);
  expect(screen.queryByRole('button', { name: 'Pin sidebar' })).toBeNull();
  expect(view.container.querySelector('.sidebar-command-trigger')).toBeNull();
  expect(view.container.querySelector('.compact-rail')).not.toBeNull();
  expect(screen.getByRole('button', { name: /Command Palette/ }).className).toContain(
    'global-search-trigger',
  );
});

test('opens nested navigation only by click, closes on Escape and repeat click, and navigates to a child', async () => {
  await renderSidebar();
  const settings = screen.getByRole('button', { name: 'Settings' });
  fireEvent.mouseEnter(settings);
  expect(settings.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(settings);
  await screen.findByRole('menuitem', { name: /API Docs/ });
  expect(settings.getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(settings.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(settings);
  expect(settings.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(settings);
  expect(settings.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(settings);
  fireEvent.click(await screen.findByRole('menuitem', { name: /API Docs/ }));
  await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/api-docs'));
  expect(settings.getAttribute('aria-expanded')).toBe('false');
  expect(settings.getAttribute('aria-current')).toBe('page');
});

test('keeps all navigation groups and footer actions and opens the existing search store', async () => {
  const view = await renderSidebar();
  for (const name of ['Network', 'Settings', 'Xray Configs'])
    expect(screen.getByRole('button', { name })).not.toBeNull();
  expect(
    view.container.querySelector('.rail-utilities')?.querySelectorAll('.rail-button').length,
  ).toBe(5);
  fireEvent.click(screen.getByRole('button', { name: /Command Palette/ }));
  expect(commandPaletteStore.getSnapshot()).toBe(true);
});

test('mobile menu opens from the header, retains nested routes, and closes after navigation', async () => {
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
    return (
      <MobileNavigationContext.Provider value={{ open, setOpen }}>
        <AppHeader />
        <AppSidebar />
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
    const trigger = screen.getByRole('button', { name: 'Navigation' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByText('Settings', { selector: '.ant-menu-title-content' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /API Docs/ }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/api-docs'));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  } finally {
    window.matchMedia = original;
  }
});
