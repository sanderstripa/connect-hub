import { useState } from 'react';
import { Alert, Button, Card, Space, Spin } from 'antd';
import { useTranslation } from 'react-i18next';

import { formatPanelVersion } from '@/lib/panel-version';
import PanelUpdateModal, { type PanelUpdateInfo } from '@/pages/index/PanelUpdateModal';
import { HttpUtil } from '@/utils';

export default function AboutTab() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<PanelUpdateInfo>();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<{ busy: boolean; tip?: string }>({ busy: false });

  async function checkForUpdates() {
    setChecking(true);
    setFailed(false);
    try {
      const result = await HttpUtil.get<PanelUpdateInfo>('/panel/api/server/getPanelUpdateInfo');
      if (result?.success && result.obj) {
        setInfo(result.obj);
        setOpen(true);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Spin spinning={busy.busy} description={busy.tip}>
      <Card title="Connect. Hub">
        <Space orientation="vertical" align="start">
          <span>
            {t('pages.index.currentPanelVersion')} · {formatPanelVersion(window.X_UI_CUR_VER || '')}
          </span>
          <Button type="primary" loading={checking} onClick={checkForUpdates}>
            {t('pages.index.updatePanel')}
          </Button>
          {failed && <Alert type="error" title={t('somethingWentWrong')} />}
        </Space>
      </Card>
      {info && (
        <PanelUpdateModal
          open={open}
          info={info}
          devChannelEnable={info.channel === 'dev'}
          onClose={() => setOpen(false)}
          onBusy={setBusy}
        />
      )}
    </Spin>
  );
}
