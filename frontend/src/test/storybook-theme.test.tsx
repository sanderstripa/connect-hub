import { fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { withTheme } from '../../.storybook/preview';
import { ThemeProvider, useTheme, buildAntdThemeConfig } from '@/hooks/useTheme';

function Story() {
  return <div>Story</div>;
}

function StorybookTheme({ theme }: { theme: 'light' | 'dark' }) {
  return withTheme(Story, { globals: { theme } } as Partial<
    Parameters<typeof withTheme>[1]
  > as Parameters<typeof withTheme>[1]);
}

function ThemeToggle() {
  const { toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>toggle</button>;
}

test('only light and dark are selectable and both use Onest for every token', () => {
  localStorage.setItem('isUltraDarkThemeEnabled', 'true');
  const { getByRole } = render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  fireEvent.click(getByRole('button'));
  expect(document.body.classList.contains('light')).toBe(true);
  fireEvent.click(getByRole('button'));
  expect(document.body.classList.contains('dark')).toBe(true);
  expect(localStorage.getItem('isUltraDarkThemeEnabled')).toBeNull();
  for (const dark of [false, true]) {
    const config = buildAntdThemeConfig(dark);
    expect(config.token?.fontFamily).toBe('Onest, sans-serif');
    expect(config.token?.fontFamilyCode).toBe('Onest, sans-serif');
  }
});

afterEach(() => {
  document.body.className = '';
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
});

// Without color-scheme the browser paints native scrollbars light inside dark
// modals, e.g. the Edit Client body.
test('native scrollbars follow the panel theme', () => {
  const { getByRole } = render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
  expect(document.documentElement.style.colorScheme).toBe('dark');

  fireEvent.click(getByRole('button'));
  expect(document.documentElement.style.colorScheme).toBe('light');
});

test('native scrollbars follow the Storybook theme', () => {
  const { rerender } = render(<StorybookTheme theme="light" />);
  expect(document.documentElement.style.colorScheme).toBe('light');

  rerender(<StorybookTheme theme="dark" />);
  expect(document.documentElement.style.colorScheme).toBe('dark');
});

test('preserves unrelated body classes when applying the Storybook theme', () => {
  document.body.className = 'storybook-fixture dark';
  document.documentElement.setAttribute('data-theme', 'ultra-dark');
  const { rerender } = render(<StorybookTheme theme="light" />);

  expect(document.body.classList.contains('storybook-fixture')).toBe(true);
  expect(document.body.classList.contains('light')).toBe(true);
  expect(document.body.classList.contains('dark')).toBe(false);
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

  rerender(<StorybookTheme theme="dark" />);

  expect(document.body.classList.contains('storybook-fixture')).toBe(true);
  expect(document.body.classList.contains('dark')).toBe(true);
  expect(document.body.classList.contains('light')).toBe(false);
});

test('preserves unrelated body classes when applying the panel theme', () => {
  localStorage.setItem('dark-mode', 'true');
  document.body.className = 'panel-fixture';
  const message = document.createElement('div');
  message.id = 'message';
  message.className = 'message-fixture';
  document.body.append(message);

  render(
    <ThemeProvider>
      <div>Panel</div>
    </ThemeProvider>,
  );

  expect(document.body.classList.contains('panel-fixture')).toBe(true);
  expect(document.body.classList.contains('dark')).toBe(true);
  expect(document.body.classList.contains('light')).toBe(false);
  expect(message.classList.contains('message-fixture')).toBe(true);
  expect(message.classList.contains('dark')).toBe(true);
});

test('keeps the selected palette and mode after remount', () => {
  function PalettePicker() {
    const { palette, setPalette } = useTheme();
    return <button onClick={() => setPalette('forest')}>{palette}</button>;
  }
  localStorage.setItem('dark-mode', 'false');
  localStorage.setItem('connect-hub-palette', 'soulu');
  const first = render(
    <ThemeProvider>
      <PalettePicker />
    </ThemeProvider>,
  );
  fireEvent.click(first.getByRole('button', { name: 'soulu' }));
  expect(document.documentElement.dataset.palette).toBe('forest');
  expect(localStorage.getItem('connect-hub-palette')).toBe('forest');
  expect(localStorage.getItem('dark-mode')).toBe('false');
  first.unmount();
  const second = render(
    <ThemeProvider>
      <PalettePicker />
    </ThemeProvider>,
  );
  expect(second.getByRole('button', { name: 'forest' })).toBeTruthy();
  expect(document.documentElement.dataset.mode).toBe('light');
  second.unmount();
  localStorage.clear();
});
