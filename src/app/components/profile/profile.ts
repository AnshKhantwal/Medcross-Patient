import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { Component, signal, computed, ElementRef, ViewChild } from '@angular/core';
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

  // dbo.Patient has no email column -- name/phone come from the CPS record and are
  // effectively read-only here; there is no profile-update endpoint yet.
  user = signal({ name: '', email: '', phone: '' });

  form = new FormGroup({
    name: new FormControl({ value: '', disabled: true }, [Validators.required]),
    email: new FormControl({ value: '', disabled: true }),
    phone: new FormControl({ value: '', disabled: true }, [Validators.required]),
  });

  readonly isDirty = computed(() => this.form.dirty);
  readonly isValid = computed(() => this.form.valid);

  constructor(private router: Router) {
    this.http.get<PatientProfile>(`${environment.apiBaseUrl}/api/patient/me`).subscribe({
      next: (profile) => {
        this.user.set({ name: profile.name, email: '', phone: profile.phone ?? '' });
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

  saveProfile() {
    if (this.form.valid) {
      // TODO: Save profile logic
      this.toast.show('Profile saved!', 'success');
      this.form.markAsPristine();
    }
  }
}
