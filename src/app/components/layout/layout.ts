import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class LayoutComponent {
  sidebarOpen = signal(false);

  constructor(private authService: AuthService) {}

  get patient() {
    return this.authService.getPatient();
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  logout(): void {
    this.closeSidebar();
    this.authService.logout();
  }
}
