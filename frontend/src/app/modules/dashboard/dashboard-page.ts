import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../core/i18n/language.service';
import { UiIcon } from '../../shared/components/ui-icon/ui-icon';
import { DashboardPerformanceChart } from './charts/dashboard-performance-chart';
import { DashboardDistributionChart } from './components/dashboard-distribution-chart';
import { DashboardMultiSelect } from './components/dashboard-multi-select';
import {
  ListFilterSelect,
  ListFilterSelectOption,
} from '../../shared/components/list-filters/list-filter-select';
import { ListFilterPopover } from '../../shared/components/list-filters/list-filter-popover';

import {
  DashboardAnalysis,
  DashboardComparison,
  DashboardDistributionItem,
  DashboardEvolutionView,
  DashboardFilters,
  DashboardMetric,
  DashboardMonthlyPoint,
  DashboardMultiFilterKey,
  DashboardRankingLimit,
  DashboardSnapshot,
  DashboardSingleFilterKey,
} from './dashboard.models';
import { DashboardStore, INITIAL_DASHBOARD_FILTERS } from './dashboard.store';
import { ShellStatusService } from '../../core/shell/shell-status.service';
import {
  DASHBOARD_LOCALES,
  DASHBOARD_MONTHS,
  DASHBOARD_TRANSLATIONS,
} from './dashboard.translations';

interface DashboardEvolutionFilters {
  period: string;
  product: readonly string[];
  line: readonly string[];
}

type DashboardEvolutionMultiFilterKey = 'product' | 'line';

interface DashboardDistributionFilters {
  product: readonly string[];
  line: readonly string[];
  component: string;
}

type DashboardDistributionMultiFilterKey = 'product' | 'line';

type DashboardRankingKey = 'lines' | 'models' | 'components' | 'offenders';
type DashboardBarChartKey = 'distribution' | DashboardRankingKey;

interface DashboardRankingFilters {
  lines: readonly string[];
  models: readonly string[];
  components: readonly string[];
  offenders: readonly string[];
}

type DashboardBarChartLimits = Record<DashboardBarChartKey, DashboardRankingLimit>;

const INITIAL_EVOLUTION_FILTERS: DashboardEvolutionFilters = {
  period: 'ytd',
  product: [],
  line: [],
};

const INITIAL_DISTRIBUTION_FILTERS: DashboardDistributionFilters = {
  product: [],
  line: [],
  component: INITIAL_DASHBOARD_FILTERS.component,
};

const INITIAL_RANKING_FILTERS: DashboardRankingFilters = {
  lines: [],
  models: [],
  components: [],
  offenders: [],
};

const INITIAL_BAR_CHART_LIMITS: DashboardBarChartLimits = {
  distribution: 10,
  lines: 10,
  models: 10,
  components: 10,
  offenders: 10,
};

const COMPARISON_OPTIONS: readonly DashboardComparison[] = ['ytd', 'yoy', 'mom'];

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    UiIcon,
    DashboardPerformanceChart,
    DashboardDistributionChart,
    DashboardMultiSelect,
    ListFilterSelect,
    ListFilterPopover,
  ],
  providers: [DashboardStore],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage {
  readonly store = inject(DashboardStore);
  readonly language = inject(LanguageService);
  private readonly dashboardStatus = inject(ShellStatusService);
  readonly evolutionFiltersOpen = signal(false);
  readonly distributionFiltersOpen = signal(false);
  readonly evolutionView = signal<DashboardEvolutionView>('monthly');
  readonly evolutionFilters = signal<DashboardEvolutionFilters>({ ...INITIAL_EVOLUTION_FILTERS });
  readonly evolutionSnapshot = signal<DashboardSnapshot | null>(null);
  readonly distributionFilters = signal<DashboardDistributionFilters>({
    ...INITIAL_DISTRIBUTION_FILTERS,
  });
  readonly rankingFilters = signal<DashboardRankingFilters>({ ...INITIAL_RANKING_FILTERS });
  readonly barChartLimits = signal<DashboardBarChartLimits>({ ...INITIAL_BAR_CHART_LIMITS });
  readonly text = computed(() => DASHBOARD_TRANSLATIONS[this.language.currentLanguage()]);
  readonly locale = computed(() => DASHBOARD_LOCALES[this.language.currentLanguage()]);
  readonly months = computed(() => DASHBOARD_MONTHS[this.language.currentLanguage()]);
  readonly weeklyLabels = computed(() => this.store.options.weeks);
  readonly yearOptions = computed<ListFilterSelectOption[]>(() =>
    this.store.options.years.map((year) => ({ value: year, label: year })),
  );
  readonly periodOptions = computed<ListFilterSelectOption[]>(() =>
    this.store.options.periods.map((period) => ({
      value: period.value,
      label: this.periodOptionLabel(period.value),
    })),
  );
  readonly comparisonOptions = computed<ListFilterSelectOption[]>(() =>
    COMPARISON_OPTIONS.map((option) => ({
      value: option,
      label: this.comparisonOptionLabel(option),
    })),
  );
  readonly rankingLimitOptions = computed<ListFilterSelectOption[]>(() => [
    { value: '5', label: this.text().topFive },
    { value: '10', label: this.text().topTen },
  ]);
  readonly componentOptions = computed<ListFilterSelectOption[]>(() => [
    { value: INITIAL_DASHBOARD_FILTERS.component, label: this.text().allMasculine },
    ...this.store.options.components.map((component) => ({
      value: component,
      label: component,
    })),
  ]);
  readonly evolutionFiltersCount = computed(() => {
    const filters = this.evolutionFilters();
    return (
      (this.evolutionView() === 'weekly' && filters.period !== INITIAL_EVOLUTION_FILTERS.period
        ? 1
        : 0) +
      filters.product.length +
      filters.line.length
    );
  });
  readonly distributionFiltersCount = computed(() => {
    const filters = this.distributionFilters();
    return (
      filters.product.length +
      filters.line.length +
      (filters.component === INITIAL_DISTRIBUTION_FILTERS.component ? 0 : 1) +
      this.barChartLimitCount('distribution')
    );
  });
  readonly advancedFiltersCount = computed(() => {
    const filters = this.store.filters();
    return (
      filters.product.length +
      filters.line.length +
      filters.division.length +
      filters.week.length +
      (filters.component === INITIAL_DASHBOARD_FILTERS.component ? 0 : 1)
    );
  });

  readonly evolutionDataSource = computed(() => this.evolutionSnapshot() ?? this.store.snapshot());
  readonly monthlyPerformanceData = computed(() => this.buildMonthlyPerformanceData());
  readonly weeklyData = computed(() => this.buildWeeklyData());
  readonly performanceData = computed(() => {
    return this.evolutionView() === 'monthly' ? this.monthlyPerformanceData() : this.weeklyData();
  });
  readonly performanceLabels = computed(() => {
    if (this.evolutionView() === 'weekly') return this.weeklyData().map((point) => point.month);
    const period = this.evolutionFilters().period;
    return period === INITIAL_EVOLUTION_FILTERS.period ? null : [this.periodOptionLabel(period)];
  });
  readonly distributionData = computed(() => {
    return this.buildDistributionData();
  });
  readonly relativeProductData = computed(() =>
    this.store
      .snapshot()
      .relativeProducts.filter((item) => item.rate !== null)
      .slice(0, 10),
  );
  readonly hasRelativeProductData = computed(() => this.relativeProductData().length > 0);
  readonly hasPerformanceData = computed(() => {
    const metric = this.store.metric();
    const analysis = this.store.analysis();

    return this.performanceData().some((point) => {
      const actual = metric === 'usd' ? point.actualUsd : point.actualQty;
      const reference = metric === 'usd' ? point.previousUsd : point.previousQty;
      const target = metric === 'usd' ? point.targetUsd : point.targetQty;

      if (analysis === 'relative') return actual !== null && actual > 0;
      return [actual, reference, target].some((value) => value !== null && value > 0);
    });
  });
  readonly hasDistributionData = computed(() => {
    const metric = this.store.metric();
    return this.distributionData().some((item) => (metric === 'usd' ? item.usd : item.qty) > 0);
  });

  readonly linesData = computed(() =>
    this.filterRankingData(this.store.snapshot().lines ?? [], 'lines').slice(
      0,
      this.barChartLimit('lines'),
    ),
  );
  readonly modelsData = computed(() =>
    this.filterRankingData(this.store.snapshot().models ?? [], 'models').slice(
      0,
      this.barChartLimit('models'),
    ),
  );
  readonly offendersData = computed(() =>
    this.filterRankingData(this.store.snapshot().offenders ?? [], 'offenders').slice(
      0,
      this.barChartLimit('offenders'),
    ),
  );
  readonly componentsData = computed(() =>
    this.filterRankingData(this.store.snapshot().components ?? [], 'components').slice(
      0,
      this.barChartLimit('components'),
    ),
  );
  readonly linesFilterOptions = computed(() =>
    this.rankingOptions(this.store.snapshot().lines ?? []),
  );
  readonly modelsFilterOptions = computed(() =>
    this.rankingOptions(this.store.snapshot().models ?? []),
  );
  readonly componentsFilterOptions = computed(() =>
    this.rankingOptions(this.store.snapshot().components ?? []),
  );
  readonly offendersFilterOptions = computed(() =>
    this.rankingOptions(this.store.snapshot().offenders ?? []),
  );

  readonly hasLinesData = computed(() =>
    this.linesData().some((item) => item.usd > 0 || item.qty > 0),
  );
  readonly hasModelsData = computed(() =>
    this.modelsData().some((item) => item.usd > 0 || item.qty > 0),
  );
  readonly hasOffendersData = computed(() =>
    this.offendersData().some((item) => item.usd > 0 || item.qty > 0),
  );
  readonly hasComponentsData = computed(() =>
    this.componentsData().some((item) => item.usd > 0 || item.qty > 0),
  );

  private evolutionRequestSequence = 0;

  constructor() {
    effect(() => {
      if (this.store.analysis() === 'relative' && this.evolutionView() === 'weekly') {
        this.selectEvolutionView('monthly');
      }
    });
    effect((onCleanup) => {
      this.dashboardStatus.set(`${this.text().updated} ${this.lastUpdatedLabel()}`);
      onCleanup(() => this.dashboardStatus.clear());
    });
    effect(() => {
      const filters = this.evolutionQueryFilters();
      const metric = this.store.metric();
      const requestId = ++this.evolutionRequestSequence;

      // O snapshot principal já contém a mesma série quando o gráfico local
      // usa os filtros globais. Evita uma segunda chamada idêntica ao abrir a tela.
      if (this.dashboardFiltersEqual(filters, this.store.filters())) {
        this.evolutionSnapshot.set(null);
        return;
      }

      void this.store.loadChartSnapshot(filters, metric).then((snapshot) => {
        if (requestId === this.evolutionRequestSequence) {
          this.evolutionSnapshot.set(snapshot);
        }
      });
    });
  }

  changeYear(value: string): void {
    this.store.setFilter('year', value);
  }

  changePeriod(value: string): void {
    this.store.setFilter('period', value);
  }

  changeComponent(value: string): void {
    this.store.setFilter('component', value);
  }

  changeMultiFilter(key: DashboardMultiFilterKey, values: readonly string[]): void {
    this.store.setFilter(key, values);
  }

  selectMetric(metric: DashboardMetric): void {
    this.store.setMetric(metric);
  }

  toggleMetric(): void {
    this.selectMetric(this.store.metric() === 'usd' ? 'qty' : 'usd');
  }

  selectAnalysis(analysis: DashboardAnalysis): void {
    this.store.setAnalysis(analysis);
  }

  toggleAnalysis(): void {
    this.selectAnalysis(this.store.analysis() === 'absolute' ? 'relative' : 'absolute');
  }

  onComparisonChange(value: string): void {
    this.store.setComparison(value as DashboardComparison);
  }

  selectEvolutionView(view: DashboardEvolutionView): void {
    if (view === 'weekly' && this.store.analysis() === 'relative') return;
    this.evolutionView.set(view);
    if (view === 'monthly') this.changeEvolutionPeriod(INITIAL_EVOLUTION_FILTERS.period);
  }

  toggleEvolutionFilters(): void {
    this.evolutionFiltersOpen.update((open) => !open);
  }

  toggleDistributionFilters(): void {
    this.distributionFiltersOpen.update((open) => !open);
  }

  changeEvolutionPeriod(value: string): void {
    this.evolutionFilters.update((filters) => ({
      ...filters,
      period: value,
    }));
  }

  changeEvolutionMultiFilter(
    key: DashboardEvolutionMultiFilterKey,
    values: readonly string[],
  ): void {
    this.evolutionFilters.update((filters) => ({ ...filters, [key]: values }));
  }

  clearEvolutionFilters(): void {
    this.evolutionFilters.set({ ...INITIAL_EVOLUTION_FILTERS });
  }

  changeDistributionMultiFilter(
    key: DashboardDistributionMultiFilterKey,
    values: readonly string[],
  ): void {
    this.distributionFilters.update((filters) => ({ ...filters, [key]: values }));
  }

  changeDistributionComponent(value: string): void {
    this.distributionFilters.update((filters) => ({
      ...filters,
      component: value,
    }));
  }

  clearDistributionFilters(): void {
    this.distributionFilters.set({ ...INITIAL_DISTRIBUTION_FILTERS });
    this.resetBarChartLimit('distribution');
  }

  changeRankingFilter(key: DashboardRankingKey, values: readonly string[]): void {
    this.rankingFilters.update((filters) => ({ ...filters, [key]: values }));
  }

  clearRankingFilters(key: DashboardRankingKey): void {
    this.rankingFilters.update((filters) => ({ ...filters, [key]: [] }));
    this.resetBarChartLimit(key);
  }

  rankingFiltersCount(key: DashboardRankingKey): number {
    return this.rankingFilters()[key].length + this.barChartLimitCount(key);
  }

  barChartLimit(key: DashboardBarChartKey): DashboardRankingLimit {
    return this.barChartLimits()[key];
  }

  barChartLimitValue(key: DashboardBarChartKey): string {
    return `${this.barChartLimit(key)}`;
  }

  barChartTitle(key: DashboardBarChartKey, defaultTitle: string): string {
    return defaultTitle.replace('{count}', this.barChartLimitValue(key));
  }

  changeBarChartLimit(key: DashboardBarChartKey, value: string): void {
    const limit: DashboardRankingLimit = value === '5' ? 5 : 10;
    this.barChartLimits.update((limits) => ({ ...limits, [key]: limit }));
  }

  advancedFiltersLabel(): string {
    const count = this.advancedFiltersCount();
    return count > 0 ? `${this.text().moreFilters} (${count})` : this.text().moreFilters;
  }

  evolutionFiltersLabel(): string {
    const count = this.evolutionFiltersCount();
    return count > 0 ? `${this.text().chartFilters} (${count})` : this.text().chartFilters;
  }

  distributionFiltersLabel(): string {
    const count = this.distributionFiltersCount();
    return count > 0 ? `${this.text().chartFilters} (${count})` : this.text().chartFilters;
  }

  filterChipLabel(key: string): string {
    const labels: Record<string, string> = {
      product: this.text().product,
      line: this.text().line,
      division: this.text().division,
      week: this.text().week,
      component: this.text().component,
    };
    return labels[key] ?? key;
  }

  filterChipValue(values: readonly string[]): string {
    return values.length > 2 ? `${values.length} ${this.text().selectedPlural}` : values.join(', ');
  }

  evolutionFilterSummary(): string {
    const filters = this.evolutionFilters();
    return [
      ...(this.evolutionView() === 'weekly'
        ? [`${this.text().period}: ${this.periodOptionLabel(filters.period)}`]
        : []),
      `${this.text().product}: ${this.selectionSummary(filters.product, this.text().allMasculine)}`,
      `${this.text().line}: ${this.selectionSummary(filters.line, this.text().allFeminine)}`,
    ].join(' · ');
  }

  distributionFilterSummary(): string {
    const filters = this.distributionFilters();
    return [
      `${this.text().product}: ${this.selectionSummary(filters.product, this.text().allMasculine)}`,
      `${this.text().line}: ${this.selectionSummary(filters.line, this.text().allFeminine)}`,
      `${this.text().component}: ${filters.component}`,
    ].join(' · ');
  }

  comparisonOptionLabel(option: DashboardComparison): string {
    const labels: Record<DashboardComparison, string> = {
      ytd: this.text().compareYtd,
      yoy: this.text().compareYoy,
      mom: this.text().compareMom,
    };
    return labels[option];
  }

  summaryHeadline(): string {
    if (this.store.analysis() === 'relative') return this.text().summaryRelative;
    return this.targetGapReached()
      ? this.text().summaryOnTarget
      : this.text().summaryNeedsAttention;
  }

  summaryDetail(): string {
    const variation =
      this.store.analysis() === 'relative'
        ? this.store.relativeKpis().variation
        : this.store.kpis().variation;

    return `${this.text().comparisonReference}: ${this.comparisonLabel()} · ${this.formatPercentage(variation)}`;
  }

  summaryMetricLabel(): string {
    return this.store.metric() === 'usd' ? 'IF Cost' : 'QTY Scrap';
  }

  relativeVariationIsFavorable(): boolean {
    const variation = this.store.relativeKpis().variation;
    return variation !== null && variation <= 0;
  }

  relativeVariationIsUnfavorable(): boolean {
    const variation = this.store.relativeKpis().variation;
    return variation !== null && variation > 0;
  }

  performanceTitle(): string {
    if (this.store.analysis() === 'absolute') {
      if (this.store.metric() === 'qty') {
        return this.evolutionView() === 'monthly'
          ? this.text().monthlyQtyActual
          : this.text().weeklyQtyActual;
      }
      return this.evolutionView() === 'monthly'
        ? this.text().monthlyTargetActual
        : this.text().weeklyTargetActual;
    }

    if (this.store.metric() === 'usd') {
      return this.evolutionView() === 'monthly'
        ? this.text().ifCostRateMonthly
        : this.text().ifCostRateWeekly;
    }

    return this.evolutionView() === 'monthly'
      ? this.text().qtyRateMonthly
      : this.text().qtyRateWeekly;
  }

  performanceSubtitle(): string {
    if (this.evolutionView() === 'weekly') return this.text().currentMonthWeeks;
    if (this.store.analysis() === 'relative') return this.text().lowerIsBetter;

    return `${this.store.metric() === 'usd' ? 'IF Cost' : 'QTY Scrap'} · ${this.store.filters().year}`;
  }

  formatPrimaryValue(value: number): string {
    if (this.store.metric() === 'usd') {
      if (this.store.monetaryValuesHidden()) return 'US$ •••••';
      return new Intl.NumberFormat(this.locale(), {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(value);
    }
    return `${this.formatNumber(value)} ${this.text().units}`;
  }

  formatPercentage(value: number | null, showPositiveSign = true): string {
    if (value === null) return '—';
    const sign = showPositiveSign && value > 0 ? '+' : '';
    return `${sign}${new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 1 }).format(value)}%`;
  }

  targetAchievementDeltaLabel(): string {
    const delta = this.store.kpis().achievement - 100;
    if (Math.abs(delta) < 0.05) return this.text().targetGapOnTrack;

    const formattedDelta = new Intl.NumberFormat(this.locale(), {
      maximumFractionDigits: 1,
    }).format(Math.abs(delta));
    const direction = delta > 0 ? this.text().targetGapAbove : this.text().targetGapBelow;

    return `${formattedDelta} ${this.text().percentagePoints} ${direction}`;
  }

  targetGapValueLabel(): string {
    const gap = this.targetGapValue();
    return gap <= 0 ? this.text().targetGapReached : this.formatPrimaryValue(gap);
  }

  targetGapHintLabel(): string {
    const gap = this.targetGapValue();
    return gap <= 0 ? this.text().targetGapOnTrack : this.text().targetGapExceeded;
  }

  targetGapReached(): boolean {
    return this.targetGapValue() <= 0;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 0 }).format(value);
  }

  formatRate(value: number | null): string {
    if (value === null) return '—';
    return `${new Intl.NumberFormat(this.locale(), {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value)}%`;
  }

  formatDenominator(value: number | null): string {
    if (value === null) return '—';
    return this.store.metric() === 'usd'
      ? this.formatPrimaryValue(value)
      : `${this.formatNumber(value)} ${this.text().units}`;
  }

  previousYear(): number {
    return Number(this.store.filters().year) - 1;
  }

  periodOptionLabel(value: string): string {
    return value === 'ytd' ? this.accumulatedLabel() : this.months()[Number(value)];
  }

  periodLabel(): string {
    const selected = this.store.filters().period;
    if (selected !== 'ytd') return this.months()[Number(selected)];
    return this.store.comparison() === 'ytd'
      ? this.accumulatedLabel()
      : this.months()[this.currentComparisonMonthIndex()];
  }

  comparisonLabel(): string {
    const comparison = this.store.comparison();
    if (comparison === 'ytd') return `${this.text().sameAccumulated} ${this.previousYear()}`;
    if (comparison === 'mom') return this.previousMonthLabel();
    return `${this.text().sameMonth} ${this.previousYear()}`;
  }

  lastUpdatedLabel(): string {
    const language = this.language.currentLanguage();
    const timestamp = this.store.snapshot().lastUpdatedAt;
    if (!timestamp) return '';
    const locale = language === 'en' ? 'en-US' : language === 'ko' ? 'ko-KR' : 'pt-BR';
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }

  dataStatusLabel(): string {
    const state = this.store.dataState();
    if (state === 'api') return this.text().apiData;
    if (state === 'api-empty') return this.text().apiEmptyData;
    if (state === 'loading') return this.text().loadingData;
    return 'Erro ao carregar dados';
  }

  performanceEmptyStateHint(): string {
    return this.store.analysis() === 'relative'
      ? this.text().noRelativeDataHint
      : this.text().noChartDataHint;
  }

  distributionEmptyStateHint(): string {
    return this.distributionFiltersCount() > 0
      ? this.text().noChartDataHint
      : this.text().noChartData;
  }

  private accumulatedLabel(): string {
    const language = this.language.currentLanguage();
    if (language === 'en') return 'YTD';
    if (language === 'ko') return '누계';
    return 'Acumulado';
  }

  private currentComparisonMonthIndex(): number {
    const selected = this.store.filters().period;
    if (selected !== 'ytd') return Number(selected);

    const points = this.store.snapshot().monthly;
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      if (point.actualUsd !== null || point.actualQty !== null) return index;
    }

    return 0;
  }

  private previousMonthLabel(): string {
    const monthIndex = this.currentComparisonMonthIndex();
    return monthIndex > 0
      ? this.months()[monthIndex - 1]
      : `${this.text().sameMonth} ${this.previousYear()}`;
  }

  private targetGapValue(): number {
    const kpis = this.store.kpis();
    return Math.max(0, kpis.actual - kpis.target);
  }

  private buildMonthlyPerformanceData(): readonly DashboardMonthlyPoint[] {
    return this.evolutionDataSource().monthly;
  }

  private buildDistributionData(): readonly DashboardDistributionItem[] {
    const filters = this.distributionFilters();
    const data = this.store.snapshot().distribution;
    const labelFilter = filters.product;

    return data
      .filter((item) => !labelFilter.length || labelFilter.includes(item.label))
      .slice(0, this.barChartLimit('distribution'));
  }

  private barChartLimitCount(key: DashboardBarChartKey): number {
    return this.barChartLimit(key) === INITIAL_BAR_CHART_LIMITS[key] ? 0 : 1;
  }

  private resetBarChartLimit(key: DashboardBarChartKey): void {
    this.barChartLimits.update((limits) => ({
      ...limits,
      [key]: INITIAL_BAR_CHART_LIMITS[key],
    }));
  }

  private filterRankingData(
    data: readonly DashboardDistributionItem[],
    key: DashboardRankingKey,
  ): readonly DashboardDistributionItem[] {
    const selected = this.rankingFilters()[key];
    return selected.length ? data.filter((item) => selected.includes(item.label)) : data;
  }

  private rankingOptions(data: readonly DashboardDistributionItem[]): readonly string[] {
    return [...new Set(data.map((item) => item.label))];
  }

  private buildWeeklyData(): readonly DashboardMonthlyPoint[] {
    const snapshot = this.evolutionDataSource();
    if (!snapshot.weekly?.length) {
      return [];
    }

    const chartPeriod = this.evolutionFilters().period;
    if (chartPeriod !== INITIAL_EVOLUTION_FILTERS.period) {
      const monthIndex = Number(chartPeriod);
      const startWeek = Math.floor(monthIndex * 4.33) + 1;
      const endWeek = Math.floor((monthIndex + 1) * 4.33) + (monthIndex === 11 ? 5 : 0);
      return snapshot.weekly.filter((point) => {
        const weekNum = Number(point.month.replace('W', ''));
        return !isNaN(weekNum) && weekNum >= startWeek && weekNum <= endWeek;
      });
    }

    return snapshot.weekly;
  }

  private evolutionQueryFilters(): DashboardFilters {
    const globalFilters = this.store.filters();
    const localFilters = this.evolutionFilters();

    return {
      ...globalFilters,
      // No modo mensal, o gráfico compara sempre toda a trajetória anual.
      // O período local só determina o recorte do modo semanal.
      period:
        this.evolutionView() === 'weekly' ? localFilters.period : INITIAL_EVOLUTION_FILTERS.period,
      product: this.intersectFilters(globalFilters.product, localFilters.product),
      line: this.intersectFilters(globalFilters.line, localFilters.line),
    };
  }

  private intersectFilters(
    globalValues: readonly string[],
    localValues: readonly string[],
  ): readonly string[] {
    if (!globalValues.length) return localValues;
    if (!localValues.length) return globalValues;
    return globalValues.filter((value) => localValues.includes(value));
  }

  private dashboardFiltersEqual(left: DashboardFilters, right: DashboardFilters): boolean {
    const keys: (keyof DashboardFilters)[] = [
      'year',
      'period',
      'component',
      'product',
      'line',
      'division',
      'week',
    ];
    return keys.every((key) => {
      const leftValue = left[key];
      const rightValue = right[key];
      if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
        return (
          leftValue.length === rightValue.length &&
          leftValue.every((value, index) => value === rightValue[index])
        );
      }
      return leftValue === rightValue;
    });
  }

  private selectionSummary(values: readonly string[], allLabel: string): string {
    if (!values.length) return allLabel;
    if (values.length === 1) return values[0];
    return `${values.length} ${this.text().selectedPlural}`;
  }
}
