import { Component, computed, inject, input } from '@angular/core';
import { BarChart } from 'echarts/charts';
import { AriaComponent, GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { CHART_DESIGN } from '../../../charts/chart-design.tokens';
import { ThemeService } from '../../../theme/theme.service';
import { LanguageCode } from '../../../i18n/language.service';
import { DashboardAnalysis, DashboardDistributionItem, DashboardMetric } from '../dashboard.models';
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
      role="img"
      [attr.aria-label]="
        analysis() === 'relative'
          ? copy().distributionRelativeAria
          : copy().distributionAbsoluteAria
      "
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
        height: 14rem;
      }
    }
  `,
})
export class DashboardDistributionChart {
  private readonly theme = inject(ThemeService);

  readonly data = input.required<readonly DashboardDistributionItem[]>();
  readonly metric = input.required<DashboardMetric>();
  readonly analysis = input.required<DashboardAnalysis>();
  readonly language = input.required<LanguageCode>();
  readonly monetaryValuesHidden = input(false);
  readonly copy = computed(() => DASHBOARD_TRANSLATIONS[this.language()]);
  readonly initOptions = { renderer: 'svg' as const };
  readonly options = computed<EChartsCoreOption>(() => {
    this.theme.isDark();
    const metric = this.metric();
    const analysis = this.analysis();
    const hidden = analysis === 'absolute' && metric === 'usd' && this.monetaryValuesHidden();
    const data = [...this.data()].reverse();

    return {
      animationDuration: 450,
      textStyle: { fontFamily: CHART_DESIGN.fontFamily },
      aria: {
        show: true,
        description:
          analysis === 'relative'
            ? this.copy().distributionRelativeAria
            : this.copy().distributionAbsoluteAria,
      },
      grid: { top: 6, right: 78, bottom: 8, left: 6, containLabel: true },
      tooltip: {
        show: !hidden,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: CHART_DESIGN.surface,
        borderColor: CHART_DESIGN.grid,
        textStyle: { color: CHART_DESIGN.text, fontFamily: CHART_DESIGN.fontFamily },
      },
      xAxis: { type: 'value', show: false },
      yAxis: {
        type: 'category',
        data: data.map((item) => item.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: CHART_DESIGN.mutedText, fontFamily: CHART_DESIGN.fontFamily },
      },
      series: [
        {
          name: analysis === 'relative' ? 'Scrap Rate' : metric === 'usd' ? 'IF Cost' : 'QTY Scrap',
          type: 'bar',
          data: data.map((item) => {
            const value =
              analysis === 'relative'
                ? metric === 'usd'
                  ? (item.relativeUsd ?? 0)
                  : (item.relativeQty ?? 0)
                : metric === 'usd'
                  ? item.usd
                  : item.qty;
            return {
              value,
              label: {
                formatter: hidden
                  ? '•••••'
                  : analysis === 'relative'
                    ? `${value.toLocaleString(DASHBOARD_LOCALES[this.language()], { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`
                    : metric === 'usd'
                      ? this.compactCurrency(value)
                      : `${new Intl.NumberFormat(DASHBOARD_LOCALES[this.language()]).format(value)} ${this.copy().units}`,
              },
            };
          }),
          barWidth: 16,
          itemStyle: { color: CHART_DESIGN.primary, borderRadius: [0, 6, 6, 0] },
          label: {
            show: true,
            position: 'right',
            color: CHART_DESIGN.mutedText,
            fontFamily: CHART_DESIGN.fontFamily,
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
}
