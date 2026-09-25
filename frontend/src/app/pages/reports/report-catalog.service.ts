import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateReportInput, Page, ReportDetail, ReportListItem } from './reports.models';

export interface ReportCatalogQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportCatalogService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/reports';

  list(query: ReportCatalogQuery): Observable<Page<ReportListItem>> {
    let params = new HttpParams().set('page', query.page).set('page_size', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<Page<ReportListItem>>(this.base, { params });
  }

  create(input: CreateReportInput): Observable<ReportDetail> {
    return this.http.post<ReportDetail>(this.base, input);
  }

  get(reportId: string): Observable<ReportDetail> {
    return this.http.get<ReportDetail>(`${this.base}/${reportId}`);
  }
}
