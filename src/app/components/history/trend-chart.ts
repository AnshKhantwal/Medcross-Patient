import {
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartType,
  type Plugin
} from 'chart.js';
import { RangeKey, SEVERITY_LABEL, Severity, VITAL_RANGES } from '../../services/vital-ranges';

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip);

interface NormalBandsOptions {
  bands: { lo: number; hi: number }[];
  color: string;
}

interface ValueLabelsOptions {
  enabled: boolean;
  color: string;
  below: number[];
  format: (v: number) => string;
}

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    normalBands?: NormalBandsOptions;
    valueLabels?: ValueLabelsOptions;
  }
}

export interface TrendMetric {
  unit: string;
  decimals: number;
  maxCap?: number;
  series: { name: string; range?: RangeKey }[];
}

export interface TrendRow {
  shortLabel: string;
  longLabel: string;
  values: (number | null)[];
  severity: (Severity | null)[];
}

/** Value labels stay readable on a phone only for a handful of points. */
const MAX_LABELLED_POINTS = 10;

const token = (name: string, fallback: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// Shades the normal range behind the data (same idea as the EPR chart).
const normalBandsPlugin: Plugin<'line', NormalBandsOptions> = {
  id: 'normalBands',
  beforeDatasetsDraw(chart, _args, opts) {
    const y = chart.scales['y'];
    const { ctx, chartArea } = chart;
    for (const b of opts.bands ?? []) {
      const top = y.getPixelForValue(Math.min(b.hi, y.max));
      const bottom = y.getPixelForValue(Math.max(b.lo, y.min));
      if (bottom <= top) continue;
      ctx.save();
      ctx.fillStyle = opts.color;
      ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, bottom - top);
      ctx.restore();
    }
  }
};

// Prints each point's value beside it so the chart reads without tapping.
const valueLabelsPlugin: Plugin<'line', ValueLabelsOptions> = {
  id: 'valueLabels',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts.enabled) return;
    const { ctx } = chart;
    const family = Chart.defaults.font.family ?? 'sans-serif';
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      const below = opts.below.includes(di);
      ctx.save();
      ctx.font = `600 11px ${family}`;
      ctx.fillStyle = opts.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = below ? 'top' : 'bottom';
      meta.data.forEach((pt, i) => {
        const v = ds.data[i];
        if (typeof v !== 'number') return;
        ctx.fillText(opts.format(v), pt.x, below ? pt.y + 9 : pt.y - 9);
      });
      ctx.restore();
    });
  }
};

export function buildTrendChart(canvas: HTMLCanvasElement, metric: TrendMetric, rows: TrendRow[]): Chart {
  const fmt = (n: number) => (metric.decimals ? n.toFixed(metric.decimals) : `${Math.round(n)}`);
  const colors = {
    series: [token('--primary', '#0e7c86'), token('--secondary', '#3b82c4')],
    severity: {
      normal: token('--success', '#15803d'),
      warn: token('--warning', '#c2680a'),
      danger: token('--danger', '#d12c2c')
    } satisfies Record<Severity, string>,
    muted: token('--gray-500', '#66798a'),
    grid: token('--gray-100', '#eef3f6'),
    text: token('--gray-700', '#34444f'),
    band: `rgba(${token('--success-rgb', '21, 128, 61')}, 0.10)`
  };

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

  const bands: { lo: number; hi: number }[] = [];
  let yMin = Infinity;
  let yMax = -Infinity;

  const datasets = metric.series.map((s, si) => {
    for (const r of rows) {
      const v = r.values[si];
      if (v === null) continue;
      yMin = Math.min(yMin, v);
      yMax = Math.max(yMax, v);
    }
    if (s.range) {
      const r = VITAL_RANGES[s.range];
      const hi = r.normalHigh === Infinity ? 100 : r.normalHigh;
      bands.push({ lo: r.normalLow, hi });
      yMin = Math.min(yMin, r.normalLow);
      yMax = Math.max(yMax, hi);
    }
    const lineColor = colors.series[si] ?? colors.series[0];
    return {
      label: s.name,
      data: rows.map((r) => r.values[si]),
      borderColor: lineColor,
      borderWidth: 2,
      tension: 0,
      spanGaps: true,
      clip: false as const,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointBackgroundColor: rows.map((r) => {
        const sev = r.severity[si];
        return sev ? colors.severity[sev] : lineColor;
      })
    };
  });

  const pad = Math.max((yMax - yMin) * 0.15, 1);
  const cap = metric.maxCap;

  return new Chart(canvas, {
    type: 'line',
    data: { labels: rows.map((r) => r.shortLabel), datasets },
    plugins: [normalBandsPlugin, valueLabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      layout: { padding: { top: 18, bottom: 4, right: 6 } },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          offset: true,
          grid: { display: false },
          ticks: { color: colors.muted, font: { size: 11 }, maxTicksLimit: 6, maxRotation: 0 }
        },
        y: {
          beginAtZero: false,
          suggestedMin: Math.floor(yMin - pad),
          suggestedMax: cap ? Math.min(cap, Math.ceil(yMax + pad)) : Math.ceil(yMax + pad),
          max: cap,
          grid: { color: colors.grid },
          border: { display: false },
          ticks: { color: colors.muted, font: { size: 11 }, callback: (v) => fmt(Number(v)) }
        }
      },
      plugins: {
        normalBands: { bands, color: colors.band },
        valueLabels: {
          enabled: rows.length <= MAX_LABELLED_POINTS,
          color: colors.text,
          below: metric.series.length > 1 ? [1] : [],
          format: fmt
        },
        legend: { display: false },
        tooltip: {
          backgroundColor: token('--gray-900', '#0f1c26'),
          padding: 10,
          displayColors: false,
          filter: (item) => item.raw !== null,
          callbacks: {
            title: (items) => rows[items[0].dataIndex].longLabel,
            label: (item) => {
              const s = metric.series[item.datasetIndex];
              const sev = rows[item.dataIndex].severity[item.datasetIndex];
              const name = metric.series.length > 1 ? `${s.name}: ` : '';
              const status = sev ? ` · ${SEVERITY_LABEL[sev]}` : '';
              return `${name}${fmt(item.raw as number)} ${metric.unit}${status}`;
            }
          }
        }
      }
    }
  });
}
