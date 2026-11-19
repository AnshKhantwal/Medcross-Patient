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

  /** Returns a message per out-of-range field that's filled in, so every problem is reported at once. */
  private validateVitals(): string[] {
    const errors: string[] = [];

    const temp = this.vitals.temperature;
    if (temp !== null && temp !== undefined && (temp <= 80 || temp >= 115)) {
      errors.push('Temperature must be between 80 and 115 °F.');
    }

    for (const rule of this.fieldRules) {
      const value = this.vitals[rule.key] as number | null;
      if (value === null || value === undefined) continue;
      if (value < rule.min || value > rule.max) {
        errors.push(`${rule.label} must be between ${rule.min} and ${rule.max} ${rule.unit}.`);
      }
    }
    return errors;
  }

  /** Fields that only make sense together — both filled in or both left blank, never just one. */
  private readonly pairedFields: Array<{ a: keyof VitalData; b: keyof VitalData; message: string }> = [
    { a: 'bpSystolic', b: 'bpDiastolic', message: 'Enter both systolic and diastolic blood pressure, or leave blood pressure blank.' },
    { a: 'heightFeet', b: 'heightInches', message: 'Enter both feet and inches for height, or leave height blank.' }
  ];

  /** Returns a message for every pair where exactly one side was filled in. */
  private validatePairs(): string[] {
    const errors: string[] = [];
    for (const pair of this.pairedFields) {
      const aFilled = this.vitals[pair.a] !== null && this.vitals[pair.a] !== undefined;
      const bFilled = this.vitals[pair.b] !== null && this.vitals[pair.b] !== undefined;
      if (aFilled !== bFilled) {
        errors.push(pair.message);
      }
    }
    return errors;
  }

  /**
   * Bound to (keydown) on the 3-digit-max vitals. Rejects a digit keystroke outright once the
   * field already has `maxIntDigits` digits (or, for temperature, `maxDecimals` after the point) —
   * no rewriting/truncating of what was typed, typing past the limit simply does nothing.
   */
  onDigitKeydown(event: KeyboardEvent, maxIntDigits: number, allowDecimal = false, maxDecimals = 0): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length > 1) return; // Backspace, Delete, arrows, Tab, etc. are always allowed

    const input = event.target as HTMLInputElement;
    const value = input.value ?? '';
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    if (start !== end) return; // replacing a selection is always allowed

    if (event.key === '.') {
      if (!allowDecimal || value.includes('.')) event.preventDefault();
      return;
    }

    if (!/^[0-9]$/.test(event.key)) return;

    const dotIndex = value.indexOf('.');
    const isBeforeDecimal = dotIndex === -1 || start <= dotIndex;
    if (isBeforeDecimal) {
      const intDigits = dotIndex === -1 ? value.length : dotIndex;
      if (intDigits >= maxIntDigits) event.preventDefault();
    } else {
      const decDigits = value.length - dotIndex - 1;
      if (decDigits >= maxDecimals) event.preventDefault();
    }
  }

  /** Blocks a paste that would push a field past its digit limit, rather than truncating it. */
  onDigitPaste(event: ClipboardEvent, maxIntDigits: number, allowDecimal = false, maxDecimals = 0): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    const pattern = allowDecimal
      ? new RegExp(`^\\d{1,${maxIntDigits}}(\\.\\d{1,${maxDecimals}})?$`)
      : new RegExp(`^\\d{1,${maxIntDigits}}$`);
    if (!pattern.test(pasted)) {
      event.preventDefault();
    }
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

    const validationErrors = [...this.validatePairs(), ...this.validateVitals()];
    if (validationErrors.length > 0) {
      this.toast.show(validationErrors.join(' '), 'error', 2500 + validationErrors.length * 1200);
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
