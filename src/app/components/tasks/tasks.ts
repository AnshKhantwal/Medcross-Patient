import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalendarComponent } from '../calendar/calendar';

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
    { id: 'medicine_morning', name: 'Morning Medicine', category: 'Medicine', icon: 'pill', status: null },
    { id: 'medicine_afternoon', name: 'Afternoon Medicine', category: 'Medicine', icon: 'pill', status: null },
    { id: 'medicine_evening', name: 'Evening Medicine', category: 'Medicine', icon: 'pill', status: null },
    { id: 'medicine_night', name: 'Night Medicine', category: 'Medicine', icon: 'pill', status: null },
    { id: 'exercise', name: 'Exercise / Physical Activity', category: 'Wellness', icon: 'exercise', status: null },
    { id: 'meditation', name: 'Meditation / Relaxation', category: 'Wellness', icon: 'meditation', status: null },
    { id: 'water_intake', name: 'Water Intake (8 glasses)', category: 'Nutrition', icon: 'water', status: null },
    { id: 'healthy_diet', name: 'Healthy Diet', category: 'Nutrition', icon: 'diet', status: null },
    { id: 'sleep', name: 'Adequate Sleep (7-8 hrs)', category: 'Rest', icon: 'sleep', status: null },
    { id: 'walk', name: 'Walking (30 mins)', category: 'Wellness', icon: 'walk', status: null },
  ];

  constructor(private router: Router) {}

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

  onSubmit(): void {
    console.log('Tasks submitted:', { date: this.selectedDate(), tasks: this.tasks });
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
}
