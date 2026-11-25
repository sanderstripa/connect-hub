import { fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import AppSidebar from '@/layouts/AppSidebar';
import AppearanceTab from '@/pages/settings/AppearanceTab';
import { PALETTE_KEY } from '@/lib/theme-palettes';
import { chooseSelectOption, renderWithProviders } from './test-utils';

vi.mock('@/api/queries/useAllSettings', () => ({ useAllSettings: () => ({ allSetting: {} }) }));

it('moves theme controls to Settings and keeps selections local', async () => {
  localStorage.setItem(PALETTE_KEY, 'graphite-sage');
  localStorage.setItem('dark-mode', 'false');
  const view = renderWithProviders(
    <MemoryRouter initialEntries={['/settings#appearance']}>
      <AppSidebar />
      <AppearanceTab />
    </MemoryRouter>,
  );
  expect(document.documentElement.dataset.palette).toBe('soulu');
  expect(screen.queryByRole('button', { name: 'Theme' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(await screen.findByRole('menuitem', { name: 'Appearance' })).not.toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  expect(localStorage.getItem('dark-mode')).toBe('true');
  chooseSelectOption('theme-palette', 'Warm Sand & Navy');
  expect(localStorage.getItem(PALETTE_KEY)).toBe('warm-sand');
  view.unmount();
  renderWithProviders(<AppearanceTab />);
  expect(document.documentElement.dataset.mode).toBe('dark');
  expect(document.documentElement.dataset.palette).toBe('warm-sand');
});
