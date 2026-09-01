import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIf],
})
export class ChangePasswordComponent {
  constructor(private router: Router) {}
  toast = inject(ToastService);
  private authService = inject(AuthService);

  isSubmitting = signal(false);

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  showCurrent = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);

  toggleShowCurrent(): void {
    this.showCurrent.update(v => !v);
  }

  toggleShowNew(): void {
    this.showNew.update(v => !v);
  }

  toggleShowConfirm(): void {
    this.showConfirm.update(v => !v);
  }

  form = new FormGroup({
    currentPassword: new FormControl('', [Validators.required]),
    newPassword: new FormControl('', [Validators.required, Validators.minLength(8)]),
    confirmPassword: new FormControl('', [Validators.required]),
  });

  // Plain method, not a computed(): the reactive form's validity and control
  // values aren't signals, so a computed() would cache the initial (invalid)
  // result and never update as the user types. Re-evaluated on each change
  // detection pass instead.
  isValid(): boolean {
    return this.form.valid && this.passwordsMatch();
  }

  passwordsMatch(): boolean {
    return this.form.controls.newPassword.value === this.form.controls.confirmPassword.value;
  }

  changePassword() {
    if (!this.isValid() || this.isSubmitting()) {
      return;
    }

    const currentPassword = this.form.controls.currentPassword.value ?? '';
    const newPassword = this.form.controls.newPassword.value ?? '';

    this.isSubmitting.set(true);
    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toast.show('Password changed!', 'success');
        this.form.reset();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const message = err?.error?.error ?? 'Could not change password. Please try again.';
        this.toast.show(message, 'error');
      }
    });
  }
}
