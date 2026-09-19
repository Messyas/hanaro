import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DashboardStore, INITIAL_DASHBOARD_FILTERS } from './dashboard.store';

describe('DashboardStore', () => {
  let store: DashboardStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        DashboardStore,
      ],
    });
    store = TestBed.inject(DashboardStore);
    httpMock = TestBed.inject(HttpTestingController);

    // Consome requisição inicial de filtros
    const filterReq = httpMock.match('/api/v1/scrap/filters');
    if (filterReq.length) {
      filterReq[0].flush({
        organizations: ['TV', 'AV', 'BM'],
        departments: ['BMCELL', 'Quale'],
        item_types: ['PCBA', 'Module'],
        items: [],
        account_aliases: [],
        periods: [],
      });
    }
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('starts with initial filters and loading/empty state', () => {
    expect(store.filters()).toEqual(INITIAL_DASHBOARD_FILTERS);
    expect(store.metric()).toBe('usd');
    expect(store.monetaryValuesHidden()).toBe(false);

    // Descarta chamada pendente para não vazar para outros testes
    httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
  });

  it('manages filter updates and chip generation', () => {
    store.setFilter('product', ['BM', 'VS']);
    store.setFilter('line', ['BMCELL', 'Quale', 'G08']);

    expect(store.hasActiveFilters()).toBe(true);
    expect(store.activeFilterChips()).toEqual([
      { key: 'product', label: 'Produto', values: ['BM', 'VS'] },
      { key: 'line', label: 'Linha', values: ['BMCELL', 'Quale', 'G08'] },
    ]);

    store.clearFilter('product');
    expect(store.filters().product).toEqual([]);
    expect(store.activeFilterChips()).toHaveLength(1);

    httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
  });

  it('restores all initial filters on resetFilters', () => {
    store.setFilter('component', 'PCBA');
    store.setFilter('period', '2');

    store.resetFilters();

    expect(store.filters()).toEqual(INITIAL_DASHBOARD_FILTERS);
    expect(store.hasActiveFilters()).toBe(false);

    httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
  });

  it('toggles monetary values visibility', () => {
    store.toggleMonetaryValues();
    expect(store.monetaryValuesHidden()).toBe(true);

    store.setMetric('qty');
    expect(store.metric()).toBe('qty');
    expect(store.monetaryValuesHidden()).toBe(false);

    httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
  });

  it('enables relative analysis and clears filters unsupported by the global denominator', () => {
    store.setFilter('division', ['HE']);
    store.setFilter('week', ['W31']);
    store.setFilter('component', 'PCBA');

    store.setAnalysis('relative');

    expect(store.analysis()).toBe('relative');
    expect(store.filters().division).toEqual([]);
    expect(store.filters().week).toEqual([]);
    expect(store.filters().component).toBe(INITIAL_DASHBOARD_FILTERS.component);

    store.setAnalysis('absolute');
    expect(store.analysis()).toBe('absolute');

    httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
  });

  it('handles period selection and comparison labels', () => {
    store.setFilter('period', '7');
    store.setComparison('mom');

    expect(store.periodLabel()).toBe('Ago');
    expect(store.comparisonLabel()).toBe('Período anterior');

    httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
  });

  it('populates snapshot from API response without mock fallback', async () => {
    TestBed.flushEffects();
    const reqs = httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
    expect(reqs.length).toBeGreaterThan(0);
    reqs[reqs.length - 1].flush({
      metadata: { generated_at: '2026-09-03T10:00:00Z' },
      monthly: [
        { period: '2026-01', actual: '10000', previous_year: '12000', target: '9000' },
        { period: '2026-02', actual: '15000', previous_year: '14000', target: '11000' },
      ],
      rankings: {
        products: [{ key: 'TV', amount: '20000', record_count: 50 }],
        lines: [{ key: 'BMCELL', amount: '12000', record_count: 30 }],
        models: [{ key: 'OLED55M', amount: '8000', record_count: 20 }],
        components: [{ key: 'PCBA', amount: '15000', record_count: 35 }],
        offenders: [{ key: 'D-DIRECT', amount: '18000', record_count: 40 }],
      },
    });
    await Promise.resolve();

    expect(store.dataState()).toBe('api');
    expect(store.snapshot().monthly[0].actualUsd).toBe(10000);
    expect(store.snapshot().lines).toHaveLength(1);
    expect(store.snapshot().lines[0].label).toBe('BMCELL');
    expect(store.snapshot().models[0].label).toBe('OLED55M');
    expect(store.snapshot().components[0].label).toBe('PCBA');
    expect(store.snapshot().offenders[0].label).toBe('D-DIRECT');
  });

  it('loads quantity data for the cards and monthly chart', async () => {
    TestBed.flushEffects();
    const initialRequests = httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
    initialRequests.forEach((request) =>
      request.flush({
        metadata: { generated_at: '2026-09-03T10:00:00Z' },
        monthly: [],
        rankings: { products: [], lines: [], models: [], components: [], offenders: [] },
      }),
    );

    store.setMetric('qty');
    TestBed.flushEffects();
    const requests = httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
    const request = requests[requests.length - 1];

    expect(request.request.params.get('metric')).toBe('quantity');
    request.flush({
      metadata: { generated_at: '2026-09-03T10:00:00Z' },
      monthly: [
        { period: '2026-01', actual: '120', previous_year: '100', target: null },
        { period: '2026-02', actual: '80', previous_year: '90', target: null },
      ],
      rankings: {
        products: [{ key: 'TV', amount: '200', record_count: 50 }],
        lines: [],
        models: [],
        components: [],
        offenders: [],
      },
    });
    await Promise.resolve();

    expect(store.snapshot().monthly[0].actualQty).toBe(120);
    expect(store.snapshot().monthly[0].previousQty).toBe(100);
    expect(store.snapshot().distribution[0].qty).toBe(200);
    expect(store.kpis().actual).toBe(200);
    expect(store.kpis().reference).toBe(190);
  });

  it('sets error state when API fails instead of falling back to fake data', async () => {
    TestBed.flushEffects();
    const reqs = httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
    expect(reqs.length).toBeGreaterThan(0);
    reqs[reqs.length - 1].error(new ProgressEvent('error'));
    await Promise.resolve();

    expect(store.dataState()).toBe('error');
    expect(store.snapshot().monthly).toEqual([]);
    expect(store.snapshot().lines).toEqual([]);
    expect(store.kpis().actual).toBe(0);
  });

  it('does not calculate a relative KPI from a partial denominator', async () => {
    TestBed.flushEffects();
    const reqs = httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
    reqs[reqs.length - 1].flush({
      metadata: { generated_at: '2026-09-03T10:00:00Z' },
      monthly: [
        {
          period: '2026-01',
          actual: '100',
          previous_year: '90',
          target: null,
          denominator: null,
          previous_year_denominator: '1000',
          relative_status: 'MISSING_DENOMINATOR',
          previous_year_relative_status: 'AVAILABLE',
        },
      ],
      rankings: {
        products: [{ key: 'TV', amount: '100', record_count: 1 }],
        lines: [],
        models: [],
        components: [],
        offenders: [],
      },
    });
    await Promise.resolve();

    store.setFilter('period', '0');

    expect(store.snapshot().monthly[0].materialAmountUsd).toBeNull();
    expect(store.snapshot().monthly[0].relativeStatus).toBe('MISSING_DENOMINATOR');
    expect(store.relativeKpis().rate).toBeNull();

    httpMock.match((req) => req.url.includes('/api/v1/dashboard/scrap'));
  });
});
