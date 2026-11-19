import { Component } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SessionTimeoutService } from './services/session-timeout.service';
import { ToastComponent } from './components/toast/toast';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  template: '<router-outlet></router-outlet><app-toast></app-toast>',
  styles: []
})
export class App {
  constructor(router: Router, sessionTimeout: SessionTimeoutService) {
    sessionTimeout.start();
    router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

