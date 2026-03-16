import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./components/layout/layout').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./components/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'vitals',
        loadComponent: () => import('./components/vitals/vitals').then(m => m.VitalsComponent)
      },
      {
        path: 'tasks',
        loadComponent: () => import('./components/tasks/tasks').then(m => m.TasksComponent)
      },
      {
        path: 'history',
        loadComponent: () => import('./components/history/history').then(m => m.HistoryComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
