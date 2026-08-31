import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { Component, signal, ElementRef, ViewChild } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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
  imports: [ReactiveFormsModule, NgIf],
})
export class ProfileComponent {
  toast = inject(ToastService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  avatarUrl = this.authService.getAvatar();

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  goToChangePassword() {
    this.router.navigate(['/change-password']);
  }

  user = signal({ name: '', phone: '' });

  form = new FormGroup({
    name: new FormControl('', [Validators.required]),
    phone: new FormControl('', [Validators.required, Validators.pattern(/^[\d\s+()-]{6,}$/)]),
  });

  constructor(private router: Router) {
    this.http.get<PatientProfile>(`${environment.apiBaseUrl}/api/patient/me`).subscribe({
      next: (profile) => {
        this.user.set({ name: profile.name, phone: profile.phone ?? '' });
        this.form.patchValue({ name: profile.name, phone: profile.phone ?? '' });
      },
      error: () => this.toast.show('Could not load profile.', 'error')
    });
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.toast.show('Please choose an image file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.authService.setAvatar(reader.result as string);
      this.toast.show('Profile photo updated!', 'success');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeAvatar(): void {
    this.authService.setAvatar(null);
  }

  saving = signal(false);

  saveProfile() {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const payload = {
      name: this.form.controls.name.value?.trim() ?? '',
      phone: this.form.controls.phone.value?.trim() ?? '',
    };

    this.saving.set(true);
    this.http.put<PatientProfile>(`${environment.apiBaseUrl}/api/patient/me`, payload).subscribe({
      next: (profile) => {
        this.saving.set(false);
        this.user.set({ name: profile.name, phone: profile.phone ?? '' });
        this.form.patchValue({ name: profile.name, phone: profile.phone ?? '' });
        this.form.markAsPristine();
        this.toast.show('Profile updated. Use your new phone number next time you log in.', 'success');
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.show(err?.error?.error ?? 'Could not save profile.', 'error');
      },
    });
  }
}
