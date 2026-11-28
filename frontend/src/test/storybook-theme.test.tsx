import { render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { withTheme } from '../../.storybook/preview';
import { ThemeProvider, buildAntdThemeConfig } from '@/hooks/useTheme';

function Story() {
  return <div>Story</div>;
}

function StorybookTheme({ theme }: { theme: 'light' | 'dark' }) {
  return withTheme(Story, { globals: { theme } } as Partial<
    Parameters<typeof withTheme>[1]
  > as Parameters<typeof withTheme>[1]);
}

afterEach(() => {
  document.body.className = '';
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
  localStorage.clear();
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

test('panel defaults to the light scheme and preserves unrelated classes', () => {
  localStorage.setItem('dark-mode', 'true');
  document.body.className = 'panel-fixture dark';
  render(<ThemeProvider><div>Panel</div></ThemeProvider>);
  expect(document.body.className).toBe('panel-fixture light');
  expect(document.documentElement.style.colorScheme).toBe('light');
  expect(buildAntdThemeConfig(true)).not.toEqual(buildAntdThemeConfig(false));
});
