import { Routes } from '@angular/router';

export const ALERTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Alertas',
    loadComponent: () => import('./alerts').then((module) => module.Alerts),
  },
];
