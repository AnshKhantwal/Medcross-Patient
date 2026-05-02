import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalendarComponent } from '../calendar/calendar';
import { SubmissionHistoryService } from '../../services/submission-history.service';

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
  selectedDate = signal<Date | null>(null);
  step = signal<'calendar' | 'tasks'>('calendar');
  
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

  tasks: Task[] = [
    { id: 'medicine', name: 'Medicine', category: 'Health', icon: 'pill', status: null },
    { id: 'diet', name: 'Diet', category: 'Nutrition', icon: 'diet', status: null },
    { id: 'exercise', name: 'Exercise', category: 'Wellness', icon: 'exercise', status: null },
    { id: 'chota_recharge', name: 'Chota Recharge', category: 'Recharge', icon: 'water', status: null },
    { id: 'yoga_meditation', name: 'Yoga Meditation', category: 'Wellness', icon: 'meditation', status: null },
  ];

  constructor(
    private router: Router,
    private submissionHistoryService: SubmissionHistoryService
  ) {}

  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
    this.step.set('tasks');
  }

  goBack(): void {
    if (this.step() === 'tasks') {
      this.step.set('calendar');
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  setTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      // Toggle off if same status clicked
      task.status = task.status === status ? null : status;
    }
  }

  setAllTasksStatus(status: Exclude<TaskStatus, null>): void {
    this.tasks.forEach(task => {
      task.status = status;
    });
  }

  clearAllStatuses(): void {
    this.tasks.forEach(task => {
      task.status = null;
    });
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
    return this.getAnsweredCount() > 0;
  }

  onSubmit(): void {
    const selectedDate = this.selectedDate();
    if (selectedDate) {
      this.submissionHistoryService.saveTasks(selectedDate, this.tasks);
    }

    console.log('Tasks submitted:', { date: selectedDate, tasks: this.tasks });
    this.showModal.set(true);
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
