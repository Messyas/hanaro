import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ScrapTarget {
  year: number;
  month: number;
  currency: 'USD' | 'BRL';
  amount: number;
  updated_at: string;
}

export interface ScrapTargetMonthItem {
  month: number;
  amount: number;
}

export interface ScrapTargetBatchUpsert {
  currency: 'USD' | 'BRL';
  targets: ScrapTargetMonthItem[];
}

@Injectable({ providedIn: 'root' })
export class ScrapTargetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/dashboard/scrap/targets';

  getTargets(year?: number): Observable<ScrapTarget[]> {
    let params = new HttpParams();
    if (year !== undefined) {
      params = params.set('year', year.toString());
    }
    return this.http.get<ScrapTarget[]>(this.baseUrl, { params });
  }

  saveYearPlan(
    year: number,
    targets: ScrapTargetMonthItem[],
    currency: 'USD' | 'BRL' = 'USD',
  ): Observable<ScrapTarget[]> {
    const payload: ScrapTargetBatchUpsert = {
      currency,
      targets,
    };
    return this.http.put<ScrapTarget[]>(`${this.baseUrl}/${year}`, payload);
  }

  deleteYearPlan(year: number, currency: 'USD' | 'BRL' = 'USD'): Observable<void> {
    const params = new HttpParams().set('currency', currency);
    return this.http.delete<void>(`${this.baseUrl}/${year}`, { params });
  }
}
