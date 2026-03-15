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

  constructor(private authService: AuthService, private router: Router) {
    // Redirect if already logged in
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit(): void {
    const success = this.authService.login(this.patientNumber(), this.password());
    if (success) {
      this.showError.set(false);
      this.router.navigate(['/dashboard']);
    } else {
      this.showError.set(true);
    }
  }
}
