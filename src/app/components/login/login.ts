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

  onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.showError.set(false);

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
