import { useEffect, useMemo, useState } from 'react';

import { HttpUtil } from '@/utils';
import type { Status } from '@/models/status';

// The server stores raw samples in compact rollup tiers. The selected bucket
// returns at most 60 points, so even a 12-hour view stays small in the browser.
const OVERVIEW_WINDOW = 60;
const MIN_REFRESH_INTERVAL_MS = 10_000;

const SERIES_KEYS = [
  'cpu',
  'mem',
  'swap',
  'diskUsage',
  'netUp',
  'netDown',
  'tcpCount',
  'udpCount',
] as const;

export type OverviewSeriesKey = (typeof SERIES_KEYS)[number];

export interface OverviewHistory {
  series: Record<OverviewSeriesKey, number[]>;
  labels: string[];
}

interface HistoryPoint {
  t: number;
  v: number;
}

interface HistoryWindow {
  series: Record<OverviewSeriesKey, number[]>;
  times: number[];
  scope: string;
  bucketSeconds: number;
}

function emptySeries(): Record<OverviewSeriesKey, number[]> {
  return Object.fromEntries(SERIES_KEYS.map((key) => [key, [] as number[]])) as Record<
    OverviewSeriesKey,
    number[]
  >;
}

function emptyWindow(scope = '', bucketSeconds = 0): HistoryWindow {
  return { series: emptySeries(), times: [], scope, bucketSeconds };
}

function tailWindow<T>(values: T[]): T[] {
  return values.slice(-OVERVIEW_WINDOW);
}

// Keep the original Connect Hub live status history. An unavailable metric is
// not a real sample of zero and must not erase earlier valid observations.
function sampleOf(status: Status): Record<OverviewSeriesKey, number> {
  return {
    cpu: status.cpu.percent,
    mem: status.mem.percent,
    swap: status.swap.percent,
    diskUsage: status.disk.percent,
    netUp: status.netIO.up,
    netDown: status.netIO.down,
    tcpCount: status.tcpCount,
    udpCount: status.udpCount,
  };
}

// Older Connect Hub installations expose a per-metric history API, while the
// new dashboard uses one batched endpoint. Preserve both wire contracts.
function mergeLegacyHistory(
  previous: HistoryWindow,
  responses: Map<OverviewSeriesKey, HistoryPoint[]>,
  scope: string,
  bucketSeconds: number,
): HistoryWindow {
  const oldTimes = Array.from(new Set(
    Array.from(responses.values()).flatMap((points) => points.map((point) => point.t)),
  )).filter(Number.isFinite).sort((a, b) => a - b);
  const sameWindow = previous.bucketSeconds === bucketSeconds;
  const result = emptyWindow(scope, bucketSeconds);
  result.times = tailWindow([
    ...oldTimes,
    ...(sameWindow ? previous.times : []),
  ]);
  for (const key of SERIES_KEYS) {
    const scoped = key === 'cpu' || key === 'swap';
    const live = sameWindow && !(scoped && previous.scope !== scope)
      ? previous.series[key] : [];
    const archived = responses.get(key) ?? [];
    result.series[key] = tailWindow([
      ...archived.slice().sort((a, b) => a.t - b.t).map((point) => point.v),
      ...live,
    ]);
  }
  return result;
}

function formatTimeAxis(times: number[]): string[] {
  if (times.length === 0) return [];
  const first = new Date(times[0] * 1000);
  const last = new Date(times[times.length - 1] * 1000);
  const crossesDay =
    first.getFullYear() !== last.getFullYear() ||
    first.getMonth() !== last.getMonth() ||
    first.getDate() !== last.getDate();

  return times.map((timestamp) => {
    const d = new Date(timestamp * 1000);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (!crossesDay) return `${hh}:${mm}`;
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const DD = String(d.getDate()).padStart(2, '0');
    return `${MM}/${DD} ${hh}:${mm}`;
  });
}

function mergeHistory(
  previous: HistoryWindow,
  responses: Map<OverviewSeriesKey, HistoryPoint[]>,
  scope: string,
  bucketSeconds: number,
): HistoryWindow {
  const times = Array.from(
    new Set(Array.from(responses.values()).flatMap((points) => points.map((p) => p.t))),
  )
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .slice(-OVERVIEW_WINDOW);
  if (times.length === 0) return emptyWindow(scope, bucketSeconds);

  const merged = emptyWindow(scope, bucketSeconds);
  merged.times = times;
  for (const key of SERIES_KEYS) {
    const points = responses.get(key);
    if (!points) {
      merged.series[key] = previous.series[key];
      continue;
    }
    const byTime = new Map(points.map((point) => [point.t, point.v]));
    // CPU and swap are scoped to the container when the panel runs there. A
    // missing scoped series should stay empty instead of borrowing host data.
    const scoped = key === 'cpu' || key === 'swap';
    merged.series[key] =
      scoped && points.length === 0 ? [] : times.map((time) => byTime.get(time) ?? 0);
  }
  return merged;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const v of values) total += v;
  return total / values.length;
}

export function peak(values: number[]): number {
  let max = 0;
  for (const v of values) if (v > max) max = v;
  return max;
}

export function useOverviewHistory(
  status: Status,
  hasData: boolean,
  bucketSeconds = 2,
): OverviewHistory {
  const [trend, setTrend] = useState<HistoryWindow>(() =>
    emptyWindow(status.resourceScope, bucketSeconds),
  );

  // Some callers construct a fresh Status wrapper on every render. Object
  // identity cannot be used as a render-phase sample guard: it causes loops.
  // Preserve at most one sample per second, including changes in availability.
  const currentSample = sampleOf(status);
  const sampleSignature = [
    bucketSeconds,
    status.resourceScope,
    Math.floor(Date.now() / 1000),
    ...SERIES_KEYS.map((key) =>
      (status.metricAvailable(key) ? '1:' : '0:') + currentSample[key],
    ),
  ].join('|');
  const [sampledSignature, setSampledSignature] = useState('');
  if (hasData && sampleSignature !== sampledSignature) {
    setSampledSignature(sampleSignature);
    setTrend((previous) => {
      const rangeChanged = previous.bucketSeconds !== bucketSeconds;
      const next = rangeChanged
        ? emptyWindow(status.resourceScope, bucketSeconds)
        : {
            ...previous,
            times: [...previous.times],
            series: Object.fromEntries(
              SERIES_KEYS.map((key) => [key, [...previous.series[key]]]),
            ) as Record<OverviewSeriesKey, number[]>,
            scope: status.resourceScope,
          };
      if (previous.scope !== status.resourceScope) {
        next.series.cpu = [];
        next.series.swap = [];
      }
      next.times = tailWindow(next.times.concat(Math.floor(Date.now() / 1000)));
      for (const key of SERIES_KEYS) {
        if (status.metricAvailable(key)) {
          next.series[key] = tailWindow(next.series[key].concat(currentSample[key]));
        }
      }
      return next;
    });
  }

  useEffect(() => {
    if (!hasData) return undefined;
    let cancelled = false;
    let timeout: number | undefined;
    let seededFallback = false;

    const refresh = async () => {
      const responses = new Map<OverviewSeriesKey, HistoryPoint[]>();
      try {
        const msg = await HttpUtil.get<Record<OverviewSeriesKey, HistoryPoint[]>>(
          `/panel/api/server/overviewHistory/${bucketSeconds}`,
          undefined,
          { silent: true },
        );
        if (!cancelled && msg?.success && msg.obj) {
          for (const key of SERIES_KEYS) {
            const points = msg.obj[key];
            if (!Array.isArray(points)) continue;
            responses.set(
              key,
              points
                .map((point) => ({ t: Number(point.t), v: Number(point.v) }))
                .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v)),
            );
          }
        }
      } catch {
        // Keep the last successful window when a history request fails.
      }
      if (cancelled) return;
      const batchHasData =
        responses.size === SERIES_KEYS.length &&
        Array.from(responses.values()).some((points) => points.length > 0);
      if (batchHasData) {
        setTrend((previous) =>
          mergeHistory(previous, responses, status.resourceScope, bucketSeconds),
        );
      } else if (!seededFallback) {
        // The old endpoint is only queried when the newer batch API is absent.
        // This also preserves the existing live values from Connect Hub.
        const archived = new Map<OverviewSeriesKey, HistoryPoint[]>();
        await Promise.all(
          SERIES_KEYS.map(async (key) => {
            try {
              const response = await HttpUtil.get<HistoryPoint[]>(
                `/panel/api/server/history/${key}/${bucketSeconds}`,
                undefined,
                { silent: true },
              );
              if (!response?.success || !Array.isArray(response.obj)) return;
              const points = response.obj
                .map((point) => ({ t: Number(point.t), v: Number(point.v) }))
                .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v));
              if (points.length > 0) archived.set(key, points);
            } catch {
              // An unavailable legacy endpoint must not clear live status samples.
            }
          }),
        );
        if (cancelled) return;
        if (archived.size > 0) {
          seededFallback = true;
          setTrend((previous) =>
            mergeLegacyHistory(previous, archived, status.resourceScope, bucketSeconds),
          );
        }
      }
      const refreshInterval = Math.max(
        MIN_REFRESH_INTERVAL_MS,
        Math.min(60_000, bucketSeconds * 1000),
      );
      timeout = window.setTimeout(refresh, refreshInterval);
    };

    void refresh();
    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [hasData, status.resourceScope, bucketSeconds]);

  const labels = useMemo(() => formatTimeAxis(trend.times), [trend.times]);

  return useMemo(() => ({ series: trend.series, labels }), [trend.series, labels]);
}
