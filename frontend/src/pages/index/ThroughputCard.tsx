import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Card, Segmented } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DotChartOutlined, LineChartOutlined } from '@ant-design/icons';

import { SizeFormatter } from '@/utils';
import { Sparkline } from '@/components/viz';
import type { Status } from '@/models/status';
import { mean, peak } from './useOverviewHistory';
import OverviewRangeSelect from './OverviewRangeSelect';
import type { OverviewRange } from './OverviewRangeSelect';

interface ThroughputCardProps {
  status: Status;
  up: number[];
  down: number[];
  labels: string[];
  isMobile: boolean;
  range?: OverviewRange;
  onRangeChange?: (range: OverviewRange) => void;
}

export default function ThroughputCard({
  status,
  up,
  down,
  labels,
  isMobile,
  range = 2,
  onRangeChange = () => undefined,
}: ThroughputCardProps) {
  const { t } = useTranslation();
  const [presentation, setPresentation] = useState<'dots' | 'line'>('dots');
  const dotsLabel = t('pages.index.trafficDots', 'Dot chart');
  const lineLabel = t('pages.index.trafficLine', 'Line chart');
  const accent = '#26272a';
  const downColor = '#858892';
  const available = status.metricAvailable('netTraffic');

  return (
    <Card hoverable styles={{ body: { padding: 0 } }}>
      {!available && (
        <Alert
          type="warning"
          showIcon
          title={t('pages.settings.networkTrafficUnavailable')}
          description={status.networkInterface?.error}
        />
      )}
      {status.networkInterface?.name && available && (
        <div className="ov-sub" style={{ padding: '8px 16px 0' }}>
          {status.networkInterface.name}
        </div>
      )}
      <div className="ov-wide-head">
        <div>
          <div className="ov-kicker">{t('pages.index.overallSpeed')}</div>
          <div className="ov-sub">
            {`${t('pages.index.throughputSub')} · ${t('pages.index.peak')} ${available && down.length ? SizeFormatter.speedFormat(peak(down)) : '—'}`}
          </div>
        </div>
        <div className="ov-wide-legend">
          <div className="ov-legend-label">
            <ArrowUpOutlined aria-hidden style={{ color: accent }} />
            {t('pages.index.upload')}
            <span className="ov-legend-num">
              {available ? SizeFormatter.speedFormat(status.netIO.up) : '—'}
            </span>
          </div>
          <div className="ov-legend-label">
            <ArrowDownOutlined aria-hidden style={{ color: downColor }} />
            {t('pages.index.download')}
            <span className="ov-legend-num">
              {available ? SizeFormatter.speedFormat(status.netIO.down) : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="ov-range-toolbar ov-traffic-controls">
        <OverviewRangeSelect value={range} onChange={onRangeChange} />
        <Segmented
          value={presentation}
          onChange={setPresentation}
          options={[
            { value: 'dots', icon: <DotChartOutlined aria-label={dotsLabel} />, title: dotsLabel },
            { value: 'line', icon: <LineChartOutlined aria-label={lineLabel} />, title: lineLabel },
          ]}
        />
      </div>
      <div className="ov-wide-chart">
        <Sparkline
          data={available ? up : []}
          data2={available ? down : []}
          labels={labels}
          height={isMobile ? 140 : 157}
          strokeWidth={1.75}
          fillOpacity={0}
          presentation={presentation}
          latestLabel={t('pages.index.trafficNow', 'Now').toLocaleUpperCase()}
          rightPadding={12}
          showAxes
          showTooltip
          showLegend={false}
          valueMax={null}
          stroke={accent}
          stroke2={downColor}
          name1={t('pages.index.upload')}
          name2={t('pages.index.download')}
          yFormatter={SizeFormatter.speedFormat}
        />
      </div>

      <div className="ov-wide-foot">
        <div>
          <div className="ov-kicker">{t('pages.index.sent')}</div>
          <div className="ov-foot-value">
            {available ? SizeFormatter.sizeFormat(status.netTraffic.sent) : '—'}
          </div>
        </div>
        <span className="ov-foot-sep" />
        <div>
          <div className="ov-kicker">{t('pages.index.received')}</div>
          <div className="ov-foot-value">
            {available ? SizeFormatter.sizeFormat(status.netTraffic.recv) : '—'}
          </div>
        </div>
        <span className="ov-foot-sep" />
        <div>
          <div className="ov-kicker">{t('pages.index.avgWindow')}</div>
          <div className="ov-foot-value">
            <span className="ov-foot-part">{`↑ ${available && up.length ? SizeFormatter.speedFormat(mean(up)) : '—'}`}</span>{' '}
            <span className="ov-foot-part">{`↓ ${available && down.length ? SizeFormatter.speedFormat(mean(down)) : '—'}`}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
