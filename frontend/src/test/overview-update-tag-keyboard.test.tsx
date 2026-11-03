import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Status } from '@/models/status';
import OverviewActionBar from '@/pages/index/OverviewActionBar';

import { renderWithProviders } from './test-utils';

const noop = () => {};

// The version remains a native keyboard-accessible button when an update is available.
describe('OverviewActionBar update tag', () => {
  it('opens the panel update using the installed version button', () => {
    const onOpenPanelUpdate = vi.fn();
    renderWithProviders(
      <OverviewActionBar
        status={new Status()}
        isMobile={false}
        accessLogEnable={false}
        panelVersion="v3.10.1"
        latestVersion="v3.10.2"
        updateAvailable
        onStopXray={noop}
        onRestartXray={noop}
        onOpenLogs={noop}
        onOpenXrayLogs={noop}
        onOpenAmneziaWGLogs={noop}
        onOpenConfig={noop}
        onOpenBackup={noop}
        onOpenSystemHistory={noop}
        onOpenXrayMetrics={noop}
        onOpenPanelUpdate={onOpenPanelUpdate}
        onOpenVersionSwitch={noop}
      />,
    );

    const tag = screen.getByRole('button', { name: /3\.10\.1/ });
    expect(tag.tabIndex).toBe(0);
    expect(tag.tagName).toBe('BUTTON');
    fireEvent.click(tag);

    expect(onOpenPanelUpdate).toHaveBeenCalledOnce();
  });
});
