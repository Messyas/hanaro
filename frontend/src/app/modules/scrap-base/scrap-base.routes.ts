import { Routes } from '@angular/router';
import { ScrapTemplateStore } from './scrap-template.store';

export const SCRAP_BASE_ROUTES: Routes = [
  {
    path: '',
    providers: [ScrapTemplateStore],
    title: 'Base de Scrap',
    loadComponent: () => import('./scrap-base-page').then((module) => module.ScrapBasePage),
  },
  {
    path: 'revisao/:occurrenceId',
    providers: [ScrapTemplateStore],
    title: 'Análise de Scrap',
    loadComponent: () => import('./scrap-base-page').then((module) => module.ScrapBasePage),
  },
];
