import {
  DestroyRef,
  Component,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { CdkMenuModule } from '@angular/cdk/menu';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';
import { UiIcon, IconName } from '../../ui-icon';
import { LanguageService } from '../../i18n/language.service';
import { ThemeService } from '../../theme/theme.service';
import { BRAND_CONFIG } from '../../theme/brand.config';
import { AuthService } from '../../core/auth/auth.service';
import { LoginDialog } from './login-dialog';
import { LogoutConfirmDialog } from './logout-confirm-dialog';
import { ShellStatusService } from '../../core/shell/shell-status.service';

interface NavigationItem {
  icon: IconName;
  breadcrumbIcon?: IconName;
  label: string;
  path: string;
  children?: readonly NavigationItem[];
  requiresAuthentication?: boolean;
  visibleInSidebar?: boolean;
}

@Component({
  selector: 'app-dashboard-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CdkMenuModule,
    DialogModule,
    NgOptimizedImage,
    UiIcon,
  ],
  host: {
    '(document:keydown.escape)': 'closeMobileSidebar()',
  },
  templateUrl: './dashboard-shell.html',
})
export class DashboardShell {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly language = inject(LanguageService);
  readonly dashboardStatus = inject(ShellStatusService);
  readonly brand = BRAND_CONFIG;
  readonly sidebarOpen = signal(true);
  readonly isMobile = signal(false);
  readonly signingOut = signal(false);
  readonly avatarFailed = signal(false);
  readonly brandLogoSrc = computed(() => {
    if (!this.sidebarOpen() && !this.isMobile()) {
      return this.theme.isDark()
        ? 'collapsed_sidebar/dark-theme/logo-sem-dark.svg'
        : 'collapsed_sidebar/light-theme/logo-sem-light.svg';
    }

    if (this.language.isKorean()) {
      return this.theme.isDark()
        ? 'korean/dark-theme/Horizontal-Dark-hanaro-korean.svg'
        : 'korean/light-theme/horizontal-light-lg-red-korean.svg';
    }

    return this.theme.isDark()
      ? 'english/dark-theme/Horizontal-light-hanaro-red.svg'
      : 'english/light-theme/Horizontal-Dark-lg-red.svg';
  });
  readonly profileMenuPosition: ConnectedPosition[] = [
    {
      originX: 'end',
      originY: 'top',
      overlayX: 'end',
      overlayY: 'bottom',
      offsetY: -8,
    },
  ];
  readonly navigation = computed<readonly NavigationItem[]>(() => {
    const t = this.language.translations();
    if (this.auth.status() === 'checking') return [];

    const isDeveloperAdmin =
      this.auth.user()?.role === 'admin' || this.auth.user()?.is_superuser === true;
    if (isDeveloperAdmin) {
      return [
        {
          path: '/execucoes',
          icon: 'clock',
          label: t.navExecutions,
          requiresAuthentication: true,
        },
        {
          path: '/usuarios',
          icon: 'users',
          label:
            this.language.currentLanguage() === 'en'
              ? 'Users'
              : this.language.currentLanguage() === 'ko'
                ? '사용자'
                : 'Usuários',
          requiresAuthentication: true,
        },
        {
          path: '/perfil',
          icon: 'users',
          label: t.navProfile,
          requiresAuthentication: true,
        },
      ];
    }
    return [
      {
        path: '/dashboard',
        icon: 'chart-columns',
        label: t.navDashboard,
      },
      {
        path: '/execucoes',
        icon: 'clock',
        label: t.navExecutions,
        requiresAuthentication: true,
      },
      {
        path: '/base-de-scrap',
        icon: 'folder',
        label: t.navScrapBase,
        requiresAuthentication: true,
      },
      {
        path: '/relatorios',
        icon: 'chart-bar',
        label: t.navReports,
        requiresAuthentication: true,
      },
      {
        path: '/alertas',
        icon: 'clock',
        label:
          this.language.currentLanguage() === 'pt'
            ? 'Alertas'
            : this.language.currentLanguage() === 'ko'
              ? '알림'
              : 'Alerts',
        requiresAuthentication: true,
      },
      {
        path: '/planos-de-acao',
        icon: 'folder',
        label:
          this.language.currentLanguage() === 'pt'
            ? 'Planos de ação'
            : this.language.currentLanguage() === 'ko'
              ? '실행 계획'
              : 'Action plans',
        requiresAuthentication: true,
      },
      {
        path: '/configuracoes',
        icon: 'cog',
        label: t.navSettings,
      },
      ...(this.auth.user()?.is_superuser
        ? [
            {
              path: '/usuarios',
              icon: 'users' as IconName,
              label:
                this.language.currentLanguage() === 'en'
                  ? 'Users'
                  : this.language.currentLanguage() === 'ko'
                    ? '사용자'
                    : 'Usuários',
              requiresAuthentication: true,
            },
          ]
        : []),
      {
        path: '/perfil',
        icon: 'users',
        label: t.navProfile,
        requiresAuthentication: true,
        visibleInSidebar: false,
      },
    ];
  });

  constructor() {
    effect(() => {
      // Uma nova URL representa outra versão da foto. Libera o fallback para
      // que a identidade expandida e a compacta tentem renderizá-la novamente.
      this.auth.user()?.profile_image_url;
      this.avatarFailed.set(false);
    });

    afterNextRender(() => {
      // A sessão pertence ao navegador (cookie HttpOnly). O SSR sempre entrega o
      // shell público e só confirmamos a identidade depois da hidratação.
      this.auth.ensureSessionChecked().subscribe();

      const media = window.matchMedia('(max-width: 760px)');
      const syncLayout = () => {
        this.isMobile.set(media.matches);
        this.sidebarOpen.set(!media.matches);
      };
      syncLayout();
      media.addEventListener('change', syncLayout);
      this.destroyRef.onDestroy(() => media.removeEventListener('change', syncLayout));
    });
  }

  closeMobileSidebar(): void {
    if (this.isMobile() && this.sidebarOpen()) this.sidebarOpen.set(false);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebarOnMobile(): void {
    if (this.isMobile()) this.sidebarOpen.set(false);
  }

  signOut(): void {
    if (this.signingOut()) return;

    this.signingOut.set(true);
    this.auth
      .logout()
      .pipe(finalize(() => this.signingOut.set(false)))
      .subscribe({
        next: () => this.finishSignOut(),
        error: (error: { status?: number }) => {
          if (error.status === 401) this.finishSignOut();
        },
      });
  }

  openLoginDialog(): void {
    this.dialog
      .open<boolean>(LoginDialog, {
        ariaLabelledBy: 'login-dialog-title',
        ariaModal: true,
        autoFocus: '#dialog-username',
        backdropClass: 'logout-confirm-dialog-backdrop',
        maxWidth: 'calc(100vw - 2rem)',
        panelClass: 'login-dialog-panel',
        restoreFocus: true,
        width: '32rem',
      })
      .closed.subscribe((authenticated) => {
        if (authenticated) this.avatarFailed.set(false);
      });
  }

  openSignOutDialog(): void {
    if (this.signingOut()) return;

    this.dialog
      .open<boolean>(LogoutConfirmDialog, {
        ariaDescribedBy: 'logout-confirm-description',
        ariaLabelledBy: 'logout-confirm-title',
        ariaModal: true,
        autoFocus: 'dialog',
        backdropClass: 'logout-confirm-dialog-backdrop',
        maxWidth: 'calc(100vw - 2rem)',
        panelClass: 'logout-confirm-dialog-panel',
        restoreFocus: true,
        width: '42rem',
      })
      .closed.subscribe((confirmed) => {
        if (confirmed) this.signOut();
      });
  }

  currentBreadcrumbs(): readonly NavigationItem[] {
    const currentPath = this.router.url.split(/[?#]/, 1)[0];
    const navigation = this.navigation();
    return (
      this.findNavigationTrail(navigation, currentPath) ??
      (navigation.length ? [navigation[0]] : [])
    );
  }

  breadcrumbIcon(item: NavigationItem): IconName {
    return item.breadcrumbIcon ?? item.icon;
  }

  userDisplayName(): string {
    const user = this.auth.user();
    return user?.name || user?.username || '';
  }

  userRole(): string {
    const role = this.auth.user()?.role;
    if (role === 'admin') return 'Admin';
    if (role === 'gestor') return 'Gestor';
    if (role === 'analista') return 'Analista';

    const jobTitle = this.auth.user()?.job_title?.trim();
    if (jobTitle) return jobTitle;

    const t = this.language.translations();
    return this.auth.user()?.is_superuser ? t.administratorRole : t.userRole;
  }

  userInitials(): string {
    const name = this.userDisplayName().trim();
    if (!name) return '?';

    const parts = name.split(/\s+/);
    return `${parts[0][0]}${parts.length > 1 ? parts.at(-1)?.[0] : ''}`.toUpperCase();
  }

  profileImageUrl(): string | null {
    const url = this.auth.user()?.profile_image_url;
    return url && url !== 'https://profileimageurl.com' && url !== 'https://www.profileimageurl.com'
      ? url
      : null;
  }

  loginButtonLabel(): string {
    return this.language.translations().loginButton;
  }

  loginButtonHint(): string {
    return this.language.translations().loginHint;
  }

  private finishSignOut(): void {
    this.auth.clearSession();
    this.avatarFailed.set(false);
    void this.router.navigateByUrl('/dashboard');
  }

  private findNavigationTrail(
    items: readonly NavigationItem[],
    currentPath: string,
  ): readonly NavigationItem[] | undefined {
    for (const item of items) {
      const childTrail = this.findNavigationTrail(item.children ?? [], currentPath);
      if (childTrail) return [item, ...childTrail];
      if (currentPath === item.path || currentPath.startsWith(`${item.path}/`)) return [item];
    }
    return undefined;
  }
}
