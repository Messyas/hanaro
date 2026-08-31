import { Component, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { LineChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ThemeService } from '../theme/theme.service';
import { LanguageCode } from '../i18n/language.service';
import { CHART_DESIGN } from './chart-design.tokens';
import {
  DashboardAnalysis,
  DashboardMetric,
  DashboardMonthlyPoint,
} from '../pages/dashboard/dashboard.models';
import {
  DASHBOARD_LOCALES,
  DASHBOARD_MONTHS,
  DASHBOARD_TRANSLATIONS,
} from '../pages/dashboard/dashboard.translations';

echarts.use([
  LineChart,
  LegendComponent,
  GridComponent,
  TooltipComponent,
  AriaComponent,
  SVGRenderer,
]);

@Component({
  selector: 'app-dashboard-performance-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  template: `
    @if (chartReady()) {
      <div
        echarts
        class="performance-chart"
        role="img"
        [attr.aria-label]="
          analysis() === 'relative'
            ? copy().performanceRelativeAria
            : copy().performanceAbsoluteAria
        "
        [options]="options()"
        [initOpts]="initOptions"
        [autoResize]="true"
      ></div>
    } @else {
      <div class="chart-placeholder" aria-hidden="true">
        @for (item of data(); track item.month) {
          <span [style.height.%]="placeholderHeight(item)"></span>
        }
      </div>
    }

    <table class="sr-only">
      <caption>
        {{
          analysis() === 'relative' ? 'Scrap Rate' : 'IF Cost'
        }}
      </caption>
      <thead>
        <tr>
          <th>{{ copy().month }}</th>
          <th>{{ copy().actual }} {{ year() }}</th>
          <th>{{ copy().reference }} {{ previousYear() }}</th>
          @if (analysis() === 'absolute') {
            <th>{{ metric() === 'usd' ? 'Target IF Cost' : 'Target QTY' }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (item of data(); track item.month) {
          <tr>
            <td>{{ monthLabel($index) }}</td>
            <td>{{ accessibleValue(actualValue(item)) }}</td>
            <td>{{ accessibleValue(previousValue(item)) }}</td>
            @if (analysis() === 'absolute') {
              <td>{{ accessibleValue(targetValue(item)) }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 1rem;
    }
    .performance-chart {
      width: 100%;
      height: 16.5rem;
    }
    .chart-placeholder {
      display: flex;
      height: 16.5rem;
      align-items: end;
      justify-content: space-around;
      gap: 0.75rem;
      border-bottom: 1px solid var(--app-chart-grid);
      padding: 1rem 1.5rem 0;
    }
    .chart-placeholder span {
      width: min(2rem, 9%);
      border-radius: 0.4rem 0.4rem 0 0;
      background: var(--brand-primary-soft);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      clip-path: inset(50%);
    }
    @media (max-width: 760px) {
      .performance-chart,
      .chart-placeholder {
        height: 13rem;
      }
    }
  `,
})
export class DashboardPerformanceChart {
  private readonly theme = inject(ThemeService);

  readonly data = input.required<readonly DashboardMonthlyPoint[]>();
  readonly metric = input.required<DashboardMetric>();
  readonly analysis = input.required<DashboardAnalysis>();
  readonly year = input.required<string>();
  readonly language = input.required<LanguageCode>();
  readonly labels = input<readonly string[] | null>(null);
  readonly monetaryValuesHidden = input(false);
  readonly copy = computed(() => DASHBOARD_TRANSLATIONS[this.language()]);
  readonly chartReady = signal(false);
  readonly initOptions = { renderer: 'svg' as const };

  readonly options = computed<EChartsCoreOption>(() => {
    this.theme.isDark();
    const metric = this.metric();
    const analysis = this.analysis();
    const data = this.data();
    const hidden = analysis === 'absolute' && metric === 'usd' && this.monetaryValuesHidden();
    const currentYear = this.year();
    const previousYear = String(Number(currentYear) - 1);
    const copy = this.copy();

    return {
      animationDuration: 450,
      textStyle: { fontFamily: CHART_DESIGN.fontFamily },
      aria: {
        show: true,
        description:
          analysis === 'relative' ? copy.performanceRelativeAria : copy.performanceAbsoluteAria,
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: {
          color: CHART_DESIGN.mutedText,
          fontFamily: CHART_DESIGN.fontFamily,
          fontSize: 12,
        },
      },
      grid: { top: 42, right: 8, bottom: 8, left: 8, containLabel: true },
      tooltip: {
        show: !hidden,
        trigger: 'axis',
        backgroundColor: CHART_DESIGN.surface,
        borderColor: CHART_DESIGN.grid,
        borderWidth: 1,
        padding: [8, 10],
        textStyle: {
          color: CHART_DESIGN.text,
          fontFamily: CHART_DESIGN.fontFamily,
          fontSize: 12,
        },
        axisPointer: { type: 'line', lineStyle: { color: CHART_DESIGN.grid } },
      },
      xAxis: {
        type: 'category',
        data: this.periodLabels(data.length),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: CHART_DESIGN.mutedText,
          fontFamily: CHART_DESIGN.fontFamily,
          fontSize: 12,
          margin: 12,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: CHART_DESIGN.mutedText,
          fontFamily: CHART_DESIGN.fontFamily,
          fontSize: 11,
          formatter: hidden
            ? () => '•••'
            : (value: number) =>
                analysis === 'relative'
                  ? `${value.toLocaleString(DASHBOARD_LOCALES[this.language()], { maximumFractionDigits: 3 })}%`
                  : metric === 'usd'
                    ? this.compactCurrency(value)
                    : `${value}`,
        },
        splitLine: { lineStyle: { color: CHART_DESIGN.grid } },
      },
      series: [
        {
          name:
            analysis === 'relative'
              ? `${metric === 'usd' ? copy.ifCostRate : copy.qtyRate} ${currentYear}`
              : metric === 'usd'
                ? `${copy.actual} ${currentYear}`
                : `QTY ${currentYear}`,
          type: 'line',
          data: data.map((item) => this.actualValue(item)),
          smooth: true,
          symbol: 'circle',
          lineStyle: { width: 3, color: CHART_DESIGN.primary },
          itemStyle: { color: CHART_DESIGN.primary },
        },
        {
          name: `${copy.reference} ${previousYear}`,
          type: 'line',
          data: data.map((item) => this.previousValue(item)),
          smooth: true,
          symbol: 'circle',
          lineStyle: { width: 2, color: '#66728d' },
          itemStyle: { color: '#66728d' },
        },
        ...(analysis === 'absolute'
          ? [
              {
                name: metric === 'usd' ? 'Target IF Cost' : 'Target QTY',
                type: 'line',
                data: data.map((item) => this.targetValue(item)),
                smooth: true,
                symbol: 'circle',
                lineStyle: { width: 2, type: 'dashed', color: '#5ad6b3' },
                itemStyle: { color: '#5ad6b3' },
              },
            ]
          : []),
      ],
    };
  });

  constructor() {
    afterNextRender(() => {
      this.chartReady.set(typeof ResizeObserver !== 'undefined');
    });
  }

  actualValue(item: DashboardMonthlyPoint): number | null {
    const numerator = this.metric() === 'usd' ? item.actualUsd : item.actualQty;
    if (this.analysis() === 'absolute' || numerator === null) return numerator;
    const denominator = this.metric() === 'usd' ? item.materialAmountUsd : item.productionQty;
    return denominator > 0 ? (numerator / denominator) * 100 : null;
  }

  previousValue(item: DashboardMonthlyPoint): number | null {
    const numerator = this.metric() === 'usd' ? item.previousUsd : item.previousQty;
    if (this.analysis() === 'absolute' || numerator === null) return numerator;
    const denominator =
      this.metric() === 'usd' ? item.previousMaterialAmountUsd : item.previousProductionQty;
    return denominator > 0 ? (numerator / denominator) * 100 : null;
  }

  targetValue(item: DashboardMonthlyPoint): number {
    return this.metric() === 'usd' ? item.targetUsd : item.targetQty;
  }

  accessibleValue(value: number | null): string {
    if (value === null) return this.copy().noData;
    if (this.analysis() === 'relative') return `${value.toFixed(4)}%`;
    if (this.metric() === 'usd' && this.monetaryValuesHidden()) return this.copy().hiddenValue;
    return this.metric() === 'usd'
      ? this.currency(value)
      : `${this.number(value)} ${this.copy().units}`;
  }

  placeholderHeight(item: DashboardMonthlyPoint): number {
    const value = this.actualValue(item) ?? 0;
    if (this.analysis() === 'relative') return Math.min(92, Math.max(4, value * 550));
    return Math.min(92, Math.max(4, this.metric() === 'usd' ? value / 500 : value / 3));
  }

  previousYear(): number {
    return Number(this.year()) - 1;
  }

  monthLabel(index: number): string {
    return this.periodLabels(this.data().length)[index];
  }

  private periodLabels(length: number): readonly string[] {
    return this.labels() ?? DASHBOARD_MONTHS[this.language()].slice(0, length);
  }

  private compactCurrency(value: number): string {
    return value >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`;
  }

  private currency(value: number): string {
    return new Intl.NumberFormat(DASHBOARD_LOCALES[this.language()], {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  private number(value: number): string {
    return new Intl.NumberFormat(DASHBOARD_LOCALES[this.language()], {
      maximumFractionDigits: 0,
    }).format(value);
  }
}
