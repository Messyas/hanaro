import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Page, ReportCandidateQuery, ReportVersion } from '../reports.models';

@Injectable({ providedIn: 'root' })
export class ReportPublicationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/reports`;

  publish(
    reportId: string,
    expectedVersion: number,
    templateVersion: '1' | '2' = '1',
  ): Observable<ReportVersion> {
    return this.http.post<ReportVersion>(`${this.base}/${reportId}/publish`, {
      expected_version: expectedVersion,
      template_version: templateVersion,
    });
  }

  versions(
    reportId: string,
    query: ReportCandidateQuery = { page: 1, pageSize: 25 },
  ): Observable<Page<ReportVersion>> {
    return this.http.get<Page<ReportVersion>>(`${this.base}/${reportId}/versions`, {
      params: { page: query.page, page_size: query.pageSize },
    });
  }

  version(reportId: string, revision: number): Observable<ReportVersion> {
    return this.http.get<ReportVersion>(`${this.base}/${reportId}/versions/${revision}`);
  }
}
