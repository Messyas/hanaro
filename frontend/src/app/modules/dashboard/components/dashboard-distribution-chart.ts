import { Component, computed, inject, input } from '@angular/core';
import { BarChart } from 'echarts/charts';
import { AriaComponent, GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CHART_DESIGN, getChartTheme } from '../../../charts/chart-design.tokens';
import { ThemeService } from '../../../theme/theme.service';
import { LanguageCode } from '../../../i18n/language.service';
import { DashboardDistributionItem, DashboardMetric } from '../dashboard.models';
import { DASHBOARD_LOCALES, DASHBOARD_TRANSLATIONS } from '../dashboard.translations';

echarts.use([BarChart, GridComponent, TooltipComponent, AriaComponent, SVGRenderer]);

@Component({
  selector: 'app-dashboard-distribution-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  template: `
    <div
      echarts
      class="distribution-chart"
      [style.height]="chartHeight()"
      role="img"
      [attr.aria-label]="copy().distributionAbsoluteAria"
      [options]="options()"
      [initOpts]="initOptions"
      [autoResize]="true"
    ></div>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 1rem;
    }
    .distribution-chart {
      width: 100%;
      height: 16.5rem;
    }
    @media (max-width: 760px) {
      .distribution-chart {
        height: 14rem !important;
      }
    }
  `,
})
export class DashboardDistributionChart {
  private readonly theme = inject(ThemeService);

  readonly data = input.required<readonly DashboardDistributionItem[]>();
  readonly metric = input.required<DashboardMetric>();
  readonly language = input.required<LanguageCode>();
  readonly monetaryValuesHidden = input(false);
  readonly valueMode = input<'absolute' | 'relative'>('absolute');
  readonly chartHeight = input<string>('16.5rem');
  readonly copy = computed(() => DASHBOARD_TRANSLATIONS[this.language()]);
  readonly initOptions = { renderer: 'svg' as const };
  readonly options = computed<EChartsCoreOption>(() => {
    const isDark = this.theme.isDark();
    const chartTheme = getChartTheme(isDark);
    const metric = this.metric();
    const hidden = metric === 'usd' && this.monetaryValuesHidden();
    const relative = this.valueMode() === 'relative';
    const data = [...this.data()].reverse();

    return {
      animationDuration: 450,
      textStyle: { fontFamily: chartTheme.fontFamily },
      aria: {
        show: true,
        description: relative
          ? this.copy().distributionRelativeAria
          : this.copy().distributionAbsoluteAria,
      },
      grid: { top: 6, right: 78, bottom: 8, left: 6, containLabel: true },
      tooltip: {
        show: !hidden,
        trigger: 'item',
        backgroundColor: chartTheme.surface,
        borderColor: chartTheme.grid,
        borderWidth: 1,
        padding: [6, 10],
        extraCssText:
          'pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.4); border-radius: 6px;',
        textStyle: { color: chartTheme.text, fontFamily: chartTheme.fontFamily, fontSize: 12 },
        position: (
          point: [number, number],
          _params: unknown,
          _dom: unknown,
          _rect: unknown,
          size: { contentSize: [number, number] },
        ) => {
          const x = Math.max(8, point[0] - size.contentSize[0] / 2);
          const y = point[1] - size.contentSize[1] - 10;
          if (y < 4) {
            return [point[0] + 16, Math.max(4, point[1] - size.contentSize[1] / 2)];
          }
          return [x, y];
        },
        formatter: (params: unknown) => {
          const item = params as { name?: string; value?: number };
          if (!item || item.name === undefined) return '';
          const rawVal = item.value ?? 0;
          const source = data.find((entry) => entry.label === item.name);
          if (relative && source) {
            const rate = this.percentage(source.rate ?? 0);
            const numerator = hidden ? '•••••' : this.metricValue(source.numerator ?? 0);
            const denominator = hidden ? '•••••' : this.metricValue(source.denominator ?? 0);
            return `<div style="font-weight:700;margin-bottom:5px">${item.name}</div><div>${this.copy().scrapRate}: ${rate}</div><div>${this.copy().scrapValue}: ${numerator}</div><div>${this.copy().productionValue}: ${denominator}</div><div>${this.copy().occurrences}: ${source.recordCount ?? 0}</div>`;
          }
          const displayVal =
            metric === 'usd'
              ? this.compactCurrency(rawVal)
              : `${new Intl.NumberFormat(DASHBOARD_LOCALES[this.language()]).format(rawVal)} ${this.copy().units}`;
          return `<div style="font-weight:600;margin-bottom:2px">${item.name}</div><div>${displayVal}</div>`;
        },
      },
      xAxis: { type: 'value', show: false },
      yAxis: {
        type: 'category',
        data: data.map((item) => item.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: chartTheme.mutedText, fontFamily: chartTheme.fontFamily },
      },
      series: [
        {
          name: relative ? this.copy().scrapRate : metric === 'usd' ? 'IF Cost' : 'QTY Scrap',
          type: 'bar',
          data: data.map((item) => {
            const value = relative ? (item.rate ?? 0) : metric === 'usd' ? item.usd : item.qty;
            return {
              value,
              label: {
                formatter:
                  !relative && hidden
                    ? '•••••'
                    : relative
                      ? this.percentage(value)
                      : metric === 'usd'
                        ? this.compactCurrency(value)
                        : `${new Intl.NumberFormat(DASHBOARD_LOCALES[this.language()]).format(value)} ${this.copy().units}`,
              },
            };
          }),
          barWidth: 16,
          itemStyle: {
            color: chartTheme.primary,
            borderRadius: [0, 6, 6, 0],
          },
          emphasis: {
            itemStyle: {
              color: chartTheme.primaryHover,
              borderRadius: [0, 6, 6, 0],
            },
          },
          label: {
            show: true,
            position: 'right',
            color: chartTheme.mutedText,
            fontFamily: chartTheme.fontFamily,
          },
        },
      ],
    };
  });

  private compactCurrency(value: number): string {
    const formatted = new Intl.NumberFormat(DASHBOARD_LOCALES[this.language()], {
      maximumFractionDigits: 1,
    }).format(value >= 1000 ? value / 1000 : value);

    return value >= 1000 ? `US$ ${formatted}k` : `US$ ${formatted}`;
  }

  private percentage(value: number): string {
    return `${new Intl.NumberFormat(DASHBOARD_LOCALES[this.language()], {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value)}%`;
  }

  private metricValue(value: number): string {
    if (this.metric() === 'usd') return this.compactCurrency(value);
    return `${new Intl.NumberFormat(DASHBOARD_LOCALES[this.language()]).format(value)} ${this.copy().units}`;
  }
}
