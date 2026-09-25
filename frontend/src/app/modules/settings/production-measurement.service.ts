import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ProductionMeasurement {
  year: number;
  month: number;
  scope_key: string;
  currency: 'USD' | 'BRL';
  production_value: number | null;
  production_quantity: number | null;
  note: string;
  revision: number;
  status: 'DRAFT' | 'CONFIRMED' | 'SUPERSEDED';
  source: string;
  author_id: number | null;
  created_at: string;
}

export interface ProductionMeasurementWrite {
  month: number;
  production_value: number | null;
  production_quantity: number | null;
  note: string;
  expected_version: number;
}

@Injectable({ providedIn: 'root' })
export class ProductionMeasurementService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/production-measurements`;

  getYear(year: number, scopeKey = 'GLOBAL'): Observable<ProductionMeasurement[]> {
    const params = new HttpParams().set('year', year.toString()).set('scope_key', scopeKey);
    return this.http.get<ProductionMeasurement[]>(this.baseUrl, { params });
  }

  saveYear(
    year: number,
    measurements: ProductionMeasurementWrite[],
    currency: 'USD' | 'BRL' = 'USD',
    scopeKey = 'GLOBAL',
  ): Observable<ProductionMeasurement[]> {
    return this.http.put<ProductionMeasurement[]>(`${this.baseUrl}/${year}`, {
      currency,
      scope_key: scopeKey,
      measurements,
    });
  }

  clearYear(
    year: number,
    expectedVersions: Record<number, number>,
    scopeKey = 'GLOBAL',
  ): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${year}`, {
      body: { expected_versions: expectedVersions },
      params: new HttpParams().set('scope_key', scopeKey),
    });
  }
}
