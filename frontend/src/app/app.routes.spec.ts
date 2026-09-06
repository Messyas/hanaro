import { routes } from './app.routes';
import { authenticatedGuard } from './core/auth/auth.guard';

describe('application route access policy', () => {
  const children = routes[0].children ?? [];

  it('guards every non-public application route', () => {
    for (const path of ['execucoes', 'base-de-scrap', 'relatorios', 'perfil']) {
      const route = children.find((candidate) => candidate.path === path);
      expect(route?.canActivate).toContain(authenticatedGuard);
    }
  });

  it('keeps only the dashboard and Preferences intentionally public', () => {
    expect(
      children.find((candidate) => candidate.path === 'dashboard')?.canActivate,
    ).toBeUndefined();
    expect(
      children.find((candidate) => candidate.path === 'configuracoes')?.canActivate,
    ).toBeUndefined();
  });

  it('redirects unknown client routes to the public dashboard shell', () => {
    expect(children.find((candidate) => candidate.path === '**')?.redirectTo).toBe('dashboard');
  });
});
