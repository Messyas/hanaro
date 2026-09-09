import { Routes } from '@angular/router';
import { authenticatedGuard } from './core/auth/auth.guard';
import { DashboardShell } from './layouts/dashboard-shell/dashboard-shell';

export const routes: Routes = [
  {
    path: 'dashboard/kiosk',
    title: 'Modo Kiosk | Hanaro',
    loadComponent: () =>
      import('./pages/dashboard/kiosk/dashboard-kiosk-page').then(
        (module) => module.DashboardKioskPage,
      ),
  },
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
        path: 'execucoes',
        title: 'Execuções GERP',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./pages/executions/executions-page').then((module) => module.ExecutionsPage),
      },
      {
        path: 'base-de-scrap',
        title: 'Base de Scrap',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./pages/scrap-base/scrap-base-page').then((module) => module.ScrapBasePage),
      },
      {
        path: 'base-de-scrap/revisao/:occurrenceId',
        title: 'Análise de Scrap',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./pages/scrap-base/scrap-base-page').then((module) => module.ScrapBasePage),
      },
      {
        path: 'relatorios',
        title: 'Relatórios',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./pages/reports/reports-page').then((module) => module.ReportsPage),
      },
      {
        path: 'relatorios/:reportId',
        title: 'Relatório de Scrap',
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
