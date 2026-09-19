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
  private readonly baseUrl = '/api/v1/production-measurements';

  getYear(year: number): Observable<ProductionMeasurement[]> {
    const params = new HttpParams().set('year', year.toString());
    return this.http.get<ProductionMeasurement[]>(this.baseUrl, { params });
  }

  saveYear(
    year: number,
    measurements: ProductionMeasurementWrite[],
    currency: 'USD' | 'BRL' = 'USD',
  ): Observable<ProductionMeasurement[]> {
    return this.http.put<ProductionMeasurement[]>(`${this.baseUrl}/${year}`, {
      currency,
      measurements,
    });
  }

  clearYear(year: number, expectedVersions: Record<number, number>): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${year}`, {
      body: { expected_versions: expectedVersions },
    });
  }
}
