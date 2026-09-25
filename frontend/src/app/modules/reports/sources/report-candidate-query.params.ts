import { HttpParams } from '@angular/common/http';
import { ReportCandidateQuery } from '../reports.models';

export function serializeReportCandidateQuery(query: ReportCandidateQuery): HttpParams {
  let params = new HttpParams().set('page', query.page).set('page_size', query.pageSize);
  if (query.search) params = params.set('search', query.search);
  return params;
}
