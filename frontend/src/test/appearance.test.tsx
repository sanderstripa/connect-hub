import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import AppSidebar from '@/layouts/AppSidebar';
import { DEFAULT_PALETTE, PALETTE_KEY } from '@/lib/theme-palettes';
import { renderWithProviders } from './test-utils';

vi.mock('@/api/queries/useAllSettings', () => ({ useAllSettings: () => ({ allSetting: {} }) }));

it('uses the approved appearance with legacy browser preferences', () => {
  localStorage.setItem(PALETTE_KEY, 'graphite-sage');
  localStorage.setItem('dark-mode', 'true');
  renderWithProviders(
    <MemoryRouter initialEntries={['/settings#appearance']}>
      <AppSidebar />
    </MemoryRouter>,
  );
  expect(document.documentElement.dataset.palette).toBe(DEFAULT_PALETTE);
  expect(document.documentElement.dataset.mode).toBe('light');
  expect(screen.queryByRole('button', { name: 'Theme' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Appearance' })).toBeNull();
  localStorage.removeItem(PALETTE_KEY);
  localStorage.removeItem('dark-mode');
});
