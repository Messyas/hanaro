import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { DashboardKioskStore } from './dashboard-kiosk.store';
import { DashboardKioskPage } from './dashboard-kiosk-page';
import { LanguageService } from '../../../core/i18n/language.service';

describe('DashboardKioskStore', () => {
  let store: DashboardKioskStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        DashboardKioskStore,
      ],
    });
    store = TestBed.inject(DashboardKioskStore);
    httpMock = TestBed.inject(HttpTestingController);

    // Discard any background init calls
    httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
  });

  afterEach(() => {
    store.destroy();
    localStorage.clear();
  });

  it('initializes with default settings and slide 0', () => {
    expect(store.settings().activeSlide).toBe(0);
    expect(store.settings().autoRotate).toBe(true);
    expect(store.settings().intervalSeconds).toBe(15);
    expect(store.settings().factoryPeriod).toBe('month');
  });

  it('cycles slides correctly with nextSlide and prevSlide', () => {
    expect(store.settings().activeSlide).toBe(0);
    store.nextSlide();
    expect(store.settings().activeSlide).toBe(1);
    store.nextSlide();
    expect(store.settings().activeSlide).toBe(2);
    store.nextSlide();
    expect(store.settings().activeSlide).toBe(3);
    store.nextSlide();
    expect(store.settings().activeSlide).toBe(0);

    store.prevSlide();
    expect(store.settings().activeSlide).toBe(3);
  });

  it('updates settings and persists in localStorage', () => {
    store.setIntervalSeconds(30);
    expect(store.settings().intervalSeconds).toBe(30);

    store.toggleAutoRotate();
    expect(store.settings().autoRotate).toBe(false);

    store.setSlide(2);
    expect(store.settings().activeSlide).toBe(2);

    const saved = JSON.parse(localStorage.getItem('hanaro_kiosk_settings_v1') || '{}');
    expect(saved.intervalSeconds).toBe(30);
    expect(saved.autoRotate).toBe(false);
    expect(saved.activeSlide).toBe(2);
  });

  it('toggles pause state', () => {
    expect(store.isPaused()).toBe(false);
    store.togglePause();
    expect(store.isPaused()).toBe(true);
    store.togglePause();
    expect(store.isPaused()).toBe(false);
  });

  it('updates factory period and requests breakdown', async () => {
    store.setFactoryPeriod('year');
    expect(store.settings().factoryPeriod).toBe('year');

    const req = httpMock.match((r) => r.url.includes('/breakdown'));
    for (const r of req) {
      r.flush([
        { key: 'BM1', metric: 12000, record_count: 5 },
        { key: 'G12', metric: 8000, record_count: 3 },
      ]);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.factoryOccurrencesTotal()).toBe(8);
    expect(store.assemblyLinesRanking().length).toBe(2);
    expect(store.assemblyLinesRanking()[0].line).toBe('BM1');
  });
});

describe('DashboardKioskPage', () => {
  let fixture: any;
  let component: DashboardKioskPage;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DashboardKioskPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        LanguageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardKioskPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    component.language.setLanguage('pt');
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    localStorage.clear();
  });

  it('creates the kiosk page with initial executive slide and respects language', () => {
    expect(component).toBeTruthy();
    expect(component.store.settings().activeSlide).toBe(0);
    expect(component.text().executiveTitle).toBe('Visão Executiva');

    component.language.setLanguage('en');
    fixture.detectChanges();
    expect(component.text().executiveTitle).toBe('Executive View');

    component.language.setLanguage('ko');
    fixture.detectChanges();
    expect(component.text().executiveTitle).toBe('경영진 뷰');
  });

  it('formats currency, numbers, and percentages properly', () => {
    component.language.setLanguage('pt');
    fixture.detectChanges();
    expect(component.formatCurrency(184260)).toContain('184');
    expect(component.formatNumber(1247)).toContain('1');
    expect(component.formatPercent(-49.8)).toBe('-49,8%');
    expect(component.formatPercent(15.2)).toBe('+15,2%');

    component.language.setLanguage('en');
    fixture.detectChanges();
    expect(component.formatPercent(-49.8)).toBe('-49.8%');
  });

  it('handles keyboard navigation with arrow keys and spacebar', () => {
    expect(component.store.settings().activeSlide).toBe(0);

    component.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.store.settings().activeSlide).toBe(1);

    component.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.store.settings().activeSlide).toBe(0);

    expect(component.store.isPaused()).toBe(false);
    component.handleKeyboardEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(component.store.isPaused()).toBe(true);
  });

  it('navigates back to dashboard on exitKiosk', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.exitKiosk();
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('handles dock visibility with auto-hide and reveal', () => {
    vi.useFakeTimers();
    component.showDock();
    expect(component.isDockVisible()).toBe(true);

    // After 5s without interaction, dock hides
    vi.advanceTimersByTime(5000);
    expect(component.isDockVisible()).toBe(false);

    // Mouse movement or trigger reveals dock
    component.showDock();
    expect(component.isDockVisible()).toBe(true);

    // Mouse entering dock keeps it visible
    component.onDockMouseEnter();
    vi.advanceTimersByTime(6000);
    expect(component.isDockVisible()).toBe(true);

    // Mouse leaving restarts the 5s timer
    component.onDockMouseLeave();
    vi.advanceTimersByTime(5000);
    expect(component.isDockVisible()).toBe(false);

    vi.useRealTimers();
  });

  it('toggles theme between dark and light mode', () => {
    const initialDark = component.themeService.isDark();
    component.toggleTheme();
    expect(component.themeService.isDark()).toBe(!initialDark);
    component.toggleTheme();
    expect(component.themeService.isDark()).toBe(initialDark);
  });

  it('updates interval via onIntervalChange', () => {
    component.onIntervalChange('30');
    expect(component.store.settings().intervalSeconds).toBe(30);
    expect(component.currentInterval()).toBe('30');
  });
});
