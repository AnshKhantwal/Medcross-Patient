import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TaskStatus } from '../tasks/tasks';
import { VitalData } from '../vitals/vitals';
import { HistoryTimelineItem, SubmissionHistoryService } from '../../services/submission-history.service';

type MetricKey = 'bp' | 'pulse' | 'spo2' | 'temp' | 'weight';

interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  pick: (v: VitalData) => number | null;
  pick2?: (v: VitalData) => number | null;
  /** Usual range for general adults, drawn as a soft band — informational only. */
  band?: [number, number];
  decimals: number;
}

const METRICS: MetricDef[] = [
  { key: 'bp', label: 'Blood pressure', unit: 'mmHg', pick: (v) => v.bpSystolic, pick2: (v) => v.bpDiastolic, band: [90, 120], decimals: 0 },
  { key: 'pulse', label: 'Pulse', unit: 'bpm', pick: (v) => v.pulse, band: [60, 100], decimals: 0 },
  { key: 'spo2', label: 'Oxygen', unit: '%', pick: (v) => v.spo2, band: [95, 100], decimals: 0 },
  { key: 'temp', label: 'Temperature', unit: '°F', pick: (v) => v.temperature, band: [97, 99], decimals: 1 },
  { key: 'weight', label: 'Weight', unit: 'kg', pick: (v) => v.weight, decimals: 1 }
];

const CHART = { w: 340, h: 190, l: 38, r: 12, t: 12, b: 26 };

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

  constructor() {
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

  /** Chart geometry + summary stats for the selected metric and range. */
  chart = computed(() => {
    const m = this.currentMetric();
    const days = this.rangeDays();
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const t0 = start.getTime();
    const span = Math.max(end.getTime() - t0, 1);

    const rows = this.historyItems()
      .filter((i) => i.vitals)
      .map((i) => ({
        time: new Date(`${i.date}T00:00:00`).getTime(),
        a: m.pick(i.vitals!.vitals),
        b: m.pick2 ? m.pick2(i.vitals!.vitals) : null
      }))
      .filter((r) => r.time >= t0 && r.a != null)
      .sort((x, y) => x.time - y.time);

    if (!rows.length) return null;

    const all = rows.flatMap((r) => [r.a as number, ...(r.b != null ? [r.b] : [])]);
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    if (m.band) {
      lo = Math.min(lo, m.band[0]);
      hi = Math.max(hi, m.band[1]);
    }
    const pad = (hi - lo || 1) * 0.12;
    lo -= pad;
    hi += pad;

    const pw = CHART.w - CHART.l - CHART.r;
    const ph = CHART.h - CHART.t - CHART.b;
    const x = (time: number) => CHART.l + ((time - t0) / span) * pw;
    const y = (v: number) => CHART.t + (1 - (v - lo) / (hi - lo)) * ph;
    const fmt = (v: number) => (m.decimals ? v.toFixed(m.decimals) : `${Math.round(v)}`);
    const shortDate = (time: number) => new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const line = (pick: (r: (typeof rows)[number]) => number | null | undefined, label: string) => {
      const pts = rows
        .filter((r) => pick(r) != null)
        .map((r) => ({
          x: x(r.time),
          y: y(pick(r) as number),
          tip: `${label} ${fmt(pick(r) as number)} ${m.unit} — ${shortDate(r.time)}`
        }));
      return { points: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), dots: pts };
    };

    const lines = [line((r) => r.a, m.pick2 ? 'Systolic' : m.label)];
    if (m.pick2) lines.push(line((r) => r.b, 'Diastolic'));

    const yTicks = [0, 1, 2, 3].map((i) => ({
      y: CHART.t + (ph * i) / 3,
      label: fmt(hi - ((hi - lo) * i) / 3)
    }));

    const xLabels = [0, 0.5, 1].map((f) => ({
      x: CHART.l + pw * f,
      anchor: f === 0 ? 'start' : f === 1 ? 'end' : 'middle',
      label: shortDate(t0 + span * f)
    }));

    const band = m.band ? { y: y(m.band[1]), h: Math.max(y(m.band[0]) - y(m.band[1]), 0), x: CHART.l, w: pw } : null;

    const main = rows.map((r) => r.a as number);
    const avg = main.reduce((s, n) => s + n, 0) / main.length;
    const latest = rows[rows.length - 1];
    const stats = {
      latest: m.pick2 ? `${latest.a}/${latest.b ?? '–'}` : fmt(latest.a as number),
      avg: fmt(avg),
      min: fmt(Math.min(...main)),
      max: fmt(Math.max(...main)),
      count: rows.length,
      latestDate: shortDate(latest.time)
    };

    return { lines, yTicks, xLabels, band, stats, w: CHART.w, h: CHART.h, bottom: CHART.h - CHART.b, left: CHART.l, right: CHART.w - CHART.r };
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
