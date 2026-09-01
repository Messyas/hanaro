import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DashboardAnalysis,
  DashboardDataState,
  DashboardFilterChip,
  DashboardFilterKey,
  DashboardFilters,
  DashboardKpis,
  DashboardMetric,
  DashboardMonthlyPoint,
  DashboardMultiFilterKey,
  DashboardRankingLimit,
  DashboardSnapshot,
  RelativeDashboardKpis,
} from './dashboard.models';
import { MockDashboardService } from './mock-dashboard.service';

interface DashboardApiRankingItem {
  key: string | null;
  amount: string;
  record_count: number;
}

interface DashboardApiSeriesPoint {
  period: string;
  actual: string;
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
    lines: DashboardApiRankingItem[];
  };
}

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
  private readonly http = inject(HttpClient, { optional: true });
  private readonly platformId = inject(PLATFORM_ID);
  private readonly canUseApi = isPlatformBrowser(this.platformId);
  private apiRequestSequence = 0;

  readonly filters = signal<DashboardFilters>({ ...INITIAL_DASHBOARD_FILTERS });
  readonly metric = signal<DashboardMetric>('usd');
  readonly analysis = signal<DashboardAnalysis>('absolute');
  readonly rankingLimit = signal<DashboardRankingLimit>(5);
  readonly dataState = signal<DashboardDataState>('mock');
  readonly apiSnapshot = signal<DashboardSnapshot | null>(null);
  readonly monetaryValuesHidden = signal(false);
  readonly options = this.dataSource.options;
  readonly snapshot = computed(
    () => this.apiSnapshot() ?? this.dataSource.getSnapshot(this.filters()),
  );
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

  toggleMonetaryValues(): void {
    if (this.metric() === 'usd') this.monetaryValuesHidden.update((hidden) => !hidden);
  }

  constructor() {
    effect(() => {
      void this.loadApiSnapshot(
        this.filters(),
        this.metric(),
        this.analysis(),
        this.rankingLimit(),
      );
    });
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

  private async loadApiSnapshot(
    filters: DashboardFilters,
    metric: DashboardMetric,
    analysis: DashboardAnalysis,
    rankingLimit: DashboardRankingLimit,
  ): Promise<void> {
    const requestId = ++this.apiRequestSequence;
    if (!this.canUseApi || !this.http || metric !== 'usd' || analysis !== 'absolute') {
      this.apiSnapshot.set(null);
      this.dataState.set('mock');
      return;
    }

    this.dataState.set('loading');
    try {
      const response = await firstValueFrom(
        this.http.get<DashboardApiResponse>('/api/v1/dashboard/scrap', {
          params: this.apiParams(filters, rankingLimit),
        }),
      );
      if (requestId !== this.apiRequestSequence) return;

      const snapshot = this.mapApiResponse(response);
      if (this.hasUsableSnapshot(snapshot)) {
        this.apiSnapshot.set(snapshot);
        this.dataState.set('api');
      } else {
        this.apiSnapshot.set(null);
        this.dataState.set('api-empty');
      }
    } catch {
      if (requestId !== this.apiRequestSequence) return;
      this.apiSnapshot.set(null);
      this.dataState.set('mock');
    }
  }

  private apiParams(filters: DashboardFilters, rankingLimit: DashboardRankingLimit): HttpParams {
    let params = new HttpParams()
      .set('year', filters.year)
      .set('currency', 'USD')
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

  private mapApiResponse(response: DashboardApiResponse): DashboardSnapshot {
    const mock = this.dataSource.getSnapshot(this.filters());
    const monthlyByIndex = new Map(
      response.monthly.map((point) => [Number(point.period.slice(5, 7)) - 1, point]),
    );
    const monthly = Array.from({ length: 12 }, (_, index) => {
      const apiPoint = monthlyByIndex.get(index);
      const mockPoint = mock.monthly[index];

      return {
        ...mockPoint,
        month: mockPoint.month,
        actualUsd: apiPoint ? this.toNumber(apiPoint.actual) : null,
        previousUsd: apiPoint ? this.toNullableNumber(apiPoint.previous_year) : null,
        targetUsd: apiPoint ? (this.toNullableNumber(apiPoint.target) ?? 0) : 0,
      };
    });

    return {
      monthly,
      weekly: (response.weekly ?? []).map((point) => this.mapApiWeeklyPoint(point)),
      distribution: response.rankings.products.map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: this.toNumber(item.amount),
        qty: item.record_count,
      })),
      relativeDistribution: response.rankings.lines.map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: this.toNumber(item.amount),
        qty: item.record_count,
        relativeUsd: undefined,
        relativeQty: undefined,
      })),
      lastUpdatedAt: new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(response.metadata.generated_at)),
    };
  }

  private mapApiWeeklyPoint(point: DashboardApiSeriesPoint): DashboardMonthlyPoint {
    return {
      month: this.weekLabel(point.period),
      actualUsd: this.toNumber(point.actual),
      previousUsd: this.toNullableNumber(point.previous_year),
      targetUsd: this.toNullableNumber(point.target) ?? 0,
      actualQty: null,
      previousQty: null,
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
      snapshot.monthly.some((point) => (point.targetUsd ?? 0) > 0) &&
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
