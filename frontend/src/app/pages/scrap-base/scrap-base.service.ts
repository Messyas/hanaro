import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ScrapFilterParams, ScrapPage } from './scrap-base.models';

@Injectable({ providedIn: 'root' })
export class ScrapBaseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/scrap';
  private readonly pageCache = new Map<string, ScrapPage>();

  getCached(filters: ScrapFilterParams = {}): ScrapPage | null {
    return this.pageCache.get(this.cacheKey(filters)) ?? null;
  }

  list(filters: ScrapFilterParams = {}): Observable<ScrapPage> {
    const cacheKey = this.cacheKey(filters);
    let params = new HttpParams();

    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item) params = params.append(key, item);
        }
      } else if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http
      .get<ScrapPage>(this.baseUrl, { params })
      .pipe(tap((page) => this.pageCache.set(cacheKey, page)));
  }

  private cacheKey(filters: ScrapFilterParams): string {
    return JSON.stringify(
      Object.entries(filters)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .sort(([left], [right]) => left.localeCompare(right)),
    );
  }
}
