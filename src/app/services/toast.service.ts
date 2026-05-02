import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  toast = signal<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false,
  });

  show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 2500) {
    this.toast.set({ message, type, visible: true });
    setTimeout(() => this.hide(), duration);
  }

  hide() {
    this.toast.set({ ...this.toast(), visible: false });
  }
}
