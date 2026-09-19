import { Routes } from '@angular/router';
import { adminScopeGuard, authenticatedGuard, superuserGuard } from './core/auth/auth.guard';
import { DashboardShell } from './layouts/dashboard-shell/dashboard-shell';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Login | Hanaro',
    loadComponent: () => import('./pages/login/login-page').then((module) => module.LoginPage),
  },
  {
    path: 'dashboard/kiosk',
    title: 'Modo Kiosk | Hanaro',
    canActivate: [adminScopeGuard],
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
        canActivate: [adminScopeGuard],
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
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadComponent: () =>
          import('./pages/scrap-base/scrap-base-page').then((module) => module.ScrapBasePage),
      },
      {
        path: 'base-de-scrap/revisao/:occurrenceId',
        title: 'Análise de Scrap',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadComponent: () =>
          import('./pages/scrap-base/scrap-base-page').then((module) => module.ScrapBasePage),
      },
      {
        path: 'relatorios',
        title: 'Relatórios',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadComponent: () =>
          import('./pages/reports/reports-page').then((module) => module.ReportsPage),
      },
      {
        path: 'relatorios/:reportId',
        title: 'Relatório de Scrap',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadComponent: () =>
          import('./pages/reports/reports-page').then((module) => module.ReportsPage),
      },
      {
        path: 'configuracoes',
        title: 'Configurações',
        canActivate: [adminScopeGuard],
        loadComponent: () =>
          import('./pages/settings/settings-page').then((module) => module.SettingsPage),
      },
      {
        path: 'alertas',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadComponent: () => import('./pages/alerts/alerts').then((m) => m.Alerts),
      },
      {
        path: 'planos-de-acao',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadComponent: () => import('./pages/action-plans/action-plans').then((m) => m.ActionPlans),
      },
      {
        path: 'planos-de-acao/:planId',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadComponent: () => import('./pages/action-plans/action-plans').then((m) => m.ActionPlans),
      },
      {
        path: 'perfil',
        title: 'Perfil',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./pages/profile/profile-page').then((module) => module.ProfilePage),
      },
      {
        path: 'usuarios',
        title: 'Usuários',
        canActivate: [superuserGuard],
        loadComponent: () => import('./pages/users/users-page').then((module) => module.UsersPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
