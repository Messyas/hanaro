import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'alertas', renderMode: RenderMode.Client },
  { path: 'planos-de-acao', renderMode: RenderMode.Client },
  { path: 'planos-de-acao/:planId', renderMode: RenderMode.Client },
  {
    path: 'execucoes',
    renderMode: RenderMode.Client,
  },
  {
    path: 'base-de-scrap',
    renderMode: RenderMode.Client,
  },
  {
    path: 'base-de-scrap/revisao/:occurrenceId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'relatorios',
    renderMode: RenderMode.Client,
  },
  {
    path: 'relatorios/:occurrenceId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'perfil',
    renderMode: RenderMode.Client,
  },
  {
    path: 'configuracoes',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
