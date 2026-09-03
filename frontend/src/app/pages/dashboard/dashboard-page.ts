import { Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../i18n/language.service';
import { UiIcon } from '../../ui-icon';
import { DashboardPerformanceChart } from './components/dashboard-performance-chart';
import { DashboardDistributionChart } from './components/dashboard-distribution-chart';
import { DashboardChartFilterPanel } from './components/dashboard-chart-filter-panel';
import { DashboardMultiSelect } from './components/dashboard-multi-select';
import {
  DashboardAnalysis,
  DashboardComparison,
  DashboardDistributionItem,
  DashboardEvolutionView,
  DashboardMetric,
  DashboardMonthlyPoint,
  DashboardRankingLimit,
} from './dashboard.models';
import { DashboardStore, INITIAL_DASHBOARD_FILTERS } from './dashboard.store';
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

interface DashboardRankingEntry {
  label: string;
  value: string;
  hint: string;
  tooltipMetric: string;
  tooltipValue: string;
  progress: number;
}

interface DashboardRankingPanel {
  title: string;
  eyebrow: string;
  items: readonly DashboardRankingEntry[];
}

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

const PRODUCT_FACTORS: Record<string, number> = {
  BM: 0.27,
  VS: 0.25,
  AV: 0.21,
  TV: 0.17,
  MNT: 0.1,
  SMT: 0.08,
  IPI: 0.07,
  FA: 0.06,
  MFG: 0.05,
  QA: 0.04,
};

const LINE_FACTORS: Record<string, number> = {
  BMCELL: 0.31,
  Quale: 0.24,
  G08: 0.2,
  C02: 0.15,
  Ventito: 0.1,
};

const COMPONENT_FACTORS: Record<string, number> = {
  Module: 0.32,
  PCBA: 0.27,
  Tape: 0.18,
  Cover: 0.13,
  Chassis: 0.1,
  Panel: 0.09,
  Backlight: 0.08,
  Harness: 0.07,
  Speaker: 0.06,
  Housing: 0.05,
};

const MODEL_FACTORS: readonly { label: string; factor: number; hint: string }[] = [
  { label: 'OLED C4 55"', factor: 0.18, hint: 'BM / BMCELL' },
  { label: 'OLED C3 65"', factor: 0.15, hint: 'BM / Quale' },
  { label: 'QNED 75"', factor: 0.13, hint: 'TV / G08' },
  { label: 'UHD UR8750', factor: 0.11, hint: 'TV / C02' },
  { label: 'Soundbar S95', factor: 0.1, hint: 'AV / Ventito' },
  { label: 'Monitor UltraGear', factor: 0.09, hint: 'MNT / BMCELL' },
  { label: 'Smart Monitor M8', factor: 0.08, hint: 'MNT / Quale' },
  { label: 'Projector CineBeam', factor: 0.06, hint: 'AV / G08' },
  { label: 'Panel Assembly V2', factor: 0.05, hint: 'BM / C02' },
  { label: 'Main Board Rev.C', factor: 0.05, hint: 'SMT / Ventito' },
];

const COMPARISON_OPTIONS: readonly DashboardComparison[] = ['ytd', 'yoy', 'mom'];
const RANKING_CARDS_LIMIT: DashboardRankingLimit = 5;

@Component({
  selector: 'app-dashboard-page',
  imports: [
    UiIcon,
    DashboardPerformanceChart,
    DashboardDistributionChart,
    DashboardChartFilterPanel,
    DashboardMultiSelect,
  ],
  providers: [DashboardStore],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage {
  readonly store = inject(DashboardStore);
  readonly language = inject(LanguageService);
  readonly evolutionFiltersOpen = signal(false);
  readonly distributionFiltersOpen = signal(false);
  readonly evolutionView = signal<DashboardEvolutionView>('monthly');
  readonly evolutionFilters = signal<DashboardEvolutionFilters>({ ...INITIAL_EVOLUTION_FILTERS });
  readonly distributionFilters = signal<DashboardDistributionFilters>({
    ...INITIAL_DISTRIBUTION_FILTERS,
  });
  readonly text = computed(() => DASHBOARD_TRANSLATIONS[this.language.currentLanguage()]);
  readonly locale = computed(() => DASHBOARD_LOCALES[this.language.currentLanguage()]);
  readonly months = computed(() => DASHBOARD_MONTHS[this.language.currentLanguage()]);
  readonly weeklyLabels = computed(() => this.store.options.weeks);
  readonly comparisonOptions = COMPARISON_OPTIONS;
  readonly evolutionFiltersCount = computed(() => {
    const filters = this.evolutionFilters();
    return (
      (filters.period === INITIAL_EVOLUTION_FILTERS.period ? 0 : 1) +
      filters.product.length +
      filters.line.length
    );
  });
  readonly distributionFiltersCount = computed(() => {
    const filters = this.distributionFilters();
    return (
      filters.product.length +
      filters.line.length +
      (filters.component === INITIAL_DISTRIBUTION_FILTERS.component ? 0 : 1)
    );
  });
  readonly monthlyPerformanceData = computed(() => this.buildMonthlyPerformanceData());
  readonly weeklyData = computed(() => this.buildWeeklyData(this.monthlyPerformanceData()));
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
  readonly rankingPanels = computed<readonly DashboardRankingPanel[]>(() => [
    {
      title: this.rankingPanelTitle(this.text().topLinesTitle),
      eyebrow: this.text().topLinesEyebrow,
      items: this.lineRankingItems(),
    },
    {
      title: this.rankingPanelTitle(this.text().topModelsTitle),
      eyebrow: this.text().topModelsEyebrow,
      items: this.modelRankingItems(),
    },
    {
      title: this.rankingPanelTitle(this.text().topOffendersTitle),
      eyebrow: this.text().topOffendersEyebrow,
      items: this.offenderRankingItems(),
    },
    {
      title: this.rankingPanelTitle(this.text().topComponentsTitle),
      eyebrow: this.text().topComponentsEyebrow,
      items: this.componentRankingItems(),
    },
  ]);
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
    const analysis = this.store.analysis();

    return this.distributionData().some((item) => {
      const value =
        analysis === 'relative'
          ? metric === 'usd'
            ? (item.relativeUsd ?? 0)
            : (item.relativeQty ?? 0)
          : metric === 'usd'
            ? item.usd
            : item.qty;

      return value > 0;
    });
  });

  selectMetric(metric: DashboardMetric): void {
    this.store.setMetric(metric);
  }

  selectAnalysis(analysis: DashboardAnalysis): void {
    this.store.setAnalysis(analysis);
  }

  selectRankingLimit(limit: DashboardRankingLimit): void {
    this.store.setRankingLimit(limit);
  }

  selectComparison(event: Event): void {
    this.store.setComparison((event.target as HTMLSelectElement).value as DashboardComparison);
  }

  selectEvolutionView(view: DashboardEvolutionView): void {
    this.evolutionView.set(view);
  }

  toggleEvolutionFilters(): void {
    this.evolutionFiltersOpen.update((open) => !open);
  }

  toggleDistributionFilters(): void {
    this.distributionFiltersOpen.update((open) => !open);
  }

  changeEvolutionPeriod(event: Event): void {
    this.evolutionFilters.update((filters) => ({
      ...filters,
      period: (event.target as HTMLSelectElement).value,
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

  changeDistributionComponent(event: Event): void {
    this.distributionFilters.update((filters) => ({
      ...filters,
      component: (event.target as HTMLSelectElement).value,
    }));
  }

  clearDistributionFilters(): void {
    this.distributionFilters.set({ ...INITIAL_DISTRIBUTION_FILTERS });
  }

  evolutionFiltersLabel(): string {
    const count = this.evolutionFiltersCount();
    return count > 0 ? `${this.text().chartFilters} (${count})` : this.text().chartFilters;
  }

  distributionFiltersLabel(): string {
    const count = this.distributionFiltersCount();
    return count > 0 ? `${this.text().chartFilters} (${count})` : this.text().chartFilters;
  }

  evolutionFilterSummary(): string {
    const filters = this.evolutionFilters();
    return [
      `${this.text().period}: ${this.periodOptionLabel(filters.period)}`,
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

  performanceTitle(): string {
    if (this.store.analysis() === 'absolute') {
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

    const period = this.evolutionFilters().period;
    const periodLabel =
      period === INITIAL_EVOLUTION_FILTERS.period
        ? this.store.filters().year
        : this.periodOptionLabel(period);

    return `${this.store.metric() === 'usd' ? 'IF Cost' : 'QTY Scrap'} · ${periodLabel}`;
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

  formatPercentage(value: number, showPositiveSign = true): string {
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
    return this.targetGapValue() <= 0
      ? this.text().targetGapOnTrack
      : this.text().targetGapExceeded;
  }

  targetGapReached(): boolean {
    return this.targetGapValue() <= 0;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 0 }).format(value);
  }

  formatRate(value: number): string {
    return `${new Intl.NumberFormat(this.locale(), {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value)}%`;
  }

  formatDenominator(value: number): string {
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
    if (language === 'en') return 'Today, 10:00';
    if (language === 'ko') return '오늘 10:00';
    return this.store.snapshot().lastUpdatedAt;
  }

  dataStatusLabel(): string {
    const state = this.store.dataState();
    if (state === 'api') return this.text().apiData;
    if (state === 'api-empty') return this.text().apiEmptyData;
    if (state === 'loading') return this.text().loadingData;
    return this.text().simulatedData;
  }

  performanceEmptyStateHint(): string {
    return this.store.analysis() === 'relative'
      ? this.text().noRelativeDataHint
      : this.text().noChartDataHint;
  }

  distributionEmptyStateHint(): string {
    if (this.store.analysis() === 'relative') return this.text().noRelativeDataHint;
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
    const filters = this.evolutionFilters();
    const scaled = this.store
      .snapshot()
      .monthly.map((point) => this.scaleEvolutionPoint(point, this.evolutionScaleFactor(filters)));

    return filters.period === INITIAL_EVOLUTION_FILTERS.period
      ? scaled
      : [scaled[Number(filters.period)] ?? scaled[0]];
  }

  private buildDistributionData(
    limit: DashboardRankingLimit = this.store.rankingLimit(),
  ): readonly DashboardDistributionItem[] {
    const filters = this.distributionFilters();
    const data =
      this.store.analysis() === 'absolute'
        ? this.store.snapshot().distribution
        : this.store.snapshot().relativeDistribution;
    const labelFilter = this.store.analysis() === 'absolute' ? filters.product : filters.line;
    const factor = this.distributionScaleFactor(filters);

    return data
      .filter((item) => !labelFilter.length || labelFilter.includes(item.label))
      .map((item) => this.scaleDistributionItem(item, factor))
      .slice(0, limit);
  }

  private lineRankingItems(): readonly DashboardRankingEntry[] {
    const values = this.store.snapshot().relativeDistribution.map((item) => {
      const relativeValue = this.store.metric() === 'usd' ? item.relativeUsd : item.relativeQty;
      const absoluteValue = this.store.metric() === 'usd' ? item.usd : item.qty;
      const rawValue = relativeValue ?? absoluteValue;

      return {
        label: item.label,
        rawValue,
        value:
          relativeValue === undefined
            ? this.formatRankingImpact(absoluteValue)
            : this.formatRate(rawValue),
        hint:
          relativeValue === undefined
            ? this.text().rankingMetricImpact
            : this.text().rankingMetricRate,
      };
    });

    return this.normalizeRanking(values, RANKING_CARDS_LIMIT);
  }

  private modelRankingItems(): readonly DashboardRankingEntry[] {
    const baseValue = this.currentMetricTotal();
    const values = MODEL_FACTORS.map((model) => {
      const rawValue = Math.round(baseValue * model.factor);
      return {
        label: model.label,
        rawValue,
        value: this.formatRankingImpact(rawValue),
        hint: model.hint,
      };
    });

    return this.normalizeRanking(values, RANKING_CARDS_LIMIT);
  }

  private offenderRankingItems(): readonly DashboardRankingEntry[] {
    const values = this.buildDistributionData(RANKING_CARDS_LIMIT).map((item) => {
      const rawValue = this.store.metric() === 'usd' ? item.usd : item.qty;
      return {
        label: item.label,
        rawValue,
        value: this.formatRankingImpact(rawValue),
        hint: this.text().rankingMetricImpact,
      };
    });

    return this.normalizeRanking(values, RANKING_CARDS_LIMIT);
  }

  private componentRankingItems(): readonly DashboardRankingEntry[] {
    const baseValue = this.currentMetricTotal();
    const values = this.store.options.components.map((component) => {
      const rawValue = Math.round(baseValue * (COMPONENT_FACTORS[component] ?? 0.08));
      return {
        label: component,
        rawValue,
        value: this.formatRankingImpact(rawValue),
        hint: this.text().rankingMetricImpact,
      };
    });

    return this.normalizeRanking(values, RANKING_CARDS_LIMIT);
  }

  private normalizeRanking(
    values: readonly {
      label: string;
      rawValue: number;
      value: string;
      hint: string;
    }[],
    limit: number,
  ): readonly DashboardRankingEntry[] {
    const sorted = [...values].sort((a, b) => b.rawValue - a.rawValue).slice(0, limit);
    const maxValue = sorted[0]?.rawValue ?? 0;

    return sorted.map((item) => ({
      label: item.label,
      value: item.value,
      hint: item.hint,
      tooltipMetric: this.rankingTooltipMetric(item.hint),
      tooltipValue: this.rankingTooltipValue(item.rawValue, item.hint),
      progress: maxValue > 0 ? Math.max(4, (item.rawValue / maxValue) * 100) : 0,
    }));
  }

  private currentMetricTotal(): number {
    return this.store.analysis() === 'relative'
      ? this.store.relativeKpis().numerator
      : this.store.kpis().actual;
  }

  private rankingPanelTitle(label: string): string {
    return `${this.text().topFive} ${label}`;
  }

  private rankingTooltipMetric(hint: string): string {
    if (hint === this.text().rankingMetricRate) return this.text().rankingMetricRate;
    return this.store.metric() === 'usd' ? 'IF Cost' : 'QTY Scrap';
  }

  private rankingTooltipValue(value: number, hint: string): string {
    if (hint === this.text().rankingMetricRate) return this.formatRate(value);
    return this.formatNumber(value);
  }

  private formatRankingImpact(value: number): string {
    return this.store.metric() === 'usd'
      ? this.formatPrimaryValue(value)
      : `${this.formatNumber(value)} ${this.text().units}`;
  }

  private buildWeeklyData(
    points: readonly DashboardMonthlyPoint[],
  ): readonly DashboardMonthlyPoint[] {
    const apiWeekly = this.apiWeeklyData();
    if (apiWeekly.length) return apiWeekly;

    const source = this.selectedWeeklySourcePoint(points);
    const weights = [0.18, 0.2, 0.22, 0.19, 0.21];

    return weights.map((weight, index) => ({
      ...source,
      month: this.weeklyLabels()[index] ?? `W${index + 1}`,
      actualUsd: this.scaleWeeklyValue(source.actualUsd, weight),
      previousUsd: this.scaleWeeklyValue(source.previousUsd, weight * 0.98),
      targetUsd: Math.round(source.targetUsd * weight),
      actualQty: this.scaleWeeklyValue(source.actualQty, weight),
      previousQty: this.scaleWeeklyValue(source.previousQty, weight * 0.98),
      targetQty: Math.round(source.targetQty * weight),
      materialAmountUsd: Math.round(source.materialAmountUsd * weight),
      previousMaterialAmountUsd: Math.round(source.previousMaterialAmountUsd * weight),
      productionQty: Math.round(source.productionQty * weight),
      previousProductionQty: Math.round(source.previousProductionQty * weight),
    }));
  }

  private apiWeeklyData(): readonly DashboardMonthlyPoint[] {
    const snapshot = this.store.snapshot();
    const globalPeriod = this.store.filters().period;
    const chartPeriod = this.evolutionFilters().period;

    if (
      this.store.dataState() !== 'api' ||
      globalPeriod === INITIAL_DASHBOARD_FILTERS.period ||
      chartPeriod !== globalPeriod ||
      !snapshot.weekly.length
    ) {
      return [];
    }

    return snapshot.weekly.map((point) =>
      this.scaleEvolutionPoint(point, this.evolutionScaleFactor(this.evolutionFilters())),
    );
  }

  private selectedWeeklySourcePoint(
    points: readonly DashboardMonthlyPoint[],
  ): DashboardMonthlyPoint {
    const latestPoint = [...points]
      .reverse()
      .find((point) => point.actualUsd !== null || point.actualQty !== null);
    return latestPoint ?? points[0];
  }

  private scaleWeeklyValue(value: number | null, weight: number): number | null {
    return value === null ? null : Math.round(value * weight);
  }

  private scaleEvolutionPoint(point: DashboardMonthlyPoint, factor: number): DashboardMonthlyPoint {
    return {
      ...point,
      actualUsd: this.scaleWeeklyValue(point.actualUsd, factor),
      previousUsd: this.scaleWeeklyValue(point.previousUsd, factor),
      targetUsd: Math.round(point.targetUsd * factor),
      actualQty: this.scaleWeeklyValue(point.actualQty, factor),
      previousQty: this.scaleWeeklyValue(point.previousQty, factor),
      targetQty: Math.round(point.targetQty * factor),
      materialAmountUsd: Math.round(point.materialAmountUsd * factor),
      previousMaterialAmountUsd: Math.round(point.previousMaterialAmountUsd * factor),
      productionQty: Math.round(point.productionQty * factor),
      previousProductionQty: Math.round(point.previousProductionQty * factor),
    };
  }

  private evolutionScaleFactor(filters: DashboardEvolutionFilters): number {
    const productFactor = this.selectedLocalFactor(filters.product, PRODUCT_FACTORS);
    const lineFactor = this.selectedLocalFactor(filters.line, LINE_FACTORS);

    return productFactor * lineFactor;
  }

  private distributionScaleFactor(filters: DashboardDistributionFilters): number {
    const productFactor = this.selectedLocalFactor(filters.product, PRODUCT_FACTORS);
    const lineFactor = this.selectedLocalFactor(filters.line, LINE_FACTORS);
    const componentFactor =
      filters.component === INITIAL_DISTRIBUTION_FILTERS.component
        ? 1
        : (COMPONENT_FACTORS[filters.component] ?? 1);

    return productFactor * lineFactor * componentFactor;
  }

  private scaleDistributionItem(
    item: DashboardDistributionItem,
    factor: number,
  ): DashboardDistributionItem {
    return {
      ...item,
      usd: Math.round(item.usd * factor),
      qty: Math.round(item.qty * factor),
      relativeUsd: item.relativeUsd === undefined ? undefined : item.relativeUsd * factor,
      relativeQty: item.relativeQty === undefined ? undefined : item.relativeQty * factor,
    };
  }

  private selectedLocalFactor(values: readonly string[], factors: Record<string, number>): number {
    if (!values.length) return 1;
    return values.reduce((sum, value) => sum + (factors[value] ?? 0), 0) || 1;
  }

  private selectionSummary(values: readonly string[], allLabel: string): string {
    if (!values.length) return allLabel;
    if (values.length === 1) return values[0];
    return `${values.length} ${this.text().selectedPlural}`;
  }
}
