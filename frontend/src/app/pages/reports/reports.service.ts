import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EligibleOccurrence,
  ExportFormat,
  ExportJob,
  Page,
  ReportDetail,
  ReportListItem,
  ReportPreview,
  ReportVersion,
} from './reports.models';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/reports';

  list(filters: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
  }): Observable<Page<ReportListItem>> {
    let params = new HttpParams().set('page', filters.page).set('page_size', filters.pageSize);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<Page<ReportListItem>>(this.base, { params });
  }

  create(title: string, description: string): Observable<ReportDetail> {
    return this.http.post<ReportDetail>(this.base, { title, description });
  }

  get(reportId: string): Observable<ReportDetail> {
    return this.http.get<ReportDetail>(`${this.base}/${reportId}`);
  }

  update(
    reportId: string,
    expectedVersion: number,
    title: string,
    description: string,
  ): Observable<ReportDetail> {
    return this.http.patch<ReportDetail>(`${this.base}/${reportId}`, {
      expected_version: expectedVersion,
      title,
      description,
    });
  }

  mutateSources(
    reportId: string,
    kind: 'occurrence' | 'report',
    operation: 'add' | 'remove' | 'replace',
    expectedVersion: number,
    ids: string[],
  ): Observable<ReportDetail> {
    return this.http.put<ReportDetail>(`${this.base}/${reportId}/${kind}-sources/${operation}`, {
      expected_version: expectedVersion,
      ids,
    });
  }

  eligibleOccurrences(search = ''): Observable<Page<EligibleOccurrence>> {
    let params = new HttpParams().set('page', 1).set('page_size', 100);
    if (search) params = params.set('search', search);
    return this.http.get<Page<EligibleOccurrence>>(`${this.base}/eligible-occurrences`, { params });
  }

  sourceReports(reportId: string, search = ''): Observable<Page<ReportListItem>> {
    let params = new HttpParams().set('page', 1).set('page_size', 100);
    if (search) params = params.set('search', search);
    return this.http.get<Page<ReportListItem>>(`${this.base}/${reportId}/source-reports`, {
      params,
    });
  }

  preview(reportId: string): Observable<ReportPreview> {
    return this.http.get<ReportPreview>(`${this.base}/${reportId}/preview`);
  }

  publish(reportId: string, expectedVersion: number): Observable<ReportVersion> {
    return this.http.post<ReportVersion>(`${this.base}/${reportId}/publish`, {
      expected_version: expectedVersion,
      template_version: '1',
    });
  }

  versions(reportId: string): Observable<Page<ReportVersion>> {
    return this.http.get<Page<ReportVersion>>(`${this.base}/${reportId}/versions`, {
      params: { page: 1, page_size: 100 },
    });
  }

  requestExport(versionId: string, format: ExportFormat): Observable<ExportJob> {
    return this.http.post<ExportJob>(`/api/v1/report-versions/${versionId}/exports`, {
      format,
      options: {},
      template_version: '1',
    });
  }

  exportStatus(jobId: string): Observable<ExportJob> {
    return this.http.get<ExportJob>(`/api/v1/exports/${jobId}`);
  }

  download(jobId: string): Observable<Blob> {
    return this.http.get(`/api/v1/exports/${jobId}/download`, { responseType: 'blob' });
  }
}
