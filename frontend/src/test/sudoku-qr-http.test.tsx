import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { setupHttp } from '@/api/http-init';
import { Base64, HttpUtil } from '@/utils';
import QrPanel from '@/pages/inbounds/qr/QrPanel';
import { renderWithProviders } from './test-utils';

vi.mock('antd', async (original) => ({
  ...await original<typeof import('antd')>(),
  QRCode: ({ value }: { value: string }) => <div data-testid="encoded-qr">{value}</div>,
}));

const compact = { i: 7, c: 'existing-client', h: '203.0.113.7', p: 18443, k: 'existing-private-device-key', n: 'iPhoneSudoku' };
const path = 'sudoku-import/device-payload/signed-token';
const profile = { path, config: 'proxies:\n  - type: sudoku\n    key: existing-private-device-key\n' };
let network: ReturnType<typeof vi.fn>;

beforeEach(() => {
  if (vi.isMockFunction(HttpUtil.post)) vi.mocked(HttpUtil.post).mockRestore();
  document.head.innerHTML = '<meta name="csrf-token" content="session-token">';
  window.X_UI_BASE_PATH = '/private-panel/';
  setupHttp();
  network = vi.fn(async (_url: string, init: RequestInit) => {
    // Exercise the real serializer: the old code sent form data and fails here.
    if (new Headers(init.headers).get('Content-Type') !== 'application/json') return new Response('', { status: 400 });
    return new Response(JSON.stringify({ success: true, obj: { '7:existing-client': profile } }), { headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', network);
});
afterEach(() => { vi.unstubAllGlobals(); delete window.X_UI_BASE_PATH; document.head.innerHTML = ''; });

function open(value = 'sudoku://' + Base64.encode(JSON.stringify(compact), true)) {
  renderWithProviders(<QrPanel value={value} remark="iPhoneSudoku" />);
  fireEvent.click(screen.getByText('Shadowrocket · Clash', { exact: true }));
}

test('existing Sudoku key exports from the QR window using JSON, CSRF and the private panel base path', async () => {
  open();
  await screen.findByRole('button', { name: 'Copy profile URL' });
  expect(screen.getByTestId('encoded-qr').textContent).toBe('shadowrocket://add/' + window.location.origin + '/private-panel/' + path);
  const [url, init] = network.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/private-panel/panel/hub/api/sudoku-profiles');
  expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('session-token');
  expect(JSON.parse(init.body as string)).toEqual([{ inboundId: 7, clientId: 'existing-client', host: '203.0.113.7', port: 18443, name: 'iPhoneSudoku' }]);
  expect(init.body).not.toContain(compact.k);
  expect(screen.queryByText(/Update the panel/)).toBeNull();
});

test('a network failure offers Retry and retries the real JSON request', async () => {
  network.mockImplementationOnce(async () => new Response('', { status: 500 }));
  open();
  await screen.findByText('Could not load the profile. Try again.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('button', { name: 'Copy profile URL' });
  expect(network).toHaveBeenCalledTimes(2);
});

test('a legacy link without an export identity does not show an endless loading indicator or a false update instruction', async () => {
  open('sudoku://' + Base64.encode(JSON.stringify({ h: compact.h, p: compact.p, k: compact.k }), true));
  await waitFor(() => expect(screen.getByText('This saved link has no profile export identity. Reopen the QR code from the key list.')).toBeTruthy());
  expect(network).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
});
