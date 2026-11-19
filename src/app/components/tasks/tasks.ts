import { Component, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalendarComponent } from '../calendar/calendar';
import { SubmissionHistoryService } from '../../services/submission-history.service';
import { ToastService } from '../../services/toast.service';

export type TaskStatus = 'complete' | 'partial' | 'none' | null;

export interface Task {
  id: string;
  name: string;
  category: string;
  icon: string;
  status: TaskStatus;
}

@Component({
  selector: 'app-tasks',
  imports: [FormsModule, CalendarComponent],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss'
})
export class TasksComponent {
  showModal = signal(false);
  selectedDate = signal<Date | null>(new Date());
  step = signal<'calendar' | 'tasks'>('tasks');
  
  formattedDate = computed(() => {
    const date = this.selectedDate();
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  });

  showCalendar(): void {
    this.step.set('calendar');
  }

  tasks: Task[] = [
    { id: 'medicine', name: 'Medicine', category: 'Health', icon: 'pill', status: null },
    { id: 'diet', name: 'Diet', category: 'Nutrition', icon: 'diet', status: null },
    { id: 'exercise', name: 'Exercise', category: 'Wellness', icon: 'exercise', status: null },
    { id: 'chota_recharge', name: 'Chota Recharge', category: 'Recharge', icon: 'water', status: null },
    { id: 'yoga_meditation', name: 'Yoga Meditation', category: 'Wellness', icon: 'meditation', status: null },
  ];

  private toast = inject(ToastService);
  isSubmitting = signal(false);
  /** True when the selected day already has a saved check-in; the form is then read-only. */
  alreadyLogged = signal(false);
  isLoadingDay = signal(false);

  constructor(
    private router: Router,
    private submissionHistoryService: SubmissionHistoryService
  ) {
    this.loadDay(this.selectedDate()!);
  }

  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
    this.step.set('tasks');
    this.loadDay(date);
  }

  /** Tasks are logged once per day: show what was saved for this day, or a blank form if nothing was. */
  private loadDay(date: Date): void {
    this.isLoadingDay.set(true);
    this.alreadyLogged.set(false);
    this.tasks.forEach((t) => (t.status = null));

    this.submissionHistoryService.getTasksForDate(date).subscribe({
      next: (saved) => {
        // Ignore a slow response for a day the user has since navigated away from.
        if (this.selectedDate()?.toDateString() !== date.toDateString()) return;
        for (const entry of saved) {
          const task = this.tasks.find((t) => t.id === entry.taskKey);
          if (task) task.status = entry.status as TaskStatus;
        }
        this.alreadyLogged.set(saved.length > 0);
        this.isLoadingDay.set(false);
      },
      error: () => {
        this.isLoadingDay.set(false);
        this.toast.show('Could not check this day’s tasks. Please try again.', 'error');
      }
    });
  }

  closeCalendar(): void {
    this.step.set('tasks');
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  setTaskStatus(taskId: string, status: TaskStatus): void {
    if (this.alreadyLogged()) return;
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      // Toggle off if same status clicked
      task.status = task.status === status ? null : status;
    }
  }

  clearAll(): void {
    this.tasks.forEach(task => task.status = null);
  }

  getStatusCount(status: Exclude<TaskStatus, null>): number {
    return this.tasks.filter(task => task.status === status).length;
  }

  getAnsweredCount(): number {
    return this.tasks.filter(task => task.status !== null).length;
  }

  getCompletionPercent(): number {
    if (this.tasks.length === 0) {
      return 0;
    }

    return Math.round((this.getAnsweredCount() / this.tasks.length) * 100);
  }

  canSubmit(): boolean {
    return !this.alreadyLogged() && !this.isLoadingDay() && this.getAnsweredCount() > 0;
  }

  onSubmit(): void {
    const selectedDate = this.selectedDate();
    if (!selectedDate || this.isSubmitting() || !this.canSubmit()) {
      return;
    }

    this.isSubmitting.set(true);
    this.submissionHistoryService.saveTasks(selectedDate, this.tasks).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showModal.set(true);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const message = err?.error?.error ?? 'Could not save tasks. Please try again.';
        this.toast.show(message, 'error');
        // Logged from another tab or device in the meantime: switch to the read-only view.
        if (err?.status === 409) this.loadDay(selectedDate);
      }
    });
  }

  closeModal(): void {
    this.showModal.set(false);
    this.resetForm();
    this.router.navigate(['/dashboard']);
  }

  onModalOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeModal();
    }
  }

  private resetForm(): void {
    this.tasks.forEach(task => task.status = null);
    this.selectedDate.set(null);
    this.step.set('calendar');
  }

  getTasksByCategory(category: string): Task[] {
    return this.tasks.filter(t => t.category === category);
  }

  get categories(): string[] {
    return [...new Set(this.tasks.map(t => t.category))];
  }

  getTaskStatusLabel(task: Task): string {
    if (!task.status) {
      return 'Not marked';
    }

    if (task.status === 'complete') {
      return 'Complete';
    }

    if (task.status === 'partial') {
      return 'Partial';
    }

    return 'None';
  }
}
