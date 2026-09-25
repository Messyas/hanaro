import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Relatórios',
    loadComponent: () => import('./reports-page').then((module) => module.ReportsPage),
  },
  {
    path: ':reportId',
    title: 'Relatório de Scrap',
    loadComponent: () => import('./reports-page').then((module) => module.ReportsPage),
  },
];
