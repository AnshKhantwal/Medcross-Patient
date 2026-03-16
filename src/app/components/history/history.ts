import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CalendarComponent } from '../calendar/calendar';
import { TaskStatus } from '../tasks/tasks';
import { HistoryRecord, SubmissionHistoryService, TasksSubmission } from '../../services/submission-history.service';
import { VitalData } from '../vitals/vitals';

@Component({
  selector: 'app-history',
  imports: [CalendarComponent],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryComponent {
  private readonly router = inject(Router);
  private readonly submissionHistoryService = inject(SubmissionHistoryService);

  selectedDate = signal<Date | null>(null);
  step = signal<'calendar' | 'history'>('calendar');
  historyRecord = signal<HistoryRecord | null>(null);

  formattedDate = computed(() => {
    const date = this.selectedDate();
    if (!date) {
      return '';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  });

  vitalsData = computed<VitalData | null>(() => this.historyRecord()?.vitals?.vitals ?? null);
  tasksData = computed<TasksSubmission['tasks']>(() => this.historyRecord()?.tasks?.tasks ?? []);

  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
    this.historyRecord.set(this.submissionHistoryService.getHistoryByDate(date));
    this.step.set('history');
  }

  goBack(): void {
    if (this.step() === 'history') {
      this.step.set('calendar');
      return;
    }

    this.router.navigate(['/dashboard']);
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
