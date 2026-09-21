import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { DashboardShell } from './layouts/dashboard-shell/dashboard-shell';
import { LanguageService } from './i18n/language.service';
import { ThemeService } from './theme/theme.service';

describe('App', () => {
  beforeEach(async () => {
    document.documentElement.setAttribute('lang', 'pt');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-theme-preference', 'system');
    document.documentElement.setAttribute('data-theme-storage-key', 'hanaro-theme-preference');
    document.documentElement.classList.remove('theme-changing');
    localStorage.removeItem('hanaro-theme-preference');
    localStorage.removeItem('hanaro-language-preference');

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });

    await TestBed.configureTestingModule({
      imports: [App, DashboardShell],
      providers: [provideHttpClient(), provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the routed application', () => {
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });

  it('should expose Login separately and Dashboard, Reports, Settings and Profile inside the shell', () => {
    const shellRoute = routes.find((route) => route.children);
    const childPaths = shellRoute?.children?.map((route) => route.path);

    expect(routes.some((route) => route.path === 'login')).toBe(true);
    expect(childPaths).toEqual([
      'dashboard',
      'execucoes',
      'base-de-scrap',
      'base-de-scrap/revisao/:occurrenceId',
      'relatorios',
      'relatorios/:reportId',
      'configuracoes',
      'alertas',
      'planos-de-acao',
      'planos-de-acao/:planId',
      'perfil',
      'usuarios',
      '',
      '**',
    ]);
  });

  it('should update sidebar and breadcrumb labels when the runtime language changes', () => {
    TestBed.inject(AuthService).clearSession();
    const shell = TestBed.createComponent(DashboardShell).componentInstance;
    const language = TestBed.inject(LanguageService);

    language.setLanguage('en');
    expect(shell.navigation().map((item) => item.label)).toEqual([
      'Dashboard',
      'Executions',
      'Scrap Base',
      'Reports',
      'Alerts',
      'Action plans',
      'Settings',
      'Profile',
    ]);

    language.setLanguage('ko');
    expect(shell.navigation().map((item) => item.label)).toEqual(
      expect.arrayContaining([
        language.translations().navScrapBase,
        '대시보드',
        '실행 내역',
        '보고서',
        '설정',
        '프로필',
      ]),
    );
  });

  it('should apply and persist the dark theme without keeping the transition blocker', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const theme = TestBed.inject(ThemeService);
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });

    theme.setPreference('dark');
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('hanaro-theme-preference')).toBe('dark');
    expect(document.documentElement.classList.contains('theme-changing')).toBe(false);
    requestAnimationFrame.mockRestore();
  });
});
