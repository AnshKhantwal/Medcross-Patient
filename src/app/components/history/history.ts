import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TaskStatus } from '../tasks/tasks';
import { HistoryTimelineItem, SubmissionHistoryService } from '../../services/submission-history.service';

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
  historyItems = signal<HistoryTimelineItem[]>(this.submissionHistoryService.getAllHistory());
  filterMode = signal<'all' | 'vitals' | 'tasks'>('all');
  searchQuery = signal<string>('');

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
      return item.date.includes(query) || displayDate.includes(query);
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
