import { afterEach, expect, it, vi } from 'vitest';
import { RandomUtil } from '@/utils';

afterEach(() => vi.unstubAllGlobals());

it('generates a version 4 UUID when the browser exposes random bytes but not randomUUID', () => {
  const getRandomValues = vi.fn((buffer: Uint8Array) => {
    buffer.fill(0xff);
    return buffer;
  });
  vi.stubGlobal('window', { location: { protocol: 'https:' }, crypto: { getRandomValues } });
  expect(RandomUtil.randomUUID()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  expect(getRandomValues).toHaveBeenCalled();
});
