import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  ScrapReviewTemplate,
  ScrapReviewTemplateCreate,
  ScrapReviewTemplateUpdate,
} from './scrap-template.models';
import { ScrapTemplateService } from './scrap-template.service';

@Injectable({ providedIn: 'root' })
export class ScrapTemplateStore {
  private readonly templateService = inject(ScrapTemplateService);

  readonly templates = signal<ScrapReviewTemplate[]>([]);
  readonly loading = signal(false);

  loadTemplates(): Observable<ScrapReviewTemplate[]> {
    this.loading.set(true);
    return this.templateService.loadTemplates().pipe(
      tap({
        next: (templates) => {
          this.templates.set(templates);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      }),
    );
  }

  createTemplate(payload: ScrapReviewTemplateCreate): Observable<ScrapReviewTemplate> {
    return this.templateService.createTemplate(payload).pipe(
      tap((created) => {
        this.templates.update((current) => [
          created,
          ...current.filter((item) => item.id !== created.id),
        ]);
      }),
    );
  }

  updateTemplate(
    templateId: string,
    payload: ScrapReviewTemplateUpdate,
  ): Observable<ScrapReviewTemplate> {
    return this.templateService.updateTemplate(templateId, payload).pipe(
      tap((updated) => {
        this.templates.update((current) =>
          current.map((template) => (template.id === updated.id ? updated : template)),
        );
      }),
    );
  }

  deleteTemplate(templateId: string): Observable<void> {
    return this.templateService.deleteTemplate(templateId).pipe(
      tap(() => {
        this.templates.update((current) =>
          current.filter((template) => template.id !== templateId),
        );
      }),
    );
  }
}
