import { Routes } from '@angular/router';

export const EXECUTIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./executions-page').then((module) => module.ExecutionsPage),
  },
];
