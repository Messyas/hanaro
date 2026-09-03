import { TestBed } from '@angular/core/testing';
import { DashboardStore, INITIAL_DASHBOARD_FILTERS } from './dashboard.store';

describe('DashboardStore', () => {
  let store: DashboardStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DashboardStore] });
    store = TestBed.inject(DashboardStore);
  });

  it('starts with the accumulated IF Cost view', () => {
    expect(store.filters()).toEqual(INITIAL_DASHBOARD_FILTERS);
    expect(store.metric()).toBe('usd');
    expect(store.kpis().actual).toBe(184_260);
    expect(store.kpis().target).toBe(202_859);
    expect(store.kpis().achievement).toBeCloseTo(110.1, 1);
    expect(store.kpis().variation).toBeLessThan(0);
  });

  it('recalculates the dashboard when a dimension is filtered', () => {
    const total = store.kpis().actual;

    store.setFilter('product', ['BM']);

    expect(store.hasActiveFilters()).toBe(true);
    expect(store.kpis().actual).toBeLessThan(total);
    expect(store.snapshot().distribution).toHaveLength(1);
    expect(store.snapshot().distribution[0].label).toBe('BM');
  });

  it('combines multiple selections and exposes removable filter chips', () => {
    store.setFilter('product', ['BM', 'VS']);
    store.setFilter('line', ['BMCELL', 'Quale', 'G08']);

    expect(store.snapshot().distribution.map((item) => item.label)).toEqual(['BM', 'VS']);
    expect(store.activeFilterChips()).toEqual([
      { key: 'product', label: 'Produto', values: ['BM', 'VS'] },
      { key: 'line', label: 'Linha', values: ['BMCELL', 'Quale', 'G08'] },
    ]);

    store.clearFilter('product');

    expect(store.filters().product).toEqual([]);
    expect(store.activeFilterChips()).toHaveLength(1);
  });

  it('treats a selected month as a single period and compares it with the prior month', () => {
    store.setFilter('period', '7');
    store.setComparison('mom');

    expect(store.periodLabel()).toBe('Ago');
    expect(store.comparisonLabel()).toBe('Jul');
    expect(store.kpis().actual).toBe(19_110);
    expect(store.kpis().target).toBe(23_324);
    expect(store.kpis().variation).toBeCloseTo(50.5, 1);
  });

  it('switches to quantity without leaving monetary values masked', () => {
    store.toggleMonetaryValues();
    expect(store.monetaryValuesHidden()).toBe(true);

    store.setMetric('qty');

    expect(store.metric()).toBe('qty');
    expect(store.monetaryValuesHidden()).toBe(false);
    expect(store.kpis().actual).toBe(1_119);
  });

  it('restores all initial filters', () => {
    store.setFilter('component', 'PCBA');
    store.setFilter('period', '2');

    store.resetFilters();

    expect(store.filters()).toEqual(INITIAL_DASHBOARD_FILTERS);
    expect(store.hasActiveFilters()).toBe(false);
  });

  it('switches to relative efficiency and uses the correct denominator', () => {
    store.setFilter('division', ['HE']);
    store.setFilter('week', ['W32']);
    store.setFilter('component', 'PCBA');

    store.setAnalysis('relative');

    expect(store.analysis()).toBe('relative');
    expect(store.filters().division).toEqual([]);
    expect(store.filters().week).toEqual([]);
    expect(store.filters().component).toBe('Todos');
    expect(store.relativeKpis().rate).toBeGreaterThan(0);
    expect(store.relativeKpis().denominator).toBeGreaterThan(store.relativeKpis().numerator);
  });

  it('exposes line, model, offender, and component rankings in snapshot', () => {
    const snapshot = store.snapshot();
    expect(snapshot.lines.length).toBeGreaterThan(0);
    expect(snapshot.models.length).toBeGreaterThan(0);
    expect(snapshot.offenders.length).toBeGreaterThan(0);
    expect(snapshot.components.length).toBeGreaterThan(0);
  });
});
