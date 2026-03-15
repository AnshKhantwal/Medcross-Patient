import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalendarComponent } from '../calendar/calendar';

export interface VitalData {
  heightFeet: number | null;
  heightInches: number | null;
  weight: number | null;
  temperature: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  respiratoryRate: number | null;
  pulse: number | null;
  spo2: number | null;
}

@Component({
  selector: 'app-vitals',
  imports: [FormsModule, CalendarComponent],
  templateUrl: './vitals.html',
  styleUrl: './vitals.scss'
})
export class VitalsComponent {
  showModal = signal(false);
  selectedDate = signal<Date | null>(null);
  step = signal<'calendar' | 'form'>('calendar');
  
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
  
  vitals: VitalData = {
    heightFeet: null,
    heightInches: null,
    weight: null,
    temperature: null,
    bpSystolic: null,
    bpDiastolic: null,
    respiratoryRate: null,
    pulse: null,
    spo2: null
  };

  constructor(private router: Router) {}

  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
    this.step.set('form');
  }

  goBack(): void {
    if (this.step() === 'form') {
      this.step.set('calendar');
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit(): void {
    console.log('Vitals submitted:', { date: this.selectedDate(), vitals: this.vitals });
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
    this.vitals = {
      heightFeet: null,
      heightInches: null,
      weight: null,
      temperature: null,
      bpSystolic: null,
      bpDiastolic: null,
      respiratoryRate: null,
      pulse: null,
      spo2: null
    };
    this.selectedDate.set(null);
    this.step.set('calendar');
  }
}
