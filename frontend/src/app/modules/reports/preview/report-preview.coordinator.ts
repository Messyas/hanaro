import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PeriodClosePreview, ReportPreview } from '../reports.models';
import { ReportDossierPreviewService } from './report-dossier-preview.service';
import { ReportPeriodCloseService } from '../period-close/report-period-close.service';

@Injectable({ providedIn: 'root' })
export class ReportPreviewCoordinator {
  constructor(
    private readonly dossierPreview: ReportDossierPreviewService,
    private readonly periodClose: ReportPeriodCloseService,
  ) {}

  loadPeriodClose(reportId: string): Observable<PeriodClosePreview> {
    return this.periodClose.preview(reportId);
  }

  loadDossier(reportId: string): Observable<ReportPreview> {
    return this.dossierPreview.load(reportId);
  }
}
