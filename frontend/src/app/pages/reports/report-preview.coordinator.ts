import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PeriodClosePreview, ReportPreview } from './reports.models';
import { ReportsService } from './reports.service';
import { ReportPeriodCloseService } from './report-period-close.service';

@Injectable({ providedIn: 'root' })
export class ReportPreviewCoordinator {
  constructor(
    private readonly service: ReportsService,
    private readonly periodClose: ReportPeriodCloseService,
  ) {}

  loadPeriodClose(reportId: string): Observable<PeriodClosePreview> {
    return this.periodClose.preview(reportId);
  }

  loadDossier(reportId: string): Observable<ReportPreview> {
    return this.service.preview(reportId);
  }
}
