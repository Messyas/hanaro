import { Routes } from '@angular/router';

export const ACTION_PLANS_ROUTES: Routes = [
  {
    path: '',
    title: 'Planos de Ação',
    loadComponent: () => import('./action-plans').then((module) => module.ActionPlans),
  },
  {
    path: ':planId',
    title: 'Plano de Ação',
    loadComponent: () => import('./action-plans').then((module) => module.ActionPlans),
  },
];
