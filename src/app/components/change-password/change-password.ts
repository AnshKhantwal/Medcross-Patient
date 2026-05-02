import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';
import { Component, signal, computed } from '@angular/core';
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
    goBack() {
      this.router.navigate(['/dashboard']);
    }
  form = new FormGroup({
    currentPassword: new FormControl('', [Validators.required]),
    newPassword: new FormControl('', [Validators.required, Validators.minLength(8)]),
    confirmPassword: new FormControl('', [Validators.required]),
  });

  readonly isValid = computed(() => this.form.valid && this.passwordsMatch());

  passwordsMatch() {
    return this.form.controls.newPassword.value === this.form.controls.confirmPassword.value;
  }

  changePassword() {
    if (this.isValid()) {
      // TODO: Change password logic
      this.toast.show('Password changed!', 'success');
      this.form.reset();
    }
  }
}
