import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ExecutionDetail, ExecutionPage, ExecutionsFilterParams } from './executions.models';

@Injectable({ providedIn: 'root' })
export class ExecutionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/scrap/executions';

  list(filters: ExecutionsFilterParams = {}): Observable<ExecutionPage> {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http.get<ExecutionPage>(this.baseUrl, { params });
  }

  getDetail(executionId: string): Observable<ExecutionDetail> {
    return this.http.get<ExecutionDetail>(`${this.baseUrl}/${encodeURIComponent(executionId)}`);
  }

  retry(executionId: string): Observable<ExecutionDetail> {
    return this.http.post<ExecutionDetail>(
      `${this.baseUrl}/${encodeURIComponent(executionId)}/retry`,
      {},
    );
  }
}
