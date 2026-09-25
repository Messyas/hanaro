import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ScrapDefectType } from './scrap-review.models';

@Injectable({ providedIn: 'root' })
export class DefectTypesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/scrap/review-types`;

  getDefectTypes(includeInactive = false): Observable<ScrapDefectType[]> {
    let params = new HttpParams();
    if (includeInactive) params = params.set('include_inactive', 'true');
    return this.http.get<ScrapDefectType[]>(this.baseUrl, { params });
  }

  createDefectType(payload: {
    code: string;
    name: string;
    description?: string | null;
    display_order?: number;
  }): Observable<ScrapDefectType> {
    return this.http.post<ScrapDefectType>(this.baseUrl, payload);
  }

  updateDefectType(
    id: string,
    payload: {
      name?: string;
      description?: string | null;
      display_order?: number;
      is_active?: boolean;
    },
  ): Observable<ScrapDefectType> {
    return this.http.patch<ScrapDefectType>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload);
  }

  deleteDefectType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }
}
