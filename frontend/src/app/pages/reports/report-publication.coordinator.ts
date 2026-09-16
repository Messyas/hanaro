import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReportDetail, ReportVersion } from './reports.models';
import { ReportsService } from './reports.service';

@Injectable({ providedIn: 'root' })
export class ReportPublicationCoordinator {
  constructor(private readonly service: ReportsService) {}

  publish(report: ReportDetail): Observable<ReportVersion> {
    return this.service.publish(
      report.id,
      report.version,
      report.report_kind === 'PERIOD_CLOSE' ? '2' : '1',
    );
  }

  version(reportId: string, revision: number): Observable<ReportVersion> {
    return this.service.version(reportId, revision);
  }
}
