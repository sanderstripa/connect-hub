import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Modal, Spin, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { HttpUtil } from '@/utils';

type State = { state: string; configured: boolean; version: string };
type Release = {
  version: string;
  name: string;
  url: string;
  published: string;
  prerelease: boolean;
};
export default function SudokuMonitor() {
  const { t } = useTranslation();
  const [state, setState] = useState<State>();
  const [open, setOpen] = useState(false);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const r = await HttpUtil.get<State>('/panel/hub/api/sudoku/monitor');
        if (active) setState(r.success ? (r.obj ?? undefined) : undefined);
      } catch {
        if (active) setState(undefined);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      try {
        const r = await HttpUtil.get<Release[]>('/panel/hub/api/sudoku/releases');
        if (active) {
          setError(!r.success);
          setReleases(r.success ? (r.obj ?? []) : []);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);
  const stateKey =
    state?.state === 'running'
      ? 'xrayStatusRunning'
      : state?.state === 'error'
        ? 'xrayStatusError'
        : state
          ? 'xrayStatusStop'
          : 'xrayStatusUnknown';
  return (
    <>
      <button
        type="button"
        className="ov-state ov-sudoku-state"
        data-state={state?.state}
        onClick={() => {
          setLoading(true);
          setError(false);
          setOpen(true);
        }}
        aria-label={t('pages.index.sudokuUpdates')}
      >
        <span
          className="ov-state-dot"
          style={{
            color:
              state?.state === 'running'
                ? 'var(--connection-active, #087F5B)'
                : 'var(--text-secondary)',
          }}
        />
        <span>Sudoku · {t(`pages.index.${stateKey}`)}</span>
        {state?.version && (
          <span className="ov-state-version">{state.version.replace('core-', '')}</span>
        )}
      </button>
      <Modal
        open={open}
        title={t('pages.index.sudokuUpdates')}
        onCancel={() => setOpen(false)}
        footer={null}
      >
        <p>
          {t('pages.index.sudokuInstalled')}: {state?.version || t('pages.index.xrayStatusUnknown')}
        </p>
        <Spin spinning={loading}>
          {error ? (
            <Alert type="error" showIcon title={t('pages.index.sudokuReleaseError')} />
          ) : !loading && releases.length === 0 ? (
            <Empty />
          ) : (
            <div className="version-list">
              {releases.map((release) => (
                <div className="version-list-item" key={release.version}>
                  <div>
                    <a href={release.url} target="_blank" rel="noopener noreferrer">
                      {release.name || release.version}
                    </a>
                    {state?.version === release.version && (
                      <Tag>{t('pages.index.sudokuInstalled')}</Tag>
                    )}
                    {release.prerelease && <Tag>Pre-release</Tag>}
                  </div>
                  <span>
                    {release.published ? new Date(release.published).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Spin>
        <Button
          href="https://github.com/sanderstripa/sudoku-ui/releases"
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: 16 }}
        >
          {t('pages.index.sudokuAllReleases')}
        </Button>
      </Modal>
    </>
  );
}
