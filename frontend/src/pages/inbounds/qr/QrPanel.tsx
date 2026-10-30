import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, QRCode, Segmented, Spin, Tag, Tooltip, message } from 'antd';
import { CopyOutlined, DownloadOutlined, PictureOutlined } from '@ant-design/icons';

import { Base64, ClipboardManager, FileManager, HttpUtil } from '@/utils';
import { activateOnKey } from '@/utils/a11y';
import './QrPanel.css';

interface QrPanelProps {
  value: string;
  remark?: string;
  downloadName?: string;
  size?: number;
  showQr?: boolean;
}

async function svgToPngBlob(svgEl: SVGSVGElement | null, size: number): Promise<Blob | null> {
  if (!svgEl) return null;
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  return new Promise<Blob | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function downloadImageBlob(blob: Blob, remark: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${remark || 'qrcode'}.png`;
  link.click();
  URL.revokeObjectURL(url);
}

function QrPanelContent({
  value,
  remark = '',
  downloadName = '',
  size = 360,
  showQr = true,
}: QrPanelProps) {
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const qrRef = useRef<HTMLDivElement | null>(null);

  async function copy() {
    const ok = await ClipboardManager.copyText(value);
    if (ok) messageApi.success(t('copied'));
  }

  function download() {
    if (!downloadName) return;
    FileManager.downloadTextFile(value, downloadName);
  }

  async function copyImage() {
    const svgEl = qrRef.current?.querySelector('svg') as SVGSVGElement | null;
    const blob = await svgToPngBlob(svgEl, size);
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      messageApi.success(t('copied'));
    } catch {
      downloadImageBlob(blob, remark);
    }
  }

  async function downloadImage() {
    const svgEl = qrRef.current?.querySelector('svg') as SVGSVGElement | null;
    const blob = await svgToPngBlob(svgEl, size);
    if (blob) downloadImageBlob(blob, remark);
  }

  return (
    <div className="qr-panel">
      {messageContextHolder}
      <div className="qr-panel-header">
        <Tag color="green" className="qr-remark">
          {remark}
        </Tag>
        <Tooltip title={t('copy')}>
          <Button
            size="small"
            icon={<CopyOutlined aria-hidden />}
            aria-label={t('copy')}
            onClick={copy}
          />
        </Tooltip>
        {showQr && (
          <Tooltip title={t('downloadImage')}>
            <Button
              size="small"
              icon={<PictureOutlined aria-hidden />}
              aria-label={t('downloadImage')}
              onClick={downloadImage}
            />
          </Tooltip>
        )}
        {downloadName && (
          <Tooltip title={t('download')}>
            <Button
              size="small"
              icon={<DownloadOutlined aria-hidden />}
              aria-label={t('download')}
              onClick={download}
            />
          </Tooltip>
        )}
      </div>
      {showQr && (
        <div
          ref={qrRef}
          className="qr-panel-canvas"
          role="button"
          tabIndex={0}
          aria-label={t('copy')}
          onClick={copyImage}
          onKeyDown={(event) => activateOnKey(copyImage)(event)}
        >
          <Tooltip title={t('copy')}>
            <QRCode
              className="qr-code"
              value={value}
              size={size}
              errorLevel="L"
              marginSize={2}
              type="svg"
              bordered={false}
              color="#000000"
              bgColor="#ffffff"
            />
          </Tooltip>
        </div>
      )}
    </div>
  );
}

function SudokuQrPanel(props: QrPanelProps) {
  const { t } = useTranslation();
  const [variant, setVariant] = useState('standard');
  const [profile, setProfile] = useState<{ url: string; config: string } | null>(null);
  const [loading, setLoading] = useState(() => { try { const v = JSON.parse(Base64.decode(props.value.slice('sudoku://'.length))); return !!v.i && !!v.c; } catch { return false; } });
  useEffect(() => {
    let active = true;
    let compact: { i?: number; c?: string; h: string; p: number; n?: string };
    try { compact = JSON.parse(Base64.decode(props.value.slice('sudoku://'.length))); } catch { return; }
    if (!compact.i || !compact.c) return;
    void (async () => {
      try {
        const id = compact.i + ':' + compact.c;
        const response = await HttpUtil.post<Record<string, { path: string; config: string }>>('/panel/hub/api/sudoku-profiles', [{ inboundId: compact.i, clientId: compact.c, host: compact.h, port: compact.p, name: props.remark || compact.n || 'Sudoku' }], { silent: true });
        const value = response?.success ? response.obj?.[id] : undefined;
        if (active && value?.path.startsWith('sudoku-import/')) {
          const base = new URL(window.X_UI_BASE_PATH || '/', window.location.origin);
          setProfile({ url: new URL(value.path, base).href, config: value.config });
        }
      } finally { if (active) setLoading(false); }
    })().catch(() => {});
    return () => { active = false; };
  }, [props.value, props.remark]);
  return <div>
    <Segmented block value={variant} onChange={setVariant} options={[{label: 'Sudoku', value: 'standard'}, {label: 'Shadowrocket · Clash', value: 'shadowrocket'}]} style={{ marginBottom: 16 }} />
    {variant === 'standard' ? <QrPanelContent {...props} /> : <Spin spinning={loading}>
      <Alert type="info" showIcon title={t('connections.shadowrocketHint')} style={{ marginBottom: 16 }} />
      {profile ? <>
        <QrPanelContent {...props} value={'shadowrocket://add/' + profile.url} remark={(props.remark || 'Sudoku') + ' · Shadowrocket'} />
        <Button onClick={() => void ClipboardManager.copyText(profile.url)}>{t('connections.copyProfileURL')}</Button>{' '}
        <Button onClick={() => FileManager.downloadTextFile(profile.config, 'Connect-Hub-Sudoku.yaml')}>{t('download')} YAML</Button>
      </> : !loading && <Alert type="warning" title={t('connections.profileUnavailable')} />}
    </Spin>}
  </div>;
}

export default function QrPanel(props: QrPanelProps) {
  return props.value.startsWith('sudoku://') ? <SudokuQrPanel key={props.value} {...props} /> : <QrPanelContent {...props} />;
}
