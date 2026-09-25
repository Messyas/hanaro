import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ScrapFilterParams, ScrapPage } from './scrap-base.models';

@Injectable({ providedIn: 'root' })
export class ScrapBaseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/scrap`;
  list(filters: ScrapFilterParams = {}): Observable<ScrapPage> {
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

    return this.http.get<ScrapPage>(this.baseUrl, { params });
  }
}
