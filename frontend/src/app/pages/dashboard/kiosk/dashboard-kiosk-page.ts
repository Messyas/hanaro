import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '../../../i18n/language.service';
import { ThemeService } from '../../../theme/theme.service';
import { UiIcon } from '../../../ui-icon';
import { DashboardPerformanceChart } from '../../../charts/dashboard-performance-chart';
import {
  ListFilterSelect,
  ListFilterSelectOption,
} from '../../../shared/list-filters/list-filter-select';
import { DashboardKioskStore } from './dashboard-kiosk.store';
import { KIOSK_TRANSLATIONS } from './dashboard-kiosk.translations';

@Component({
  selector: 'app-dashboard-kiosk-page',
  standalone: true,
  imports: [UiIcon, DashboardPerformanceChart, ListFilterSelect],
  providers: [DashboardKioskStore],
  templateUrl: './dashboard-kiosk-page.html',
  styleUrl: './dashboard-kiosk-page.css',
  host: {
    class: 'dashboard-kiosk-root',
    '[attr.data-theme]': 'themeService.resolvedTheme()',
  },
})
export class DashboardKioskPage implements OnDestroy {
  readonly store = inject(DashboardKioskStore);
  readonly language = inject(LanguageService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly doc = inject(DOCUMENT);

  readonly isFullscreen = signal<boolean>(false);
  readonly isDockVisible = signal<boolean>(true);
  private dockTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly currentYear = new Date().getFullYear();
  readonly previousYear = this.currentYear - 1;

  readonly text = computed(() => KIOSK_TRANSLATIONS[this.language.currentLanguage()]);
  readonly locale = computed(() => {
    switch (this.language.currentLanguage()) {
      case 'pt':
        return 'pt-BR';
      case 'ko':
        return 'ko-KR';
      default:
        return 'en-US';
    }
  });

  readonly intervalOptions = [10, 15, 30, 60] as const;

  readonly intervalSelectOptions = computed<readonly ListFilterSelectOption[]>(() => {
    const secSuffix = this.text().seconds;
    return this.intervalOptions.map((sec) => ({
      value: String(sec),
      label: `${sec}${secSuffix}`,
    }));
  });

  readonly currentInterval = computed(() => String(this.store.settings().intervalSeconds));

  onIntervalChange(value: string): void {
    const sec = Number(value);
    if (!Number.isNaN(sec) && sec > 0) {
      this.store.setIntervalSeconds(sec);
    }
  }

  constructor() {
    if (this.isBrowser) {
      this.checkFullscreen();
      this.doc.addEventListener('fullscreenchange', this.onFullscreenChange);
      this.startDockInactivityTimer();
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      this.doc.removeEventListener('fullscreenchange', this.onFullscreenChange);
    }
    this.clearDockTimer();
    this.store.destroy();
  }

  showDock(): void {
    this.isDockVisible.set(true);
    this.startDockInactivityTimer();
  }

  onDockMouseEnter(): void {
    this.isDockVisible.set(true);
    this.clearDockTimer();
  }

  onDockMouseLeave(): void {
    this.startDockInactivityTimer();
  }

  private startDockInactivityTimer(): void {
    this.clearDockTimer();
    if (!this.isBrowser) return;
    this.dockTimeout = setTimeout(() => {
      this.isDockVisible.set(false);
    }, 5000);
  }

  private clearDockTimer(): void {
    if (this.dockTimeout) {
      clearTimeout(this.dockTimeout);
      this.dockTimeout = null;
    }
  }

  private readonly onFullscreenChange = (): void => {
    this.checkFullscreen();
  };

  private checkFullscreen(): void {
    if (!this.isBrowser) return;
    this.isFullscreen.set(Boolean(this.doc.fullscreenElement));
  }

  toggleFullscreen(): void {
    if (!this.isBrowser) return;
    if (!this.doc.fullscreenElement) {
      this.doc.documentElement.requestFullscreen().catch(() => {});
    } else {
      this.doc.exitFullscreen().catch(() => {});
    }
  }

  toggleTheme(): void {
    this.themeService.setDarkMode(!this.themeService.isDark());
  }

  exitKiosk(): void {
    if (this.isBrowser && this.doc.fullscreenElement) {
      this.doc.exitFullscreen().catch(() => {});
    }
    this.router.navigate(['/dashboard']);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Ignore if typing in an input
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;

    this.showDock();

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        this.store.nextSlide();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        this.store.prevSlide();
        break;
      case ' ':
        event.preventDefault();
        this.store.togglePause();
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        this.toggleFullscreen();
        break;
      case 'Escape':
        if (!this.doc.fullscreenElement) {
          this.exitKiosk();
        }
        break;
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat(this.locale(), {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat(this.locale()).format(value);
  }

  formatPercent(value: number): string {
    const formatted = new Intl.NumberFormat(this.locale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Math.abs(value));
    return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatted}%`;
  }
}
