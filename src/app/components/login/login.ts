import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  patientNumber = signal('');
  password = signal('');
  showError = signal(false);
  formatError = signal(false);
  showPassword = signal(false);
  isSubmitting = signal(false);

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  constructor(private authService: AuthService, private router: Router) {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  /** Rejects any non-digit insertion (typing, mobile IME, drag-drop) before it reaches the field. */
  onPatientNumberBeforeInput(event: InputEvent): void {
    if (event.inputType.startsWith('insert') && event.data && !/^\d+$/.test(event.data)) {
      event.preventDefault();
    }
  }

  /** Blocks a paste containing anything but digits rather than stripping it. */
  onPatientNumberPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (!/^\d+$/.test(pasted)) {
      event.preventDefault();
    }
  }

  onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (!/^\d+$/.test(this.patientNumber())) {
      this.formatError.set(true);
      this.showError.set(false);
      return;
    }

    this.isSubmitting.set(true);
    this.showError.set(false);
    this.formatError.set(false);

    this.authService.login(this.patientNumber(), this.password()).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.router.navigate([res.mustChangePassword ? '/change-password' : '/dashboard']);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.showError.set(true);
      }
    });
  }
}
