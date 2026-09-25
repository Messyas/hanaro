import { Injectable } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import {
  EligibleOccurrence,
  Page,
  ReportCandidateQuery,
  ReportDetail,
  ReportListItem,
  ReportSourceMutationCommand,
} from './reports.models';
import { ReportSourceService } from './report-source.service';

export interface ReportSourceCandidates {
  occurrences: Page<EligibleOccurrence>;
  reports: Page<ReportListItem>;
}

@Injectable({ providedIn: 'root' })
export class ReportSourceSelectionCoordinator {
  constructor(private readonly sources: ReportSourceService) {}

  mutateSources(command: ReportSourceMutationCommand): Observable<ReportDetail> {
    return this.sources.mutateSources(command);
  }

  loadCandidates(
    reportId: string,
    occurrenceQuery: ReportCandidateQuery,
    reportQuery: ReportCandidateQuery,
  ): Observable<ReportSourceCandidates> {
    return forkJoin({
      occurrences: this.sources.eligibleOccurrences(occurrenceQuery),
      reports: this.sources.sourceReports(reportId, reportQuery),
    });
  }
}
