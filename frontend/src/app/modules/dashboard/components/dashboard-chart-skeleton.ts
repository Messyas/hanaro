import { Component, input } from '@angular/core';

@Component({
  selector: 'app-dashboard-chart-skeleton',
  templateUrl: './dashboard-chart-skeleton.html',
  styleUrl: './dashboard-chart-skeleton.css',
})
export class DashboardChartSkeleton {
  readonly compact = input(false);
}
