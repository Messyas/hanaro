import { computed, inject, Injectable, signal } from '@angular/core';
import {
  DashboardAnalysis,
  DashboardFilterChip,
  DashboardFilterKey,
  DashboardFilters,
  DashboardKpis,
  DashboardMetric,
  DashboardMultiFilterKey,
  RelativeDashboardKpis,
} from './dashboard.models';
import { MockDashboardService } from './mock-dashboard.service';

export const INITIAL_DASHBOARD_FILTERS: DashboardFilters = {
  year: '2026',
  period: 'ytd',
  product: [],
  line: [],
  division: [],
  week: [],
  component: 'Todos',
};

@Injectable()
export class DashboardStore {
  private readonly dataSource = inject(MockDashboardService);

  readonly filters = signal<DashboardFilters>({ ...INITIAL_DASHBOARD_FILTERS });
  readonly metric = signal<DashboardMetric>('usd');
  readonly analysis = signal<DashboardAnalysis>('absolute');
  readonly monetaryValuesHidden = signal(false);
  readonly options = this.dataSource.options;
  readonly snapshot = computed(() => this.dataSource.getSnapshot(this.filters()));
  readonly hasActiveFilters = computed(() => {
    const filters = this.filters();
    return (Object.keys(INITIAL_DASHBOARD_FILTERS) as DashboardFilterKey[]).some(
      (key) => !this.filterValuesEqual(filters[key], INITIAL_DASHBOARD_FILTERS[key]),
    );
  });
  readonly activeFilterChips = computed<readonly DashboardFilterChip[]>(() => {
    const filters = this.filters();
    return [
      { key: 'product', label: 'Produto', values: filters.product },
      { key: 'line', label: 'Linha', values: filters.line },
      { key: 'division', label: 'Divisão', values: filters.division },
      { key: 'week', label: 'Semana', values: filters.week },
      {
        key: 'component',
        label: 'Componente',
        values:
          filters.component === INITIAL_DASHBOARD_FILTERS.component ? [] : [filters.component],
      },
    ].filter((chip) => chip.values.length > 0) as readonly DashboardFilterChip[];
  });
  readonly periodLabel = computed(() => {
    const selected = this.filters().period;
    return this.options.periods.find((period) => period.value === selected)?.label ?? selected;
  });
  readonly comparisonLabel = computed(() => {
    const selectedPeriod = this.filters().period;
    if (selectedPeriod === 'ytd') return `Mesmo acumulado de ${Number(this.filters().year) - 1}`;

    const monthIndex = Number(selectedPeriod);
    return monthIndex > 0
      ? (this.snapshot().monthly[monthIndex - 1]?.month ?? 'Período anterior')
      : `Mesmo mês de ${Number(this.filters().year) - 1}`;
  });
  readonly kpis = computed<DashboardKpis>(() => {
    const metric = this.metric();
    const selected = this.selectedMonthlyPoints();
    const actual = this.sum(
      selected.map((point) => (metric === 'usd' ? point.actualUsd : point.actualQty)),
    );
    const reference = this.referenceMonthlyPoints();
    const previous = this.sum(
      reference.map(({ point, usePreviousYear }) =>
        metric === 'usd'
          ? usePreviousYear
            ? point.previousUsd
            : point.actualUsd
          : usePreviousYear
            ? point.previousQty
            : point.actualQty,
      ),
    );
    const target = this.sum(
      selected.map((point) => (metric === 'usd' ? point.targetUsd : point.targetQty)),
    );

    return {
      actual,
      target,
      achievement: actual > 0 ? (target / actual) * 100 : 0,
      variation: previous > 0 ? ((actual - previous) / previous) * 100 : 0,
    };
  });
  readonly relativeKpis = computed<RelativeDashboardKpis>(() => {
    const metric = this.metric();
    const selected = this.selectedMonthlyPoints();
    const numerator = this.sum(
      selected.map((point) => (metric === 'usd' ? point.actualUsd : point.actualQty)),
    );
    const reference = this.referenceMonthlyPoints();
    const referenceNumerator = this.sum(
      reference.map(({ point, usePreviousYear }) =>
        metric === 'usd'
          ? usePreviousYear
            ? point.previousUsd
            : point.actualUsd
          : usePreviousYear
            ? point.previousQty
            : point.actualQty,
      ),
    );
    const denominator = this.sum(
      selected.map((point) => (metric === 'usd' ? point.materialAmountUsd : point.productionQty)),
    );
    const referenceDenominator = this.sum(
      reference.map(({ point, usePreviousYear }) =>
        metric === 'usd'
          ? usePreviousYear
            ? point.previousMaterialAmountUsd
            : point.materialAmountUsd
          : usePreviousYear
            ? point.previousProductionQty
            : point.productionQty,
      ),
    );
    const rate = denominator > 0 ? (numerator / denominator) * 100 : 0;
    const referenceRate =
      referenceDenominator > 0 ? (referenceNumerator / referenceDenominator) * 100 : 0;

    return {
      rate,
      numerator,
      denominator,
      variation: referenceRate > 0 ? ((rate - referenceRate) / referenceRate) * 100 : 0,
    };
  });

  setFilter<K extends DashboardFilterKey>(key: K, value: DashboardFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  clearFilter(key: DashboardMultiFilterKey | 'component'): void {
    this.setFilter(key, INITIAL_DASHBOARD_FILTERS[key]);
  }

  resetFilters(): void {
    this.filters.set({ ...INITIAL_DASHBOARD_FILTERS });
  }

  setMetric(metric: DashboardMetric): void {
    this.metric.set(metric);
    if (metric === 'qty') this.monetaryValuesHidden.set(false);
  }

  setAnalysis(analysis: DashboardAnalysis): void {
    this.analysis.set(analysis);
    if (analysis === 'relative') {
      this.filters.update((filters) => ({
        ...filters,
        division: [],
        week: [],
        component: INITIAL_DASHBOARD_FILTERS.component,
      }));
    }
  }

  toggleMonetaryValues(): void {
    if (this.metric() === 'usd') this.monetaryValuesHidden.update((hidden) => !hidden);
  }

  private sum(values: readonly (number | null)[]): number {
    return values.reduce<number>((total, value) => total + (value ?? 0), 0);
  }

  private selectedMonthlyPoints() {
    const points = this.snapshot().monthly;
    const selectedPeriod = this.filters().period;
    return selectedPeriod === 'ytd'
      ? points.slice(0, 8)
      : points.slice(Number(selectedPeriod), Number(selectedPeriod) + 1);
  }

  private referenceMonthlyPoints() {
    const points = this.snapshot().monthly;
    const selectedPeriod = this.filters().period;
    if (selectedPeriod === 'ytd') {
      return points.slice(0, 8).map((point) => ({ point, usePreviousYear: true }));
    }

    const monthIndex = Number(selectedPeriod);
    if (monthIndex > 0) return [{ point: points[monthIndex - 1], usePreviousYear: false }];
    return [{ point: points[0], usePreviousYear: true }];
  }

  private filterValuesEqual(
    current: DashboardFilters[DashboardFilterKey],
    initial: DashboardFilters[DashboardFilterKey],
  ): boolean {
    if (Array.isArray(current) && Array.isArray(initial)) {
      return (
        current.length === initial.length &&
        current.every((value, index) => value === initial[index])
      );
    }
    return current === initial;
  }
}
