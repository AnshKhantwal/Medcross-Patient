import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HistoryTimelineItem, SubmissionHistoryService } from '../../services/submission-history.service';

interface VitalTile {
  label: string;
  value: string;
  unit: string;
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

  vitalTiles = computed<VitalTile[]>(() => {
    const v = this.latestVitalsItem()?.vitals?.vitals;
    if (!v) return [];

    const tiles: VitalTile[] = [];
    if (v.bpSystolic != null && v.bpDiastolic != null) {
      tiles.push({ label: 'Blood Pressure', value: `${v.bpSystolic}/${v.bpDiastolic}`, unit: 'mmHg' });
    }
    if (v.pulse != null) tiles.push({ label: 'Pulse', value: `${v.pulse}`, unit: 'bpm' });
    if (v.spo2 != null) tiles.push({ label: 'Oxygen', value: `${v.spo2}`, unit: '%' });
    if (v.temperature != null) tiles.push({ label: 'Temperature', value: `${v.temperature}`, unit: '°F' });
    if (v.weight != null) tiles.push({ label: 'Weight', value: `${v.weight}`, unit: 'kg' });
    if (v.respiratoryRate != null) tiles.push({ label: 'Resp. Rate', value: `${v.respiratoryRate}`, unit: '/min' });
    return tiles;
  });

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
