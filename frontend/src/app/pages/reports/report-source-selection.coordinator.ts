import { Injectable } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { EligibleOccurrence, Page, ReportCandidateQuery, ReportListItem } from './reports.models';
import { ReportsService } from './reports.service';

export interface ReportSourceCandidates {
  occurrences: Page<EligibleOccurrence>;
  reports: Page<ReportListItem>;
}

@Injectable({ providedIn: 'root' })
export class ReportSourceSelectionCoordinator {
  constructor(private readonly service: ReportsService) {}

  loadCandidates(
    reportId: string,
    occurrenceQuery: ReportCandidateQuery,
    reportQuery: ReportCandidateQuery,
  ): Observable<ReportSourceCandidates> {
    return forkJoin({
      occurrences: this.service.eligibleOccurrences(occurrenceQuery),
      reports: this.service.sourceReports(reportId, reportQuery),
    });
  }
}
