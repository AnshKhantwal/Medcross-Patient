import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';
import { Component, signal, computed } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIf],
})
export class ProfileComponent {
  constructor(private router: Router) {}
  toast = inject(ToastService);
    goBack() {
      this.router.navigate(['/dashboard']);
    }
  // Simulated user data (replace with real data/service)
  user = signal({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 555-123-4567',
  });

  form = new FormGroup({
    name: new FormControl(this.user().name, [Validators.required]),
    email: new FormControl(this.user().email, [Validators.required, Validators.email]),
    phone: new FormControl(this.user().phone, [Validators.required]),
  });

  readonly isDirty = computed(() => this.form.dirty);
  readonly isValid = computed(() => this.form.valid);

  saveProfile() {
    if (this.form.valid) {
      // TODO: Save profile logic
      this.toast.show('Profile saved!', 'success');
      this.form.markAsPristine();
    }
  }
}
