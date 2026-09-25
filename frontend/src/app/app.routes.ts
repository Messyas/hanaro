import { Routes } from '@angular/router';
import { adminScopeGuard, authenticatedGuard, superuserGuard } from './core/auth/auth.guard';
import { DashboardShell } from './layouts/dashboard-shell/dashboard-shell';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Login | Hanaro',
    loadComponent: () => import('./modules/auth/login-page').then((module) => module.LoginPage),
  },
  {
    path: 'dashboard/kiosk',
    title: 'Modo Kiosk | Hanaro',
    canActivate: [adminScopeGuard],
    loadComponent: () =>
      import('./modules/dashboard/kiosk/dashboard-kiosk-page').then(
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
          import('./modules/dashboard/dashboard-page').then((module) => module.DashboardPage),
      },
      {
        path: 'execucoes',
        title: 'Execuções GERP',
        canActivate: [authenticatedGuard],
        loadChildren: () =>
          import('./modules/executions/executions.routes').then(
            (module) => module.EXECUTIONS_ROUTES,
          ),
      },
      {
        path: 'base-de-scrap',
        title: 'Base de Scrap',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadChildren: () =>
          import('./modules/scrap-base/scrap-base.routes').then(
            (module) => module.SCRAP_BASE_ROUTES,
          ),
      },
      {
        path: 'relatorios',
        title: 'Relatórios',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadComponent: () =>
          import('./modules/reports/reports-page').then((module) => module.ReportsPage),
      },
      {
        path: 'relatorios/:reportId',
        title: 'Relatório de Scrap',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadComponent: () =>
          import('./modules/reports/reports-page').then((module) => module.ReportsPage),
      },
      {
        path: 'configuracoes',
        title: 'Configurações',
        canActivate: [adminScopeGuard],
        loadChildren: () =>
          import('./modules/settings/settings.routes').then((module) => module.SETTINGS_ROUTES),
      },
      {
        path: 'alertas',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadChildren: () =>
          import('./modules/alerts/alerts.routes').then((module) => module.ALERTS_ROUTES),
      },
      {
        path: 'planos-de-acao',
        canActivate: [authenticatedGuard, adminScopeGuard],
        loadChildren: () =>
          import('./modules/action-plans/action-plans.routes').then(
            (module) => module.ACTION_PLANS_ROUTES,
          ),
      },
      {
        path: 'perfil',
        title: 'Perfil',
        canActivate: [authenticatedGuard],
        loadChildren: () =>
          import('./modules/profile/profile.routes').then((module) => module.PROFILE_ROUTES),
      },
      {
        path: 'usuarios',
        title: 'Usuários',
        canActivate: [superuserGuard],
        loadComponent: () =>
          import('./modules/users/users-page').then((module) => module.UsersPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
