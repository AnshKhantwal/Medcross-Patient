import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent {
  fabOpen = signal(false);

  currentDate = computed(() => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  });

  constructor(private authService: AuthService, private router: Router) {}

  get patient() {
    return this.authService.getPatient();
  }

  toggleFab(): void {
    this.fabOpen.update(v => !v);
  }

  closeFab(): void {
    this.fabOpen.set(false);
  }

  goToVitals(): void {
    this.closeFab();
    this.router.navigate(['/vitals']);
  }

  goToTasks(): void {
    this.closeFab();
    this.router.navigate(['/tasks']);
  }

  goToHistory(): void {
    this.closeFab();
    this.router.navigate(['/history']);
  }
}
