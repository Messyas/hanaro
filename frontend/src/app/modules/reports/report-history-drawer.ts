import { Component, input, output } from '@angular/core';
import { ReportPreview as ReportPreviewComponent } from './report-preview/report-preview';
import { ReportVersion } from './reports.models';

interface HistoryCopy {
  revision: string;
  close: string;
  author: string;
  occurrences: string;
}

interface HistoryWorkflows {
  details: string;
}

@Component({
  selector: 'app-report-history-drawer',
  imports: [ReportPreviewComponent],
  templateUrl: './report-history-drawer.html',
})
export class ReportHistoryDrawer {
  readonly version = input.required<ReportVersion>();
  readonly copy = input.required<HistoryCopy>();
  readonly workflows = input.required<HistoryWorkflows>();
  readonly formatDate = input.required<(value: string | null | undefined) => string>();
  readonly formatCurrency = input.required<(value: string, currency: 'BRL' | 'USD') => string>();
  readonly close = output<void>();
}
