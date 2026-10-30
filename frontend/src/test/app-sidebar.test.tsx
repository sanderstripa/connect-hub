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
  expect(screen.getByRole('link', { name: 'Connect Hub' }).textContent).toBe('C.');
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
  for (const name of ['Infrastructure', 'Network', 'Settings', 'Xray Configs'])
    expect(screen.getByRole('button', { name })).not.toBeNull();
  expect(
    view.container.querySelector('.rail-utilities')?.querySelectorAll('.rail-button').length,
  ).toBe(3);
  fireEvent.click(screen.getByRole('button', { name: /Command Palette/ }));
  expect(commandPaletteStore.getSnapshot()).toBe(true);
});
