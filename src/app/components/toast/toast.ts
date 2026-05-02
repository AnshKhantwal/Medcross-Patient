import { Component, signal, computed, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [NgIf],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
})
export class ToastComponent {
  toastService = inject(ToastService);
  toast = this.toastService.toast;
}
