import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Status } from '@/models/status';
import OverviewActionBar from '@/pages/index/OverviewActionBar';

import { renderWithProviders } from './test-utils';

// Preserve Connect Hub's dedicated Sudoku monitoring widget without loading its API
// when testing Xray's independent safety controls.
vi.mock('@/pages/index/SudokuMonitor', () => ({ default: () => null }));

const noop = () => {};

function renderBar(
  state: string,
  {
    onStopXray = noop,
    onRestartXray = noop,
  }: { onStopXray?: () => void; onRestartXray?: () => void } = {},
) {
  const status = new Status();
  status.xray.state = state;
  renderWithProviders(
    <OverviewActionBar
      status={status}
      isMobile={false}
      accessLogEnable={false}
      panelVersion="0.9.0-dev"
      latestVersion="0.9.0-dev"
      updateAvailable={false}
      onStopXray={onStopXray}
      onRestartXray={onRestartXray}
      onOpenLogs={noop}
      onOpenXrayLogs={noop}
      onOpenAmneziaWGLogs={noop}
      onOpenConfig={noop}
      onOpenBackup={noop}
      onOpenSystemHistory={noop}
      onOpenXrayMetrics={noop}
      onOpenPanelUpdate={noop}
      onOpenVersionSwitch={noop}
    />,
  );
}

describe('Connect Hub Xray stop guard', () => {
  it('never stops a running Xray core until confirmed', async () => {
    const onStopXray = vi.fn();
    renderBar('running', { onStopXray });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findAllByText('Stop Xray?')).not.toHaveLength(0);
    expect(onStopXray).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onStopXray).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Stop Xray' })).at(-1)!);
    await waitFor(() => expect(onStopXray).toHaveBeenCalledOnce());
  });

  it('shows Start and disables Stop when Xray is stopped', () => {
    const onRestartXray = vi.fn();
    renderBar('stop', { onRestartXray });
    expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Stop' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onRestartXray).toHaveBeenCalledOnce();
  });

  it('leaves Stop available when Xray is in an error state', async () => {
    const onStopXray = vi.fn();
    renderBar('error', { onStopXray });
    expect(screen.getByRole('button', { name: 'Restart' })).toBeTruthy();
    const stop = screen.getByRole('button', { name: 'Stop' }) as HTMLButtonElement;
    expect(stop.disabled).toBe(false);
    fireEvent.click(stop);
    fireEvent.click(await screen.findByRole('button', { name: 'Stop Xray' }));
    await waitFor(() => expect(onStopXray).toHaveBeenCalledOnce());
  });
});
