import { Routes } from '@angular/router';

export const SCRAP_BASE_ROUTES: Routes = [
  {
    path: '',
    title: 'Base de Scrap',
    loadComponent: () => import('./scrap-base-page').then((module) => module.ScrapBasePage),
  },
  {
    path: 'revisao/:occurrenceId',
    title: 'Análise de Scrap',
    loadComponent: () => import('./scrap-base-page').then((module) => module.ScrapBasePage),
  },
];
