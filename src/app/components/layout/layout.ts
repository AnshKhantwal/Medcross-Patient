import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { ToastComponent } from '../toast/toast';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIf, ToastComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class LayoutComponent {
  sidebarOpen = signal(false);
  profileMenuOpen = signal(false);


  constructor(private authService: AuthService, private router: Router) {}

  get patient() {
    return this.authService.getPatient();
  }

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.profileMenuOpen.update(open => !open);
    if (this.profileMenuOpen()) {
      setTimeout(() => {
        window.addEventListener('click', this.closeProfileMenu, { once: true });
      });
    }
  }

  closeProfileMenu = () => {
    this.profileMenuOpen.set(false);
    window.removeEventListener('click', this.closeProfileMenu);
  };


  goToProfile(): void {
    this.closeProfileMenu();
    this.router.navigate(['/profile']);
  }

  changePassword(): void {
    this.closeProfileMenu();
    this.router.navigate(['/change-password']);
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
