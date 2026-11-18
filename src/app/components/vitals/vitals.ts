import { Component, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalendarComponent } from '../calendar/calendar';
import { SubmissionHistoryService } from '../../services/submission-history.service';
import { ToastService } from '../../services/toast.service';

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
  selectedDate = signal<Date | null>(new Date());
  step = signal<'calendar' | 'form'>('form');
  
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

  private toast = inject(ToastService);
  isSubmitting = signal(false);
  streak = signal(0);

  encouragement = computed(() => {
    const n = this.streak();
    if (n >= 30) return 'A month of consistency. Remarkable.';
    if (n >= 14) return 'Two weeks strong. Keep it going.';
    if (n >= 7) return 'A full week. This is becoming a habit.';
    if (n >= 3) return "You're building momentum.";
    if (n === 2) return 'Two days running. Come back tomorrow!';
    return 'Great start. Log again tomorrow to build a streak.';
  });

  /** True once at least one measurement has been entered — gates the submit button. */
  get hasAnyValue(): boolean {
    return Object.values(this.vitals).some(
      (v) => v !== null && v !== undefined && (v as unknown) !== ''
    );
  }

  /** Gentle, non-blocking flag when a value falls outside the plausible clinical range. */
  outOfRange(value: number | null, min: number, max: number): boolean {
    return value !== null && value !== undefined && (value < min || value > max);
  }

  /** Hard limits matching the API's plausibility check — used for the blocking, field-named toast. */
  private readonly fieldRules: Array<{ key: keyof VitalData; label: string; min: number; max: number; unit: string }> = [
    { key: 'bpSystolic', label: 'Systolic blood pressure', min: 41, max: 299, unit: 'mmHg' },
    { key: 'bpDiastolic', label: 'Diastolic blood pressure', min: 21, max: 199, unit: 'mmHg' },
    { key: 'pulse', label: 'Pulse', min: 1, max: 299, unit: 'bpm' },
    { key: 'spo2', label: 'SpO2', min: 1, max: 100, unit: '%' },
    { key: 'respiratoryRate', label: 'Respiratory rate', min: 1, max: 99, unit: 'breaths/min' },
    { key: 'weight', label: 'Weight', min: 1, max: 399, unit: 'kg' }
  ];

  /** Returns a message naming the first field that's filled in but out of range, or null if all are fine. */
  private validateVitals(): string | null {
    const temp = this.vitals.temperature;
    if (temp !== null && temp !== undefined && (temp <= 80 || temp >= 115)) {
      return 'Temperature must be between 80 and 115 °F.';
    }

    for (const rule of this.fieldRules) {
      const value = this.vitals[rule.key] as number | null;
      if (value === null || value === undefined) continue;
      if (value < rule.min || value > rule.max) {
        return `${rule.label} must be between ${rule.min} and ${rule.max} ${rule.unit}.`;
      }
    }
    return null;
  }

  /** Truncates the integer part to at most `maxIntDigits` digits and rounds the fraction to `maxDecimals` places. */
  private clampDigits(value: number, maxIntDigits: number, maxDecimals = 0): number {
    if (!Number.isFinite(value)) return value;
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    const intPart = Math.trunc(abs);
    const intStr = intPart.toString();
    const truncatedInt = intStr.length > maxIntDigits ? Number(intStr.slice(0, maxIntDigits)) : intPart;
    const frac = abs - intPart;
    const scale = 10 ** maxDecimals;
    const roundedFrac = maxDecimals > 0 ? Math.round(frac * scale) / scale : 0;
    return sign * (truncatedInt + roundedFrac);
  }

  /** Bound to (ngModelChange) on the 3-digit-max vitals so typing a 4th digit is rejected live. */
  onVitalInput(field: 'weight' | 'bpSystolic' | 'bpDiastolic' | 'spo2' | 'pulse' | 'respiratoryRate', value: number | null): void {
    this.vitals[field] = value === null ? null : this.clampDigits(value, 3);
  }

  /** Temperature allows up to 3 digits before the decimal point and 2 after it, e.g. 104.25. */
  onTemperatureInput(value: number | null): void {
    this.vitals.temperature = value === null ? null : this.clampDigits(value, 3, 2);
  }

  constructor(
    private router: Router,
    private submissionHistoryService: SubmissionHistoryService
  ) {}

  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
    this.step.set('form');
  }

  closeCalendar(): void {
    this.step.set('form');
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  onSubmit(): void {
    const selectedDate = this.selectedDate();
    if (!selectedDate || this.isSubmitting()) {
      return;
    }

    const validationError = this.validateVitals();
    if (validationError) {
      this.toast.show(validationError, 'error');
      return;
    }

    this.isSubmitting.set(true);
    this.submissionHistoryService.saveVitals(selectedDate, this.vitals).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showModal.set(true);
        this.loadStreak();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const message = err?.error?.error ?? 'Could not save vitals. Please try again.';
        this.toast.show(message, 'error');
      }
    });
  }

  private loadStreak(): void {
    this.submissionHistoryService.getAllHistory().subscribe({
      next: (items) => {
        const logged = new Set(items.map((i) => i.date));
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        const iso = (x: Date) => `${x.getFullYear()}-${`${x.getMonth() + 1}`.padStart(2, '0')}-${`${x.getDate()}`.padStart(2, '0')}`;
        if (!logged.has(iso(d))) d.setDate(d.getDate() - 1);
        let n = 0;
        while (logged.has(iso(d))) {
          n++;
          d.setDate(d.getDate() - 1);
        }
        this.streak.set(n);
      },
      error: () => this.streak.set(0)
    });
  }

  logTasksNext(): void {
    this.showModal.set(false);
    this.router.navigate(['/tasks']);
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
