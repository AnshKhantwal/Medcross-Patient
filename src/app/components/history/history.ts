import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import type { Chart } from 'chart.js';
import { TaskStatus } from '../tasks/tasks';
import { VitalData } from '../vitals/vitals';
import { HistoryTimelineItem, SubmissionHistoryService } from '../../services/submission-history.service';
import { RangeKey, Severity, VITAL_RANGES, classifyVital, worseSeverity } from '../../services/vital-ranges';
import { TrendRow, buildTrendChart } from './trend-chart';

type MetricKey = 'bp' | 'pulse' | 'spo2' | 'temp' | 'resp' | 'weight';

interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  decimals: number;
  maxCap?: number;
  series: { name: string; pick: (v: VitalData) => number | null; range?: RangeKey }[];
}

const METRICS: MetricDef[] = [
  { key: 'bp', label: 'Blood pressure', unit: 'mmHg', decimals: 0, series: [
    { name: 'Systolic', pick: (v) => v.bpSystolic, range: 'bpSys' },
    { name: 'Diastolic', pick: (v) => v.bpDiastolic, range: 'bpDia' }] },
  { key: 'pulse', label: 'Pulse', unit: 'bpm', decimals: 0, series: [{ name: 'Pulse', pick: (v) => v.pulse, range: 'pulse' }] },
  { key: 'spo2', label: 'Oxygen', unit: '%', decimals: 0, maxCap: 100, series: [{ name: 'Oxygen', pick: (v) => v.spo2, range: 'spo2' }] },
  { key: 'temp', label: 'Temperature', unit: '°F', decimals: 1, series: [{ name: 'Temperature', pick: (v) => v.temperature, range: 'temp' }] },
  { key: 'resp', label: 'Resp. rate', unit: '/min', decimals: 0, series: [{ name: 'Resp. rate', pick: (v) => v.respiratoryRate, range: 'resp' }] },
  { key: 'weight', label: 'Weight', unit: 'kg', decimals: 1, series: [{ name: 'Weight', pick: (v) => v.weight }] }
];

@Component({
  selector: 'app-history',
  imports: [],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryComponent {
  private readonly router = inject(Router);
  private readonly submissionHistoryService = inject(SubmissionHistoryService);

  step = signal<'dates' | 'details'>('dates');
  view = signal<'trends' | 'log'>('trends');
  metrics = METRICS;
  metricKey = signal<MetricKey>('bp');
  ranges: (7 | 30 | 90)[] = [7, 30, 90];
  rangeDays = signal<7 | 30 | 90>(30);
  historyItems = signal<HistoryTimelineItem[]>([]);
  isLoading = signal(true);
  filterMode = signal<'all' | 'vitals' | 'tasks'>('all');
  searchQuery = signal<string>('');

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('trendCanvas');
  private chartInstance: Chart | null = null;

  constructor() {
    effect(() => {
      const el = this.canvas()?.nativeElement;
      const t = this.trend();
      const m = this.currentMetric();
      this.chartInstance?.destroy();
      this.chartInstance = null;
      if (!el || !t || t.stats.count < 2) return;
      this.chartInstance = buildTrendChart(el, m, t.rows);
    });
    inject(DestroyRef).onDestroy(() => this.chartInstance?.destroy());

    this.submissionHistoryService.getAllHistory().subscribe({
      next: (items) => {
        this.historyItems.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  filteredHistoryItems = computed<HistoryTimelineItem[]>(() => {
    const mode = this.filterMode();
    const query = this.searchQuery().trim().toLowerCase();

    return this.historyItems().filter((item) => {
      const matchesMode =
        mode === 'all' ||
        (mode === 'vitals' && !!item.vitals) ||
        (mode === 'tasks' && !!item.tasks);

      if (!matchesMode) {
        return false;
      }

      if (!query) {
        return true;
      }

      const displayDate = this.formatDisplayDate(item.date).toLowerCase();
      const numericDate = new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US');
      const longDate = new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).toLowerCase();

      return (
        item.date.includes(query) ||
        displayDate.includes(query) ||
        numericDate.toLowerCase().includes(query) ||
        longDate.includes(query)
      );
    });
  });

  selectedDate = signal<string | null>(null);
  selectedRecord = computed<HistoryTimelineItem | null>(() => {
    const selectedDate = this.selectedDate();
    if (!selectedDate) {
      return null;
    }

    return this.historyItems().find((item) => item.date === selectedDate) ?? null;
  });

  selectedSubmittedAt = computed<string>(() => {
    const record = this.selectedRecord();
    if (!record) {
      return '';
    }

    return this.formatSubmittedAt(record.lastSubmittedAt);
  });

  selectedTaskCounts = computed(() => {
    const tasks = this.selectedRecord()?.tasks?.tasks ?? [];
    const complete = tasks.filter((task) => task.status === 'complete').length;
    const partial = tasks.filter((task) => task.status === 'partial').length;
    const none = tasks.filter((task) => task.status === 'none').length;

    return {
      total: tasks.length,
      complete,
      partial,
      none
    };
  });

  formatDisplayDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  setView(v: 'trends' | 'log'): void {
    this.view.set(v);
  }

  setMetric(k: MetricKey): void {
    this.metricKey.set(k);
  }

  setRange(d: 7 | 30 | 90): void {
    this.rangeDays.set(d);
  }

  currentMetric = computed(() => METRICS.find((m) => m.key === this.metricKey())!);

  /** One point per logged day for the selected metric and range, plus the summary tiles above the chart. */
  trend = computed(() => {
    const m = this.currentMetric();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (this.rangeDays() - 1));
    const t0 = start.getTime();
    const fmt = (n: number) => (m.decimals ? n.toFixed(m.decimals) : `${Math.round(n)}`);

    const rows: (TrendRow & { time: number })[] = this.historyItems()
      .filter((i) => i.vitals)
      .map((i) => {
        const v = i.vitals!.vitals;
        const date = new Date(`${i.date}T00:00:00`);
        const values = m.series.map((s) => s.pick(v));
        return {
          time: date.getTime(),
          shortLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          longLabel: this.formatDisplayDate(i.date),
          values,
          severity: values.map((n, si) => (m.series[si].range ? classifyVital(m.series[si].range!, n) : null))
        };
      })
      .filter((r) => r.time >= t0 && r.values.some((n) => n !== null))
      .sort((a, b) => a.time - b.time);

    if (!rows.length) return null;

    const first = rows.map((r) => r.values[0]).filter((n): n is number => n !== null);
    const latest = rows[rows.length - 1];
    const avg = m.series
      .map((_, si) => {
        const vals = rows.map((r) => r.values[si]).filter((n): n is number => n !== null);
        return vals.length ? fmt(vals.reduce((s, n) => s + n, 0) / vals.length) : '–';
      })
      .join('/');

    const hasRange = !!m.series[0].range;
    let worst: Severity | null = null;
    let outOfRange = 0;
    for (const r of rows) {
      const day = r.severity.reduce<Severity | null>((w, s) => worseSeverity(w, s), null);
      worst = worseSeverity(worst, day);
      if (day === 'warn' || day === 'danger') outOfRange++;
    }

    const rangeText = hasRange
      ? m.series
          .map((s) => {
            const r = VITAL_RANGES[s.range!];
            const text = r.normalHigh === Infinity ? `${r.normalLow} or above` : `${r.normalLow}–${r.normalHigh}`;
            return m.series.length > 1 ? `${s.name.toLowerCase()} ${text}` : text;
          })
          .join(', ') + ` ${m.unit}`
      : null;

    return {
      rows,
      rangeText,
      stats: {
        latest: m.series.length > 1 ? latest.values.map((n) => (n === null ? '–' : fmt(n))).join('/') : fmt(latest.values[0] as number),
        avg,
        min: m.series.length === 1 && first.length ? fmt(Math.min(...first)) : null,
        max: m.series.length === 1 && first.length ? fmt(Math.max(...first)) : null,
        count: rows.length,
        latestDate: latest.shortLabel,
        outOfRange: hasRange ? outOfRange : null,
        worst
      }
    };
  });

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  setFilterMode(mode: 'all' | 'vitals' | 'tasks'): void {
    this.filterMode.set(mode);
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  selectDate(date: string): void {
    this.selectedDate.set(date);
    this.step.set('details');
  }

  backToDates(): void {
    this.step.set('dates');
    this.selectedDate.set(null);
  }

  isSelectedDate(date: string): boolean {
    return this.selectedDate() === date;
  }

  formatSubmittedAt(isoDate: string): string {
    return new Date(isoDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  formatTaskStatus(status: TaskStatus): string {
    if (status === 'complete') {
      return 'Complete';
    }

    if (status === 'partial') {
      return 'Partial';
    }

    if (status === 'none') {
      return 'None';
    }

    return 'Not Marked';
  }

  statusClass(status: TaskStatus): string {
    return status ?? 'unmarked';
  }
}
