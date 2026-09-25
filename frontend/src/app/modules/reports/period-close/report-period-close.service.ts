import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EligibleAction,
  EligibleEvidence,
  Page,
  PeriodClosePreview,
  ReportCandidateQuery,
  ReportDetail,
  ReportScope,
  ReportSection,
} from '../reports.models';
import { ReportEvidenceSourceInput } from './report-period-close.workspace';
import { serializeReportCandidateQuery } from '../sources/report-candidate-query.params';

@Injectable({ providedIn: 'root' })
export class ReportPeriodCloseService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/reports`;

  preview(reportId: string): Observable<PeriodClosePreview> {
    return this.http.get<PeriodClosePreview>(`${this.base}/${reportId}/preview`);
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
    evidence: ReportEvidenceSourceInput[],
  ): Observable<ReportDetail> {
    return this.http.put<ReportDetail>(`${this.base}/${reportId}/evidence-sources`, {
      expected_version: expectedVersion,
      evidence,
    });
  }
}
