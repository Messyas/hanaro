import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    title: 'Perfil',
    loadComponent: () => import('./profile-page').then((module) => module.ProfilePage),
  },
];
