import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Page, ReportCandidateQuery, ReportDetail, ReportVersion } from './reports.models';
import { ReportPublicationService } from './report-publication.service';

@Injectable({ providedIn: 'root' })
export class ReportPublicationCoordinator {
  constructor(private readonly publication: ReportPublicationService) {}

  publish(report: ReportDetail): Observable<ReportVersion> {
    return this.publication.publish(
      report.id,
      report.version,
      report.report_kind === 'PERIOD_CLOSE' ? '2' : '1',
    );
  }

  version(reportId: string, revision: number): Observable<ReportVersion> {
    return this.publication.version(reportId, revision);
  }

  versions(reportId: string, query: ReportCandidateQuery): Observable<Page<ReportVersion>> {
    return this.publication.versions(reportId, query);
  }
}
