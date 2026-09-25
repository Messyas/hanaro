import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EligibleAction,
  EligibleEvidence,
  CreateReportInput,
  Page,
  ReportDetail,
  ReportAnalytics,
  ReportCandidateQuery,
  ReportListItem,
  ReportPreview,
  PeriodClosePreview,
  ReportSection,
  ReportScope,
  ReportVersion,
  UpdateReportCommand,
} from './reports.models';
import { serializeReportCandidateQuery } from './report-candidate-query.params';

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

  create(title: string, description: string): Observable<ReportDetail>;
  create(input: CreateReportInput): Observable<ReportDetail>;
  create(titleOrInput: string | CreateReportInput, description = ''): Observable<ReportDetail> {
    const body =
      typeof titleOrInput === 'string' ? { title: titleOrInput, description } : titleOrInput;
    return this.http.post<ReportDetail>(this.base, body);
  }

  get(reportId: string): Observable<ReportDetail> {
    return this.http.get<ReportDetail>(`${this.base}/${reportId}`);
  }

  analytics(reportId: string): Observable<ReportAnalytics> {
    return this.http.get<ReportAnalytics>(`${this.base}/${reportId}/analytics`);
  }

  periodClosePreview(reportId: string): Observable<PeriodClosePreview> {
    return this.http.get<PeriodClosePreview>(`${this.base}/${reportId}/preview`);
  }

  update(command: UpdateReportCommand): Observable<ReportDetail> {
    return this.http.patch<ReportDetail>(`${this.base}/${command.reportId}`, {
      expected_version: command.expectedVersion,
      title: command.title,
      description: command.description,
    });
  }

  scope(reportId: string): Observable<ReportScope | null> {
    return this.http.get<ReportScope | null>(`${this.base}/${reportId}/scope`);
  }

  updateScope(
    reportId: string,
    expectedVersion: number,
    scope: ReportScope,
  ): Observable<ReportDetail> {
    return this.http.put<ReportDetail>(`${this.base}/${reportId}/scope`, {
      expected_version: expectedVersion,
      scope,
    });
  }

  sections(reportId: string): Observable<ReportSection[]> {
    return this.http.get<ReportSection[]>(`${this.base}/${reportId}/sections`);
  }

  replaceSections(
    reportId: string,
    expectedVersion: number,
    sections: ReportSection[],
  ): Observable<ReportDetail> {
    return this.http.put<ReportDetail>(`${this.base}/${reportId}/sections`, {
      expected_version: expectedVersion,
      sections: sections.map(({ id: _id, position: _position, ...section }) => section),
    });
  }

  eligibleActions(
    factoryId: string,
    query: ReportCandidateQuery,
  ): Observable<Page<EligibleAction>> {
    const params = serializeReportCandidateQuery(query).set('factory_id', factoryId);
    return this.http.get<Page<EligibleAction>>(`${this.base}/eligible-actions`, { params });
  }

  replaceActionSources(
    reportId: string,
    expectedVersion: number,
    actionIds: string[],
  ): Observable<ReportDetail> {
    return this.http.put<ReportDetail>(`${this.base}/${reportId}/action-sources`, {
      expected_version: expectedVersion,
      action_ids: actionIds,
    });
  }

  eligibleEvidence(
    reportId: string,
    query: ReportCandidateQuery,
  ): Observable<Page<EligibleEvidence>> {
    const params = serializeReportCandidateQuery(query);
    return this.http.get<Page<EligibleEvidence>>(`${this.base}/${reportId}/eligible-evidence`, {
      params,
    });
  }

  replaceEvidenceSources(
    reportId: string,
    expectedVersion: number,
    evidence: Array<{
      section_key: string;
      review_attachment_id: string | null;
      published_evidence_id: string | null;
      caption: string;
      role: 'CONTEXT' | 'BEFORE' | 'AFTER' | 'IMPLEMENTATION' | 'MEASUREMENT';
      captured_at: string | null;
    }>,
  ): Observable<ReportDetail> {
    return this.http.put<ReportDetail>(`${this.base}/${reportId}/evidence-sources`, {
      expected_version: expectedVersion,
      evidence,
    });
  }

  preview(reportId: string): Observable<ReportPreview> {
    return this.http.get<ReportPreview>(`${this.base}/${reportId}/preview`);
  }

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

  version(reportId: string, revision: number) {
    return this.http.get<ReportVersion>(`${this.base}/${reportId}/versions/${revision}`);
  }
}
