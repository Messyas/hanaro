import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'execucoes',
    renderMode: RenderMode.Client,
  },
  {
    path: 'base-de-scrap',
    renderMode: RenderMode.Client,
  },
  {
    path: 'relatorios',
    renderMode: RenderMode.Client,
  },
  {
    path: 'perfil',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
