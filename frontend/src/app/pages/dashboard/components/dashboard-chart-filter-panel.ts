import { Component, input, output } from '@angular/core';
import { UiIcon } from '../../../ui-icon';

export type DashboardChartFilterPanelVariant = 'default' | 'distribution';

@Component({
  selector: 'app-dashboard-chart-filter-panel',
  imports: [UiIcon],
  template: `
    <div
      class="chart-filter-panel"
      [class.distribution-filter-panel]="variant() === 'distribution'"
      [attr.aria-label]="label()"
    >
      <ng-content />
      <button
        class="chart-filter-clear"
        type="button"
        [disabled]="clearDisabled()"
        (click)="clear.emit()"
      >
        <ui-icon name="x" />
        <span>{{ clearLabel() }}</span>
      </button>
    </div>
  `,
  styleUrl: './dashboard-chart-filter-panel.css',
})
export class DashboardChartFilterPanel {
  readonly label = input.required<string>();
  readonly clearLabel = input.required<string>();
  readonly clearDisabled = input(false);
  readonly variant = input<DashboardChartFilterPanelVariant>('default');
  readonly clear = output<void>();
}
