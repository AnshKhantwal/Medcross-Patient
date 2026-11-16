import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { Component, signal } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { environment } from '../../../environments/environment';

interface PatientProfile {
  patientId: number;
  name: string;
  phone: string | null;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class ProfileComponent {
  toast = inject(ToastService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private router = inject(Router);

  avatarUrl = this.authService.getAvatar();

  user = signal({ patientId: 0, name: '', phone: '' });
  loaded = signal(false);

  constructor() {
    this.http.get<PatientProfile>(`${environment.apiBaseUrl}/api/patient/me`).subscribe({
      next: (profile) => {
        this.user.set({ patientId: profile.patientId, name: profile.name, phone: profile.phone ?? '' });
        this.loaded.set(true);
      },
      error: () => this.toast.show('Could not load profile.', 'error')
    });
  }

  goToChangePassword() {
    this.router.navigate(['/change-password']);
  }

  logout() {
    this.authService.logout();
  }
}
