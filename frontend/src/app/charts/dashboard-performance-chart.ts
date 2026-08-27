import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ThemeService } from '../theme/theme.service';
import { CHART_DESIGN } from './chart-design.tokens';

interface MonthlyScrapPerformance {
  month: string;
  actual: number | null;
  reference: number | null;
  target: number;
}

echarts.use([LineChart, LegendComponent, GridComponent, TooltipComponent, AriaComponent, SVGRenderer]);

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
        aria-label="IF Cost mensal comparando realizado, referência e target"
        [options]="options()"
        [initOpts]="initOptions"
        [autoResize]="true"
      ></div>
    } @else {
      <div class="chart-placeholder" aria-hidden="true">
        @for (item of data; track item.month) {
          <span [style.height.%]="(item.actual ?? 0) * 2"></span>
        }
      </div>
    }

    <table class="sr-only">
      <caption>
        IF Cost mensal
      </caption>
      <thead>
        <tr>
          <th>Mês</th>
          <th>Realizado 2026</th>
          <th>Referência 2025</th>
          <th>Target</th>
        </tr>
      </thead>
      <tbody>
        @for (item of data; track item.month) {
          <tr>
            <td>{{ item.month }}</td>
            <td>{{ item.actual ?? '-' }}k</td>
            <td>{{ item.reference ?? '-' }}k</td>
            <td>{{ item.target }}k</td>
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

  readonly chartReady = signal(false);
  readonly initOptions = { renderer: 'svg' as const };
  readonly data: readonly MonthlyScrapPerformance[] = [
    { month: 'Jan', actual: 27, reference: 26, target: 27 },
    { month: 'Fev', actual: 25, reference: 25, target: 26.5 },
    { month: 'Mar', actual: 26, reference: 24, target: 26 },
    { month: 'Abr', actual: 23, reference: 31, target: 25.5 },
    { month: 'Mai', actual: 34, reference: 28, target: 25 },
    { month: 'Jun', actual: 25, reference: 36, target: 24.5 },
    { month: 'Jul', actual: 14, reference: 39, target: 24 },
    { month: 'Ago', actual: 12.5, reference: 38, target: 23.5 },
    { month: 'Set', actual: null, reference: null, target: 23 },
    { month: 'Out', actual: null, reference: null, target: 22.5 },
    { month: 'Nov', actual: null, reference: null, target: 22 },
    { month: 'Dez', actual: null, reference: null, target: 21.5 },
  ];

  readonly options = computed<EChartsCoreOption>(() => {
    this.theme.isDark();

    return {
      animationDuration: 450,
      textStyle: { fontFamily: CHART_DESIGN.fontFamily },
      aria: {
        show: true,
        description: 'Gráfico de linhas com IF Cost mensal, referência do ano anterior e target.',
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
        data: this.data.map((item) => item.month),
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
          formatter: (value: number) => `${value}k`,
        },
        splitLine: { lineStyle: { color: CHART_DESIGN.grid } },
      },
      series: [
        {
          name: 'Realizado 2026',
          type: 'line',
          data: this.data.map((item) => item.actual),
          smooth: true,
          symbol: 'circle',
          lineStyle: { width: 3, color: CHART_DESIGN.primary },
          itemStyle: { color: CHART_DESIGN.primary },
        },
        {
          name: 'Referência 2025',
          type: 'line',
          data: this.data.map((item) => item.reference),
          smooth: true,
          symbol: 'circle',
          lineStyle: { width: 2, color: '#66728d' },
          itemStyle: { color: '#66728d' },
        },
        {
          name: 'Target',
          type: 'line',
          data: this.data.map((item) => item.target),
          smooth: true,
          symbol: 'circle',
          lineStyle: {
            width: 2,
            type: 'dashed',
            color: '#5ad6b3',
          },
          itemStyle: { color: '#5ad6b3' },
        },
      ],
    };
  });

  constructor() {
    afterNextRender(() => {
      this.chartReady.set(typeof ResizeObserver !== 'undefined');
    });
  }
}
