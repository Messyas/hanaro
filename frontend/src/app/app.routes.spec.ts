import { routes } from './app.routes';
import { adminScopeGuard, authenticatedGuard, superuserGuard } from './core/auth/auth.guard';

describe('application route access policy', () => {
  const children = routes.find((r) => r.children?.length)?.children ?? [];

  it('guards every non-public application route', () => {
    for (const path of ['execucoes', 'base-de-scrap', 'relatorios', 'perfil']) {
      const route = children.find((candidate) => candidate.path === path);
      expect(route?.canActivate).toContain(authenticatedGuard);
    }
    const reports = children.find((candidate) => candidate.path === 'relatorios');
    expect(reports?.canActivateChild).toContain(authenticatedGuard);
    expect(reports?.children?.find((candidate) => candidate.path === ':reportId')).toBeDefined();
  });

  it('keeps only the dashboard and Preferences intentionally public', () => {
    expect(children.find((candidate) => candidate.path === 'dashboard')?.canActivate).toContain(
      adminScopeGuard,
    );
    expect(children.find((candidate) => candidate.path === 'configuracoes')?.canActivate).toContain(
      adminScopeGuard,
    );
  });

  it('restricts user management to superusers', () => {
    expect(children.find((candidate) => candidate.path === 'usuarios')?.canActivate).toContain(
      superuserGuard,
    );
  });

  it('redirects developer administrators away from every page outside their scope', () => {
    for (const path of [
      'dashboard',
      'base-de-scrap',
      'base-de-scrap/revisao/:occurrenceId',
      'configuracoes',
      'alertas',
      'planos-de-acao',
      'planos-de-acao/:planId',
    ]) {
      expect(children.find((candidate) => candidate.path === path)?.canActivate).toContain(
        adminScopeGuard,
      );
    }
    expect(
      children
        .find((candidate) => candidate.path === 'relatorios')
        ?.children?.find((candidate) => candidate.path === ':reportId')?.path,
    ).toBe(':reportId');
  });

  it('redirects unknown client routes to the public dashboard shell', () => {
    expect(children.find((candidate) => candidate.path === '**')?.redirectTo).toBe('dashboard');
  });
});
