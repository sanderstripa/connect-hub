import { fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import SudokuMonitor from '@/pages/index/SudokuMonitor';
import { HttpUtil } from '@/utils';
import { renderWithProviders } from './test-utils';

afterEach(() => vi.restoreAllMocks());

test('shows live Sudoku state and loads core releases only when opened', async () => {
  const get = vi.spyOn(HttpUtil, 'get').mockImplementation(async (url) => {
    if (url.endsWith('/monitor'))
      return {
        success: true,
        msg: '',
        obj: { state: 'running', configured: true, version: 'core-v0.7.0' },
      };
    return {
      success: true,
      msg: '',
      obj: [
        {
          version: 'core-v0.8.0',
          name: 'Sudoku Core 0.8',
          url: 'https://github.com/sanderstripa/sudoku-ui/releases/tag/core-v0.8.0',
          published: '2026-10-31T00:00:00Z',
          prerelease: true,
        },
      ],
    };
  });
  renderWithProviders(<SudokuMonitor />);
  await screen.findByText('Sudoku · Running');
  expect(get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Sudoku updates' }));
  const link = await screen.findByRole('link', { name: 'Sudoku Core 0.8' });
  expect(link.getAttribute('href')).toContain('/releases/tag/core-v0.8.0');
  expect(screen.getByText('Installed build: core-v0.7.0')).not.toBeNull();
});

test('reports release lookup failure instead of presenting an empty successful list', async () => {
  vi.spyOn(HttpUtil, 'get').mockResolvedValue({ success: false, msg: '', obj: null });
  renderWithProviders(<SudokuMonitor />);
  fireEvent.click(screen.getByRole('button', { name: 'Sudoku updates' }));
  expect(await screen.findByText('Unable to load Sudoku releases. Try again.')).not.toBeNull();
});
