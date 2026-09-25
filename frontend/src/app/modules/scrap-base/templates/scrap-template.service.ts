import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ScrapReviewTemplate,
  ScrapReviewTemplateCreate,
  ScrapReviewTemplateUpdate,
} from './scrap-template.models';

@Injectable({ providedIn: 'root' })
export class ScrapTemplateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/scrap/reviews/templates`;

  loadTemplates(): Observable<ScrapReviewTemplate[]> {
    return this.http.get<ScrapReviewTemplate[]>(this.baseUrl);
  }

  createTemplate(payload: ScrapReviewTemplateCreate): Observable<ScrapReviewTemplate> {
    return this.http.post<ScrapReviewTemplate>(this.baseUrl, payload);
  }

  updateTemplate(
    templateId: string,
    payload: ScrapReviewTemplateUpdate,
  ): Observable<ScrapReviewTemplate> {
    return this.http.patch<ScrapReviewTemplate>(
      `${this.baseUrl}/${encodeURIComponent(templateId)}`,
      payload,
    );
  }

  deleteTemplate(templateId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(templateId)}`);
  }
}
