import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import {
  DashboardAnalysis,
  DashboardComparison,
  DashboardDataState,
  DashboardFilterChip,
  DashboardFilterKey,
  DashboardFilterOptions,
  DashboardFilters,
  DashboardKpis,
  DashboardMetric,
  DashboardMultiFilterKey,
  DashboardRankingLimit,
  DashboardSnapshot,
  DEFAULT_FILTER_OPTIONS,
  EMPTY_SNAPSHOT,
  RelativeDashboardKpis,
} from './dashboard.models';
import { DashboardDataService, DASHBOARD_ALL_COMPONENTS } from './dashboard-data.service';

export const INITIAL_DASHBOARD_FILTERS: DashboardFilters = {
  year: '2026',
  period: 'ytd',
  product: [],
  line: [],
  division: [],
  week: [],
  component: DASHBOARD_ALL_COMPONENTS,
};

@Injectable()
export class DashboardStore {
  private readonly data = inject(DashboardDataService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly canUseApi = isPlatformBrowser(this.platformId);
  private apiRequestSequence = 0;

  private readonly filterOptionsSignal = signal<DashboardFilterOptions>(DEFAULT_FILTER_OPTIONS);
  get options(): DashboardFilterOptions {
    return this.filterOptionsSignal();
  }

  readonly filters = signal<DashboardFilters>({ ...INITIAL_DASHBOARD_FILTERS });
  readonly metric = signal<DashboardMetric>('usd');
  readonly analysis = signal<DashboardAnalysis>('absolute');
  readonly comparison = signal<DashboardComparison>('ytd');
  readonly rankingLimit = signal<DashboardRankingLimit>(10);
  readonly dataState = signal<DashboardDataState>('loading');
  readonly apiSnapshot = signal<DashboardSnapshot>(EMPTY_SNAPSHOT);
  readonly monetaryValuesHidden = signal(false);

  readonly snapshot = computed(() => this.apiSnapshot());

  readonly hasActiveFilters = computed(() => {
    const filters = this.filters();
    return (Object.keys(INITIAL_DASHBOARD_FILTERS) as DashboardFilterKey[]).some(
      (key) => !this.filterValuesEqual(filters[key], INITIAL_DASHBOARD_FILTERS[key]),
    );
  });

  readonly activeFilterChips = computed<readonly DashboardFilterChip[]>(() => {
    const filters = this.filters();
    return [
      {
        key: 'year',
        label: 'Ano',
        values: filters.year === INITIAL_DASHBOARD_FILTERS.year ? [] : [filters.year],
      },
      {
        key: 'period',
        label: 'Período',
        values:
          filters.period === INITIAL_DASHBOARD_FILTERS.period
            ? []
            : [
                this.options.periods.find((period) => period.value === filters.period)?.label ??
                  filters.period,
              ],
      },
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
    const comparison = this.comparison();
    if (comparison === 'ytd') return `Mesmo acumulado de ${Number(this.filters().year) - 1}`;
    if (comparison === 'mom') return this.previousMonthLabel();
    return `Mesmo mês de ${Number(this.filters().year) - 1}`;
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
      reference: previous,
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
    const hasIncompleteCurrentDenominator = selected.some((point) => {
      const actual = metric === 'usd' ? point.actualUsd : point.actualQty;
      return actual !== null && point.relativeStatus !== 'AVAILABLE';
    });
    const denominator = this.sum(
      selected.map((point) => (metric === 'usd' ? point.materialAmountUsd : point.productionQty)),
    );
    const hasIncompleteReferenceDenominator = reference.some(({ point, usePreviousYear }) => {
      const actual =
        metric === 'usd'
          ? usePreviousYear
            ? point.previousUsd
            : point.actualUsd
          : usePreviousYear
            ? point.previousQty
            : point.actualQty;
      const status = usePreviousYear ? point.previousRelativeStatus : point.relativeStatus;
      return actual !== null && status !== 'AVAILABLE';
    });
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
    const rate =
      !hasIncompleteCurrentDenominator && denominator > 0 ? (numerator / denominator) * 100 : null;
    const referenceRate =
      !hasIncompleteReferenceDenominator && referenceDenominator > 0
        ? (referenceNumerator / referenceDenominator) * 100
        : null;

    return {
      rate,
      numerator,
      denominator,
      variation:
        rate !== null && referenceRate !== null && referenceRate > 0
          ? ((rate - referenceRate) / referenceRate) * 100
          : null,
    };
  });

  setFilter<K extends DashboardFilterKey>(key: K, value: DashboardFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  clearFilter(key: DashboardFilterKey): void {
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

  setRankingLimit(limit: DashboardRankingLimit): void {
    this.rankingLimit.set(limit);
  }

  setComparison(comparison: DashboardComparison): void {
    this.comparison.set(comparison);
  }

  /** Busca dados para um contexto local de gráfico sem alterar o Dashboard. */
  async loadChartSnapshot(
    filters: DashboardFilters,
    metric: DashboardMetric = this.metric(),
    rankingLimit: DashboardRankingLimit = this.rankingLimit(),
  ): Promise<DashboardSnapshot | null> {
    if (!this.canUseApi) return null;

    try {
      return await this.data.getSnapshot(filters, metric, rankingLimit);
    } catch {
      return null;
    }
  }

  toggleMonetaryValues(): void {
    if (this.metric() === 'usd') this.monetaryValuesHidden.update((hidden) => !hidden);
  }

  constructor() {
    void this.loadFilterOptions();
    effect(() => {
      void this.loadApiSnapshot(
        this.filters(),
        this.metric(),
        this.analysis(),
        this.rankingLimit(),
      );
    });
  }

  private async loadFilterOptions(): Promise<void> {
    if (!this.canUseApi) return;
    try {
      const res = await this.data.getFilters();
      this.filterOptionsSignal.update((prev) => ({
        ...prev,
        lines: res.receipt_departments?.length
          ? res.receipt_departments
          : res.departments.length
            ? res.departments
            : prev.lines,
        components: res.item_types.length ? res.item_types : prev.components,
      }));
    } catch {
      // Mantém DEFAULT_FILTER_OPTIONS em caso de indisponibilidade
    }
  }

  private sum(values: readonly (number | null)[]): number {
    return values.reduce<number>((total, value) => total + (value ?? 0), 0);
  }

  private selectedMonthlyPoints() {
    const points = this.snapshot().monthly;
    const monthIndex = this.currentMonthIndex();
    return this.comparison() === 'ytd'
      ? points.slice(0, monthIndex + 1)
      : points.slice(monthIndex, monthIndex + 1);
  }

  private referenceMonthlyPoints() {
    const points = this.snapshot().monthly;
    const monthIndex = this.currentMonthIndex();

    if (this.comparison() === 'ytd') {
      return points.slice(0, monthIndex + 1).map((point) => ({ point, usePreviousYear: true }));
    }

    if (this.comparison() === 'mom' && monthIndex > 0) {
      return [{ point: points[monthIndex - 1], usePreviousYear: false }];
    }

    return [{ point: points[monthIndex], usePreviousYear: true }];
  }

  private currentMonthIndex(): number {
    const selectedPeriod = this.filters().period;
    if (selectedPeriod !== 'ytd') return Number(selectedPeriod);

    const points = this.snapshot().monthly;
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      if (point.actualUsd !== null || point.actualQty !== null) return index;
    }

    return 0;
  }

  private previousMonthLabel(): string {
    const monthIndex = this.currentMonthIndex();
    return monthIndex > 0
      ? (this.snapshot().monthly[monthIndex - 1]?.month ?? 'Período anterior')
      : `Mesmo mês de ${Number(this.filters().year) - 1}`;
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

  private async loadApiSnapshot(
    filters: DashboardFilters,
    metric: DashboardMetric,
    analysis: DashboardAnalysis,
    rankingLimit: DashboardRankingLimit,
  ): Promise<void> {
    const requestId = ++this.apiRequestSequence;
    if (!this.canUseApi) {
      this.apiSnapshot.set(EMPTY_SNAPSHOT);
      this.dataState.set('api-empty');
      return;
    }

    this.dataState.set('loading');
    try {
      const snapshot = await this.data.getSnapshot(filters, metric, rankingLimit);
      if (requestId !== this.apiRequestSequence) return;
      this.apiSnapshot.set(snapshot);
      this.dataState.set(this.hasUsableSnapshot(snapshot) ? 'api' : 'api-empty');
    } catch {
      if (requestId !== this.apiRequestSequence) return;
      this.apiSnapshot.set(EMPTY_SNAPSHOT);
      this.dataState.set('error');
    }
  }

  private hasUsableSnapshot(snapshot: DashboardSnapshot): boolean {
    return (
      snapshot.monthly.some((point) => (point.actualUsd ?? 0) > 0) &&
      snapshot.distribution.length > 0
    );
  }
}
