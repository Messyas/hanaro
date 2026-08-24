import { Routes } from '@angular/router';
import { authenticatedGuard } from './core/auth/auth.guard';
import { DashboardShell } from './layouts/dashboard-shell/dashboard-shell';

export const routes: Routes = [
  {
    path: '',
    component: DashboardShell,
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard-page').then((module) => module.DashboardPage),
      },
      {
        path: 'relatorios',
        title: 'Relatórios',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./pages/reports/reports-page').then((module) => module.ReportsPage),
      },
      {
        path: 'configuracoes',
        title: 'Configurações',
        loadComponent: () =>
          import('./pages/settings/settings-page').then((module) => module.SettingsPage),
      },
      {
        path: 'perfil',
        title: 'Perfil',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./pages/profile/profile-page').then((module) => module.ProfilePage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
