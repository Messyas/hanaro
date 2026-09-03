import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  ScrapReviewTemplate,
  ScrapReviewTemplateCreate,
  ScrapReviewTemplateUpdate,
} from './scrap-template.models';

@Injectable({ providedIn: 'root' })
export class ScrapTemplateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/scrap/reviews/templates';

  readonly templates = signal<ScrapReviewTemplate[]>([]);
  readonly loading = signal(false);
  readonly activeTemplate = signal<ScrapReviewTemplate | null>(null);

  loadTemplates(): Observable<ScrapReviewTemplate[]> {
    this.loading.set(true);
    return this.http.get<ScrapReviewTemplate[]>(this.baseUrl).pipe(
      tap({
        next: (items) => {
          this.templates.set(items);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      }),
    );
  }

  createTemplate(payload: ScrapReviewTemplateCreate): Observable<ScrapReviewTemplate> {
    return this.http.post<ScrapReviewTemplate>(this.baseUrl, payload).pipe(
      tap((created) => {
        this.templates.update((current) => [
          created,
          ...current.filter((t) => t.id !== created.id),
        ]);
      }),
    );
  }

  updateTemplate(
    templateId: string,
    payload: ScrapReviewTemplateUpdate,
  ): Observable<ScrapReviewTemplate> {
    return this.http
      .patch<ScrapReviewTemplate>(`${this.baseUrl}/${encodeURIComponent(templateId)}`, payload)
      .pipe(
        tap((updated) => {
          this.templates.update((current) =>
            current.map((template) => (template.id === updated.id ? updated : template)),
          );
          if (this.activeTemplate()?.id === updated.id) {
            this.activeTemplate.set(updated);
          }
        }),
      );
  }

  deleteTemplate(templateId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(templateId)}`).pipe(
      tap(() => {
        this.templates.update((current) => current.filter((t) => t.id !== templateId));
        if (this.activeTemplate()?.id === templateId) {
          this.activeTemplate.set(null);
        }
      }),
    );
  }

  setActiveTemplate(template: ScrapReviewTemplate | null): void {
    this.activeTemplate.set(template);
  }
}
