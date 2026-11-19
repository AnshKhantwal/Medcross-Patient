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

  /** Gentle, non-blocking flag when a value falls outside the plausible clinical range. */
  outOfRange(value: number | null, min: number, max: number): boolean {
    return value !== null && value !== undefined && (value < min || value > max);
  }

  /**
   * Hard limits matching the API's plausibility check, in on-screen order. Every field is
   * mandatory except height in inches: a whole number of feet (e.g. 5'0") is a complete height.
   * Temperature's API bounds are exclusive (80 < t < 115), so it's checked separately.
   */
  private readonly fieldRules: Array<{ key: keyof VitalData; min: number; max: number; unit: string; required: boolean }> = [
    { key: 'bpSystolic', min: 41, max: 299, unit: 'mmHg', required: true },
    { key: 'bpDiastolic', min: 21, max: 199, unit: 'mmHg', required: true },
    { key: 'pulse', min: 1, max: 299, unit: 'bpm', required: true },
    { key: 'spo2', min: 1, max: 100, unit: '%', required: true },
    { key: 'temperature', min: 80, max: 115, unit: '°F', required: true },
    { key: 'respiratoryRate', min: 1, max: 99, unit: 'breaths/min', required: true },
    { key: 'weight', min: 1, max: 399, unit: 'kg', required: true },
    { key: 'heightFeet', min: 1, max: 8, unit: 'ft', required: true },
    { key: 'heightInches', min: 0, max: 11, unit: 'in', required: false }
  ];

  /** Set on the first submit attempt; errors stay hidden until then so half-typed values aren't flagged. */
  submitAttempted = signal(false);

  private errorFor(key: keyof VitalData): string | null {
    const rule = this.fieldRules.find((r) => r.key === key)!;
    const value = this.vitals[key];
    if (value === null || value === undefined) {
      return rule.required ? 'Required' : null;
    }
    const outside = key === 'temperature'
      ? value <= rule.min || value >= rule.max
      : value < rule.min || value > rule.max;
    return outside ? `Must be between ${rule.min} and ${rule.max} ${rule.unit}` : null;
  }

  /** The message shown under a field, or null when it's valid or the user hasn't tried to submit yet. */
  fieldError(key: keyof VitalData): string | null {
    return this.submitAttempted() ? this.errorFor(key) : null;
  }

  /** Messages for a grouped field (BP, height), each prefixed with which box it refers to. */
  groupErrors(parts: Array<[keyof VitalData, string]>): string[] {
    return parts
      .map(([key, name]) => {
        const err = this.fieldError(key);
        return err ? `${name}: ${err === 'Required' ? 'required' : err.charAt(0).toLowerCase() + err.slice(1)}` : null;
      })
      .filter((m): m is string => m !== null);
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

    this.submitAttempted.set(true);
    const invalid = this.fieldRules.filter((r) => this.errorFor(r.key) !== null).map((r) => r.key);
    if (invalid.length > 0) {
      this.toast.show(
        invalid.length === 1 ? 'Please fix the highlighted field.' : `Please fix the ${invalid.length} highlighted fields.`,
        'error',
        4000
      );
      // Wait for the error styles to render, then bring the first problem into view (it may be
      // off-screen on a phone) and put the cursor in it.
      setTimeout(() => {
        const first = document.querySelector<HTMLInputElement>(`input[name="${invalid[0]}"]`);
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        first?.focus({ preventScroll: true });
      });
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
    this.submitAttempted.set(false);
    this.selectedDate.set(null);
    this.step.set('calendar');
  }
}
