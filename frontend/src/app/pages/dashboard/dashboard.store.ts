import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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
  DashboardMonthlyPoint,
  DashboardMultiFilterKey,
  DashboardRankingLimit,
  DashboardSnapshot,
  DEFAULT_FILTER_OPTIONS,
  EMPTY_SNAPSHOT,
  RelativeDashboardKpis,
} from './dashboard.models';

interface DashboardApiRankingItem {
  key: string | null;
  amount: string;
  record_count: number;
}

interface DashboardApiSeriesPoint {
  period: string;
  actual: string | null;
  previous_year: string | null;
  target: string | null;
}

interface DashboardApiResponse {
  metadata: {
    generated_at: string;
  };
  monthly: DashboardApiSeriesPoint[];
  weekly?: DashboardApiSeriesPoint[];
  rankings: {
    products: DashboardApiRankingItem[];
    components?: DashboardApiRankingItem[];
    lines?: DashboardApiRankingItem[];
    models?: DashboardApiRankingItem[];
    offenders?: DashboardApiRankingItem[];
  };
}

interface ScrapFiltersResponse {
  organizations: string[];
  receipt_departments?: string[];
  departments: string[];
  item_types: string[];
  items: string[];
  account_aliases: string[];
  periods: string[];
}

const MONTH_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

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
  private readonly http = inject(HttpClient, { optional: true });
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
    if (!this.canUseApi || !this.http) return null;

    try {
      const response = await firstValueFrom(
        this.http.get<DashboardApiResponse>('/api/v1/dashboard/scrap', {
          params: this.apiParams(filters, rankingLimit, metric),
        }),
      );
      return this.mapApiResponse(response, metric);
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
    if (!this.canUseApi || !this.http) return;
    try {
      const res = await firstValueFrom(
        this.http.get<ScrapFiltersResponse>('/api/v1/scrap/filters'),
      );
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
    if (!this.canUseApi || !this.http) {
      this.apiSnapshot.set(EMPTY_SNAPSHOT);
      this.dataState.set('api-empty');
      return;
    }

    this.dataState.set('loading');
    try {
      const response = await firstValueFrom(
        this.http.get<DashboardApiResponse>('/api/v1/dashboard/scrap', {
          params: this.apiParams(filters, rankingLimit, metric),
        }),
      );
      if (requestId !== this.apiRequestSequence) return;

      const snapshot = this.mapApiResponse(response, metric);
      this.apiSnapshot.set(snapshot);
      this.dataState.set(this.hasUsableSnapshot(snapshot) ? 'api' : 'api-empty');
    } catch {
      if (requestId !== this.apiRequestSequence) return;
      this.apiSnapshot.set(EMPTY_SNAPSHOT);
      this.dataState.set('error');
    }
  }

  private apiParams(
    filters: DashboardFilters,
    rankingLimit: DashboardRankingLimit,
    metric: DashboardMetric,
  ): HttpParams {
    let params = new HttpParams()
      .set('year', filters.year)
      .set('currency', 'USD')
      .set('metric', metric === 'usd' ? 'if_cost' : 'quantity')
      .set('impact_mode', 'absolute')
      .set('ranking_limit', String(rankingLimit));

    params = this.appendValues(params, 'products', filters.product);
    params = this.appendValues(params, 'receipt_departments', filters.line);
    params = this.appendValues(params, 'divisions', filters.division);
    if (filters.component !== INITIAL_DASHBOARD_FILTERS.component) {
      params = params.append('item_types', filters.component);
    }
    if (filters.week.length === 1) {
      const week = Number(filters.week[0].replace(/\D/g, ''));
      if (Number.isFinite(week) && week > 0) params = params.set('week', String(week));
    }
    if (filters.period !== 'ytd') {
      const month = Number(filters.period) + 1;
      params = params
        .set('date_from', `${filters.year}-${String(month).padStart(2, '0')}-01`)
        .set('date_to', this.monthEndDate(filters.year, month));
    }

    return params;
  }

  private appendValues(params: HttpParams, key: string, values: readonly string[]): HttpParams {
    return values.reduce((nextParams, value) => nextParams.append(key, value), params);
  }

  private mapApiResponse(
    response: DashboardApiResponse,
    metric: DashboardMetric,
  ): DashboardSnapshot {
    const quantityMetric = metric === 'qty';
    const monthlyByIndex = new Map(
      response.monthly.map((point) => [Number(point.period.slice(5, 7)) - 1, point]),
    );
    const monthly: DashboardMonthlyPoint[] = Array.from({ length: 12 }, (_, index) => {
      const apiPoint = monthlyByIndex.get(index);

      return {
        month: MONTH_NAMES[index],
        actualUsd: quantityMetric ? null : apiPoint ? this.toNullableNumber(apiPoint.actual) : null,
        previousUsd: quantityMetric
          ? null
          : apiPoint
            ? this.toNullableNumber(apiPoint.previous_year)
            : null,
        targetUsd: quantityMetric
          ? 0
          : apiPoint
            ? (this.toNullableNumber(apiPoint.target) ?? 0)
            : 0,
        actualQty: quantityMetric
          ? apiPoint
            ? this.toNullableNumber(apiPoint.actual)
            : null
          : null,
        previousQty: quantityMetric
          ? apiPoint
            ? this.toNullableNumber(apiPoint.previous_year)
            : null
          : null,
        targetQty: 0,
        materialAmountUsd: 0,
        previousMaterialAmountUsd: 0,
        productionQty: 0,
        previousProductionQty: 0,
      };
    });

    return {
      monthly,
      weekly: (response.weekly ?? []).map((point) => this.mapApiWeeklyPoint(point, metric)),
      distribution: response.rankings.products.map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: this.toNumber(item.amount),
        qty: quantityMetric ? this.toNumber(item.amount) : item.record_count,
      })),
      relativeDistribution: (response.rankings.lines ?? []).map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: this.toNumber(item.amount),
        qty: quantityMetric ? this.toNumber(item.amount) : item.record_count,
        relativeUsd: undefined,
        relativeQty: undefined,
      })),
      components: (response.rankings.components ?? []).map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: this.toNumber(item.amount),
        qty: quantityMetric ? this.toNumber(item.amount) : item.record_count,
      })),
      lines: (response.rankings.lines ?? []).map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: this.toNumber(item.amount),
        qty: quantityMetric ? this.toNumber(item.amount) : item.record_count,
      })),
      models: (response.rankings.models ?? []).map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: this.toNumber(item.amount),
        qty: quantityMetric ? this.toNumber(item.amount) : item.record_count,
      })),
      offenders: (response.rankings.offenders ?? []).map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: this.toNumber(item.amount),
        qty: quantityMetric ? this.toNumber(item.amount) : item.record_count,
      })),
      lastUpdatedAt: new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(response.metadata.generated_at)),
    };
  }

  private mapApiWeeklyPoint(
    point: DashboardApiSeriesPoint,
    metric: DashboardMetric,
  ): DashboardMonthlyPoint {
    const quantityMetric = metric === 'qty';
    return {
      month: this.weekLabel(point.period),
      actualUsd: quantityMetric ? null : this.toNullableNumber(point.actual),
      previousUsd: quantityMetric ? null : this.toNullableNumber(point.previous_year),
      targetUsd: quantityMetric ? 0 : (this.toNullableNumber(point.target) ?? 0),
      actualQty: quantityMetric ? this.toNullableNumber(point.actual) : null,
      previousQty: quantityMetric ? this.toNullableNumber(point.previous_year) : null,
      targetQty: 0,
      materialAmountUsd: 0,
      previousMaterialAmountUsd: 0,
      productionQty: 0,
      previousProductionQty: 0,
    };
  }

  private weekLabel(period: string): string {
    const match = period.match(/W(\d{1,2})$/);
    return match ? `W${match[1]}` : period;
  }

  private hasUsableSnapshot(snapshot: DashboardSnapshot): boolean {
    return (
      snapshot.monthly.some((point) => (point.actualUsd ?? 0) > 0) &&
      snapshot.distribution.length > 0
    );
  }

  private monthEndDate(year: string, month: number): string {
    const date = new Date(Number(year), month, 0);
    return `${year}-${String(month).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private toNumber(value: string): number {
    return Number(value);
  }

  private toNullableNumber(value: string | null): number | null {
    return value === null ? null : Number(value);
  }
}
