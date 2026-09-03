import { RenderMode } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

describe('serverRoutes', () => {
  it('client-renders authenticated settings instead of prerendering API-backed content', () => {
    expect(serverRoutes).toContainEqual({
      path: 'configuracoes',
      renderMode: RenderMode.Client,
    });
  });
});
