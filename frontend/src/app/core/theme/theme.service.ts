import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  PLATFORM_ID,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly mediaQuery = this.createMediaQuery();
  private readonly storageKey = this.readStorageKey();
  private appliedTheme: ResolvedTheme | null = null;

  readonly systemTheme = signal<ResolvedTheme>(this.readInitialTheme());
  readonly preference = signal<ThemePreference>(this.readPreference());
  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    return preference === 'system' ? this.systemTheme() : preference;
  });
  readonly isDark = computed(() => this.resolvedTheme() === 'dark');
  readonly followsSystem = computed(() => this.preference() === 'system');

  constructor() {
    const onSystemThemeChange = (event: MediaQueryListEvent) => {
      this.systemTheme.set(event.matches ? 'dark' : 'light');
    };

    this.mediaQuery?.addEventListener('change', onSystemThemeChange);
    this.destroyRef.onDestroy(() =>
      this.mediaQuery?.removeEventListener('change', onSystemThemeChange),
    );

    effect(() => {
      const theme = this.resolvedTheme();
      const preference = this.preference();

      if (this.isBrowser) {
        const root = this.document.documentElement;
        const themeChanged = this.appliedTheme !== null && this.appliedTheme !== theme;
        if (themeChanged) root.classList.add('theme-changing');
        root.dataset['theme'] = theme;
        root.dataset['themePreference'] = preference;
        root.style.colorScheme = theme;
        this.appliedTheme = theme;

        if (themeChanged) this.removeTransitionBlocker(root);

        try {
          localStorage.setItem(this.storageKey, preference);
        } catch {
          // O tema continua funcionando mesmo se o armazenamento estiver bloqueado.
        }
      }
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
  }

  setDarkMode(enabled: boolean): void {
    this.setPreference(enabled ? 'dark' : 'light');
  }

  followSystem(enabled: boolean): void {
    this.setPreference(enabled ? 'system' : this.resolvedTheme());
  }

  private readPreference(): ThemePreference {
    if (!this.isBrowser) return 'system';

    const bootstrapped = this.document.documentElement.dataset['themePreference'] ?? null;
    if (this.isThemePreference(bootstrapped)) return bootstrapped;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (this.isThemePreference(stored)) return stored;
    } catch {
      // O modo do sistema é um fallback seguro para navegadores restritos.
    }

    return 'system';
  }

  private readInitialTheme(): ResolvedTheme {
    if (this.isBrowser) {
      const root = this.document.documentElement;
      const preference = root.dataset['themePreference'];
      const bootstrapped = root.dataset['theme'];
      if (preference === 'system' && (bootstrapped === 'light' || bootstrapped === 'dark')) {
        return bootstrapped;
      }
    }

    return this.mediaQuery?.matches ? 'dark' : 'light';
  }

  private readStorageKey(): string {
    return (
      this.document.documentElement?.dataset?.['themeStorageKey']?.trim() || 'app-theme-preference'
    );
  }

  private createMediaQuery(): MediaQueryList | null {
    if (!this.isBrowser || typeof window.matchMedia !== 'function') return null;

    try {
      return window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return null;
    }
  }

  private isThemePreference(value: string | null): value is ThemePreference {
    return value === 'light' || value === 'dark' || value === 'system';
  }

  private removeTransitionBlocker(root: HTMLElement): void {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => root.classList.remove('theme-changing'));
    });
  }
}
