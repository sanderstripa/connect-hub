import { fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import AppSidebar from '@/layouts/AppSidebar';
import { renderWithProviders } from './test-utils';
import { PALETTE_KEY } from '@/lib/theme-palettes';
vi.mock('@/api/queries/useAllSettings', () => ({ useAllSettings: () => ({ allSetting: {} }) }));
it('keeps theme switching in the footer without an Appearance menu or server save', async () => {
  localStorage.setItem(PALETTE_KEY, 'graphite-sage');
  localStorage.setItem('dark-mode', 'false');
  const view = renderWithProviders(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>,
  );
  expect(document.documentElement.dataset.palette).toBe('soulu');
  fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Theme' }));
  expect(localStorage.getItem('dark-mode')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Warm Sand & Navy' }));
  expect(localStorage.getItem(PALETTE_KEY)).toBe('warm-sand');
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(await screen.findByRole('menuitem', { name: /General/ })).not.toBeNull();
  expect(screen.queryByRole('menuitem', { name: 'Appearance' })).toBeNull();
  view.unmount();
  renderWithProviders(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>,
  );
  expect(document.documentElement.dataset.mode).toBe('dark');
  expect(document.documentElement.dataset.palette).toBe('warm-sand');
});
