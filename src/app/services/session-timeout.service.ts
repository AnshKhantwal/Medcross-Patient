import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'wheel'];
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;
const CHECK_INTERVAL_MS = 15_000;

/**
 * Signs the patient out after 15 minutes without interaction, or as soon as the access token
 * expires. Listeners and the timer run outside Angular so mouse movement doesn't trigger change
 * detection.
 */
@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private zone = inject(NgZone);
  private lastWrite = 0;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;

    this.zone.runOutsideAngular(() => {
      const onActivity = () => {
        if (!this.auth.getToken()) return;
        // A tab that was idle past the limit must not revive the session on the next mouse move.
        if (this.auth.isIdleExpired()) {
          this.check();
          return;
        }
        const now = Date.now();
        if (now - this.lastWrite >= ACTIVITY_WRITE_THROTTLE_MS) {
          this.lastWrite = now;
          this.auth.recordActivity();
        }
      };

      for (const type of ACTIVITY_EVENTS) {
        document.addEventListener(type, onActivity, { passive: true, capture: true });
      }

      // Background tabs throttle timers, so re-check the moment the tab is shown again.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.check();
      });

      // Another tab signing out removes the token; follow it to the login screen.
      window.addEventListener('storage', (e) => {
        if (e.key === null || (e.key === 'medcross_token' && e.newValue === null)) this.check();
      });

      setInterval(() => this.check(), CHECK_INTERVAL_MS);
    });
  }

  private check(): void {
    const onLogin = this.router.url.startsWith('/login');
    if (!this.auth.getToken()) {
      if (!onLogin) this.zone.run(() => this.router.navigate(['/login']));
      return;
    }

    const idle = this.auth.isIdleExpired();
    if (!idle && this.auth.isTokenValid()) return;

    this.zone.run(() => {
      this.auth.logout();
      this.toast.show(
        idle
          ? 'You were signed out after 15 minutes of inactivity.'
          : 'Your session has expired. Please sign in again.',
        'info',
        5000
      );
    });
  }
}
