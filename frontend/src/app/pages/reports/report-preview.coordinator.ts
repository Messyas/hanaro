import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PeriodClosePreview, ReportPreview } from './reports.models';
import { ReportsService } from './reports.service';

@Injectable({ providedIn: 'root' })
export class ReportPreviewCoordinator {
  constructor(private readonly service: ReportsService) {}

  loadPeriodClose(reportId: string): Observable<PeriodClosePreview> {
    return this.service.periodClosePreview(reportId);
  }

  loadDossier(reportId: string): Observable<ReportPreview> {
    return this.service.preview(reportId);
  }
}
