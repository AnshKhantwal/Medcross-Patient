import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { VitalData } from '../vitals/vitals';
import { AuthService } from '../../services/auth.service';
import { HistoryTimelineItem, SubmissionHistoryService } from '../../services/submission-history.service';

type VitalLevel = 'ok' | 'watch' | 'alert' | 'none';

interface VitalTile {
  label: string;
  value: string;
  unit: string;
  level: VitalLevel;
  status: string;
  /** Change vs the previous reading, e.g. "+2" — empty when there is no earlier reading. */
  delta: string;
  /** SVG polyline points for the last readings (oldest → newest); empty with < 2 readings. */
  spark: string;
}

interface WeekDay {
  letter: string;
  iso: string;
  logged: boolean;
  today: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private historyService = inject(SubmissionHistoryService);

  fabOpen = signal(false);
  history = signal<HistoryTimelineItem[]>([]);
  isLoading = signal(true);

  private readonly todayIso = this.toIsoDate(new Date());

  constructor() {
    this.historyService.getAllHistory().subscribe({
      next: (items) => {
        this.history.set(items);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  get patient() {
    return this.authService.getPatient();
  }

  get avatarUrl() {
    return this.authService.getAvatar();
  }

  greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  currentDate = computed(() => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  });

  hasData = computed(() => this.history().length > 0);

  private latestVitalsItem = computed(() => this.history().find((i) => i.vitals) ?? null);
  latestVitalsDate = computed(() => this.latestVitalsItem()?.date ?? null);

  private todaysItem = computed(() => this.history().find((i) => i.date === this.todayIso) ?? null);
  loggedTasksToday = computed(() => !!this.todaysItem()?.tasks);
  loggedVitalsToday = computed(() => !!this.todaysItem()?.vitals);

  /** Vitals entries, newest first. */
  private vitalsHistory = computed(() => this.history().filter((i) => i.vitals));

  vitalTiles = computed<VitalTile[]>(() => {
    const v = this.latestVitalsItem()?.vitals?.vitals;
    if (!v) return [];

    const tiles: VitalTile[] = [];
    if (v.bpSystolic != null && v.bpDiastolic != null) {
      const { level, status } = this.bpStatus(v.bpSystolic, v.bpDiastolic);
      tiles.push({
        label: 'Blood Pressure', value: `${v.bpSystolic}/${v.bpDiastolic}`, unit: 'mmHg', level, status,
        ...this.trend((x) => x.bpSystolic)
      });
    }
    if (v.pulse != null) {
      const { level, status } = this.rangeStatus(v.pulse, 60, 100, 40, 120);
      tiles.push({ label: 'Pulse', value: `${v.pulse}`, unit: 'bpm', level, status, ...this.trend((x) => x.pulse) });
    }
    if (v.spo2 != null) {
      const level: VitalLevel = v.spo2 < 90 ? 'alert' : v.spo2 < 95 ? 'watch' : 'ok';
      tiles.push({
        label: 'Oxygen', value: `${v.spo2}`, unit: '%', level,
        status: level === 'ok' ? 'Normal' : level === 'watch' ? 'Low' : 'Very low',
        ...this.trend((x) => x.spo2)
      });
    }
    if (v.temperature != null) {
      const level: VitalLevel = v.temperature >= 100.4 ? 'alert' : v.temperature >= 99.5 || v.temperature < 97 ? 'watch' : 'ok';
      tiles.push({
        label: 'Temperature', value: `${v.temperature}`, unit: '°F', level,
        status: level === 'ok' ? 'Normal' : v.temperature < 97 ? 'Low' : v.temperature >= 100.4 ? 'Fever' : 'Raised',
        ...this.trend((x) => x.temperature)
      });
    }
    if (v.weight != null) {
      tiles.push({
        label: 'Weight', value: `${v.weight}`, unit: 'kg', level: 'none', status: '',
        ...this.trend((x) => x.weight)
      });
    }
    if (v.respiratoryRate != null) {
      const { level, status } = this.rangeStatus(v.respiratoryRate, 12, 20, 8, 25);
      tiles.push({
        label: 'Resp. Rate', value: `${v.respiratoryRate}`, unit: '/min', level, status,
        ...this.trend((x) => x.respiratoryRate)
      });
    }
    return tiles;
  });

  /** Count of tiles outside the usual range — drives the summary line above the tiles. */
  attentionCount = computed(() => this.vitalTiles().filter((t) => t.level === 'watch' || t.level === 'alert').length);

  /** Last 7 days (oldest → today) with whether anything was logged — a consistency cue. */
  weekDays = computed<WeekDay[]>(() => {
    const logged = new Set(this.history().map((i) => i.date));
    const days: WeekDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = this.toIsoDate(d);
      days.push({
        letter: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        iso,
        logged: logged.has(iso),
        today: i === 0
      });
    }
    return days;
  });

  /** Consecutive days logged, ending today (or yesterday, so the streak isn't lost before you've logged today). */
  streak = computed(() => {
    const logged = new Set(this.history().map((i) => i.date));
    const d = new Date();
    if (!logged.has(this.toIsoDate(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (logged.has(this.toIsoDate(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  });

  /** Single most useful next step for today — the reason to open the app. */
  nudge = computed(() => {
    if (!this.loggedVitalsToday()) {
      return { title: "Log today's vitals", text: 'Takes under a minute and keeps your trends accurate.', action: 'vitals' as const, cta: 'Record vitals' };
    }
    if (!this.loggedTasksToday()) {
      return { title: 'Vitals done — one more', text: "Check in on today's tasks to complete your day.", action: 'tasks' as const, cta: 'Log tasks' };
    }
    return { title: "You're all set for today", text: 'Everything is logged. See you tomorrow to keep your streak going.', action: null, cta: '' };
  });

  /** Short celebratory line for streaks and total check-ins. */
  milestone = computed(() => {
    const n = this.streak();
    const total = this.history().length;
    if (n >= 30) return `${n} days in a row — an amazing habit.`;
    if (n >= 14) return `${n} days in a row — two weeks of consistency.`;
    if (n >= 7) return `${n} days in a row — a full week!`;
    if (n >= 3) return `${n} days in a row — keep it going.`;
    if (total >= 10) return `${total} check-ins logged so far.`;
    return '';
  });

  /** Plain-language comparisons of the latest reading to the patient's own recent average. Descriptive only — not medical advice. */
  insights = computed<string[]>(() => {
    const metrics: { name: string; unit: string; pick: (v: VitalData) => number | null | undefined }[] = [
      { name: 'Systolic blood pressure', unit: 'points', pick: (v) => v.bpSystolic },
      { name: 'Pulse', unit: 'bpm', pick: (v) => v.pulse },
      { name: 'Weight', unit: 'kg', pick: (v) => v.weight }
    ];
    const out: string[] = [];
    for (const m of metrics) {
      const vals = this.vitalsHistory().map((i) => m.pick(i.vitals!.vitals)).filter((n): n is number => n != null);
      if (vals.length < 3) continue;
      const prev = vals.slice(1, 8);
      const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
      const diff = Math.round((vals[0] - avg) * 10) / 10;
      if (Math.abs(diff) < Math.max(1, avg * 0.02)) {
        out.push(`${m.name} is steady.`);
      } else {
        out.push(`${m.name} is ${Math.abs(diff)} ${m.unit} ${diff < 0 ? 'lower' : 'higher'}.`);
      }
    }
    return out.slice(0, 2);
  });

  runNudge(): void {
    const a = this.nudge().action;
    if (a === 'vitals') this.goToVitals();
    else if (a === 'tasks') this.goToTasks();
  }

  private bpStatus(sys: number, dia: number): { level: VitalLevel; status: string } {
    if (sys >= 180 || dia >= 120) return { level: 'alert', status: 'Very high' };
    if (sys >= 140 || dia >= 90) return { level: 'alert', status: 'High' };
    if (sys >= 120 || dia >= 80) return { level: 'watch', status: 'Elevated' };
    if (sys < 90 || dia < 60) return { level: 'watch', status: 'Low' };
    return { level: 'ok', status: 'Normal' };
  }

  private rangeStatus(value: number, lo: number, hi: number, critLo: number, critHi: number): { level: VitalLevel; status: string } {
    if (value < critLo) return { level: 'alert', status: 'Very low' };
    if (value > critHi) return { level: 'alert', status: 'Very high' };
    if (value < lo) return { level: 'watch', status: 'Low' };
    if (value > hi) return { level: 'watch', status: 'High' };
    return { level: 'ok', status: 'Normal' };
  }

  /** Sparkline + change-since-last for one metric, from the last 7 readings that include it. */
  private trend(pick: (v: VitalData) => number | null | undefined): { delta: string; spark: string } {
    const readings = this.vitalsHistory()
      .map((i) => pick(i.vitals!.vitals))
      .filter((n): n is number => n != null)
      .slice(0, 7)
      .reverse();
    if (readings.length < 2) return { delta: '', spark: '' };

    const diff = Math.round((readings[readings.length - 1] - readings[readings.length - 2]) * 10) / 10;
    const delta = diff === 0 ? 'No change' : `${diff > 0 ? '+' : ''}${diff}`;

    const min = Math.min(...readings);
    const range = Math.max(...readings) - min || 1;
    const step = 60 / (readings.length - 1);
    const spark = readings.map((r, i) => `${(i * step).toFixed(1)},${(18 - ((r - min) / range) * 16 - 1).toFixed(1)}`).join(' ');
    return { delta, spark };
  }

  taskStats = computed(() => {
    const tasks = this.todaysItem()?.tasks?.tasks ?? [];
    const complete = tasks.filter((t) => t.status === 'complete').length;
    const partial = tasks.filter((t) => t.status === 'partial').length;
    const none = tasks.filter((t) => t.status === 'none').length;
    const total = tasks.length;
    const pct = total ? Math.round(((complete + partial * 0.5) / total) * 100) : 0;
    return { complete, partial, none, total, pct };
  });

  relativeDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private toIsoDate(date: Date): string {
    const n = new Date(date);
    n.setHours(0, 0, 0, 0);
    const month = `${n.getMonth() + 1}`.padStart(2, '0');
    const day = `${n.getDate()}`.padStart(2, '0');
    return `${n.getFullYear()}-${month}-${day}`;
  }

  toggleFab(): void {
    this.fabOpen.update((v) => !v);
  }

  closeFab(): void {
    this.fabOpen.set(false);
  }

  goToVitals(): void {
    this.closeFab();
    this.router.navigate(['/vitals']);
  }

  goToTasks(): void {
    this.closeFab();
    this.router.navigate(['/tasks']);
  }

  goToHistory(): void {
    this.closeFab();
    this.router.navigate(['/history']);
  }
}
