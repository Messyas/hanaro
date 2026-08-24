import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { BarChart } from 'echarts/charts';
import { AriaComponent, GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ThemeService } from '../theme/theme.service';
import { CHART_DESIGN } from './chart-design.tokens';

interface MonthlyPerformance {
  month: string;
  revenue: number;
}

echarts.use([BarChart, GridComponent, TooltipComponent, AriaComponent, SVGRenderer]);

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
        aria-label="Receita mensal dos últimos sete meses"
        [options]="options()"
        [initOpts]="initOptions"
        [autoResize]="true"
      ></div>
    } @else {
      <div class="chart-placeholder" aria-hidden="true">
        @for (item of data; track item.month) {
          <span [style.height.%]="item.revenue * 2"></span>
        }
      </div>
    }

    <table class="sr-only">
      <caption>
        Receita mensal dos últimos sete meses
      </caption>
      <thead>
        <tr>
          <th>Mês</th>
          <th>Receita</th>
        </tr>
      </thead>
      <tbody>
        @for (item of data; track item.month) {
          <tr>
            <td>{{ item.month }}</td>
            <td>R$ {{ item.revenue }} mil</td>
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
  readonly data: readonly MonthlyPerformance[] = [
    { month: 'Fev', revenue: 18 },
    { month: 'Mar', revenue: 24 },
    { month: 'Abr', revenue: 21 },
    { month: 'Mai', revenue: 30 },
    { month: 'Jun', revenue: 27 },
    { month: 'Jul', revenue: 34 },
    { month: 'Ago', revenue: 42 },
  ];

  readonly options = computed<EChartsCoreOption>(() => {
    this.theme.isDark();

    return {
      animationDuration: 450,
      textStyle: { fontFamily: CHART_DESIGN.fontFamily },
      aria: {
        show: true,
        description: 'Gráfico de barras com a receita mensal dos últimos sete meses.',
      },
      grid: { top: 12, right: 8, bottom: 8, left: 8, containLabel: true },
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
        axisPointer: { type: 'shadow', shadowStyle: { color: 'var(--brand-primary-softer)' } },
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
          formatter: (value: number) => `R$ ${value} mil`,
        },
        splitLine: { lineStyle: { color: CHART_DESIGN.grid } },
      },
      series: [
        {
          name: 'Receita',
          type: 'bar',
          data: this.data.map((item) => item.revenue),
          barMaxWidth: 28,
          itemStyle: {
            color: CHART_DESIGN.barMain,
            borderRadius: [CHART_DESIGN.borderRadius, CHART_DESIGN.borderRadius, 0, 0],
          },
          emphasis: { itemStyle: { color: CHART_DESIGN.primary } },
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
