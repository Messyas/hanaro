import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EligibleAction,
  EligibleEvidence,
  Page,
  ReportCandidateQuery,
  ReportDetail,
  ReportScope,
  ReportSection,
} from './reports.models';
import { ReportEvidenceSourceInput } from './report-period-close.workspace';
import { ReportPeriodCloseService } from './report-period-close.service';

@Injectable({ providedIn: 'root' })
export class ReportPeriodCloseCoordinator {
  constructor(private readonly periodClose: ReportPeriodCloseService) {}

  loadActionCandidates(
    report: ReportDetail,
    query: ReportCandidateQuery,
  ): Observable<Page<EligibleAction>> {
    return this.periodClose.eligibleActions(report.factory_id, query);
  }

  loadEvidenceCandidates(
    report: ReportDetail,
    query: ReportCandidateQuery,
  ): Observable<Page<EligibleEvidence>> {
    return this.periodClose.eligibleEvidence(report.id, query);
  }

  updateScope(report: ReportDetail, scope: ReportScope): Observable<ReportDetail> {
    return this.periodClose.updateScope(report.id, report.version, scope);
  }

  replaceSections(report: ReportDetail, sections: ReportSection[]): Observable<ReportDetail> {
    return this.periodClose.replaceSections(report.id, report.version, sections);
  }

  replaceActionSources(report: ReportDetail, actionIds: string[]): Observable<ReportDetail> {
    return this.periodClose.replaceActionSources(report.id, report.version, actionIds);
  }

  replaceEvidenceSources(
    report: ReportDetail,
    evidence: ReportEvidenceSourceInput[],
  ): Observable<ReportDetail> {
    return this.periodClose.replaceEvidenceSources(report.id, report.version, evidence);
  }
}
