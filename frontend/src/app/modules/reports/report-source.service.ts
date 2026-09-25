import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EligibleOccurrence,
  Page,
  ReportCandidateQuery,
  ReportDetail,
  ReportListItem,
  ReportSourceMutationCommand,
} from './reports.models';
import { serializeReportCandidateQuery } from './report-candidate-query.params';

@Injectable({ providedIn: 'root' })
export class ReportSourceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/reports`;

  mutateSources(command: ReportSourceMutationCommand): Observable<ReportDetail> {
    return this.http.put<ReportDetail>(
      `${this.base}/${command.reportId}/${command.kind}-sources/${command.operation}`,
      {
        expected_version: command.expectedVersion,
        ids: command.ids,
      },
    );
  }

  eligibleOccurrences(query: ReportCandidateQuery): Observable<Page<EligibleOccurrence>> {
    const params = serializeReportCandidateQuery(query);
    return this.http.get<Page<EligibleOccurrence>>(`${this.base}/eligible-occurrences`, { params });
  }

  sourceReports(reportId: string, query: ReportCandidateQuery): Observable<Page<ReportListItem>> {
    const params = serializeReportCandidateQuery(query);
    return this.http.get<Page<ReportListItem>>(`${this.base}/${reportId}/source-reports`, {
      params,
    });
  }
}
