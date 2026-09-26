import { Routes } from '@angular/router';
import { ScrapListStore } from './list/scrap-list.store';
import { ScrapTemplateStore } from './templates/scrap-template.store';

export const SCRAP_BASE_ROUTES: Routes = [
  // Stores belong to each route injector and are shared with its child components.
  {
    path: '',
    providers: [ScrapListStore, ScrapTemplateStore],
    title: 'Base de Scrap',
    loadComponent: () => import('./scrap-base-page').then((module) => module.ScrapBasePage),
  },
  {
    path: 'revisao/:occurrenceId',
    providers: [ScrapListStore, ScrapTemplateStore],
    title: 'Análise de Scrap',
    loadComponent: () => import('./scrap-base-page').then((module) => module.ScrapBasePage),
  },
];
