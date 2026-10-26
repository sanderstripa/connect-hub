import { fireEvent, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import AppearanceTab from '@/pages/settings/AppearanceTab';
import { renderWithProviders } from './test-utils';
import { PALETTE_KEY } from '@/lib/theme-palettes';
it('persists the palette and mode independently without a server save', () => {
  localStorage.removeItem(PALETTE_KEY);
  const view = renderWithProviders(<AppearanceTab />);
  const mode = document.documentElement.dataset.mode;
  fireEvent.click(screen.getByRole('radio', { name: 'Graphite & Sage' }));
  expect(document.documentElement.dataset.palette).toBe('graphite-sage');
  expect(document.documentElement.dataset.mode).toBe(mode);
  fireEvent.click(screen.getByRole('radio', { name: mode === 'dark' ? 'Light' : 'Dark' }));
  expect(localStorage.getItem(PALETTE_KEY)).toBe('graphite-sage');
  const next = document.documentElement.dataset.mode;
  expect(next).not.toBe(mode);
  fireEvent.click(screen.getByRole('radio', { name: 'Midnight & Steel' }));
  expect(document.documentElement.dataset.mode).toBe(next);
  view.unmount();
  renderWithProviders(<AppearanceTab />);
  expect(
    (screen.getByRole('radio', { name: 'Midnight & Steel' }) as HTMLInputElement).checked,
  ).toBe(true);
  localStorage.removeItem(PALETTE_KEY);
});
