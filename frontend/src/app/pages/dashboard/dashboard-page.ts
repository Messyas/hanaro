import { Component, computed, inject } from '@angular/core';
import { LanguageService } from '../../i18n/language.service';
import { UiIcon } from '../../ui-icon';
import { DashboardPerformanceChart } from './components/dashboard-performance-chart';
import { DashboardDistributionChart } from './components/dashboard-distribution-chart';
import { DashboardMultiSelect } from './components/dashboard-multi-select';
import {
  DashboardAnalysis,
  DashboardMetric,
  DashboardMultiFilterKey,
  DashboardSingleFilterKey,
} from './dashboard.models';
import { DashboardStore } from './dashboard.store';
import {
  DASHBOARD_LOCALES,
  DASHBOARD_MONTHS,
  DASHBOARD_TRANSLATIONS,
} from './dashboard.translations';

@Component({
  selector: 'app-dashboard-page',
  imports: [UiIcon, DashboardPerformanceChart, DashboardDistributionChart, DashboardMultiSelect],
  providers: [DashboardStore],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage {
  readonly store = inject(DashboardStore);
  readonly language = inject(LanguageService);
  readonly text = computed(() => DASHBOARD_TRANSLATIONS[this.language.currentLanguage()]);
  readonly locale = computed(() => DASHBOARD_LOCALES[this.language.currentLanguage()]);
  readonly months = computed(() => DASHBOARD_MONTHS[this.language.currentLanguage()]);

  changeFilter(key: DashboardSingleFilterKey, event: Event): void {
    this.store.setFilter(key, (event.target as HTMLSelectElement).value);
  }

  changeMultiFilter(key: DashboardMultiFilterKey, values: readonly string[]): void {
    this.store.setFilter(key, values);
  }

  selectMetric(metric: DashboardMetric): void {
    this.store.setMetric(metric);
  }

  selectAnalysis(analysis: DashboardAnalysis): void {
    this.store.setAnalysis(analysis);
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

  filterChipValue(values: readonly string[]): string {
    return values.length > 2 ? `${values.length} ${this.text().selectedPlural}` : values.join(', ');
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

  periodOptionLabel(value: string): string {
    return value === 'ytd' ? this.accumulatedLabel() : this.months()[Number(value)];
  }

  periodLabel(): string {
    const selected = this.store.filters().period;
    return selected === 'ytd' ? this.accumulatedLabel() : this.months()[Number(selected)];
  }

  comparisonLabel(): string {
    const selected = this.store.filters().period;
    if (selected === 'ytd') return `${this.text().sameAccumulated} ${this.previousYear()}`;
    const monthIndex = Number(selected);
    return monthIndex > 0
      ? this.months()[monthIndex - 1]
      : `${this.text().sameMonth} ${this.previousYear()}`;
  }

  lastUpdatedLabel(): string {
    const language = this.language.currentLanguage();
    if (language === 'en') return 'Today, 10:00';
    if (language === 'ko') return '오늘 10:00';
    return this.store.snapshot().lastUpdatedAt;
  }

  private accumulatedLabel(): string {
    const language = this.language.currentLanguage();
    if (language === 'en') return 'Year to date';
    if (language === 'ko') return '연간 누계';
    return 'Acumulado no ano';
  }
}
