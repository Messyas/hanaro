import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ScrapDefectType,
  ScrapReview,
  ScrapReviewAttachment,
  ScrapReviewBulkCreate,
  ScrapReviewBulkResult,
  ScrapReviewWrite,
} from './scrap-review.models';

@Injectable({ providedIn: 'root' })
export class ScrapReviewService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/scrap';

  getDefectTypes(includeInactive = false): Observable<ScrapDefectType[]> {
    let params = new HttpParams();
    if (includeInactive) {
      params = params.set('include_inactive', 'true');
    }
    return this.http.get<ScrapDefectType[]>(`${this.baseUrl}/review-types`, { params });
  }

  createDefectType(payload: {
    code: string;
    name: string;
    description?: string | null;
    display_order?: number;
  }): Observable<ScrapDefectType> {
    return this.http.post<ScrapDefectType>(`${this.baseUrl}/review-types`, payload);
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
    return this.http.patch<ScrapDefectType>(
      `${this.baseUrl}/review-types/${encodeURIComponent(id)}`,
      payload,
    );
  }

  deleteDefectType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/review-types/${encodeURIComponent(id)}`);
  }

  getReview(occurrenceId: string): Observable<ScrapReview> {
    return this.http.get<ScrapReview>(
      `${this.baseUrl}/reviews/${encodeURIComponent(occurrenceId)}`,
    );
  }

  saveDraft(occurrenceId: string, payload: ScrapReviewWrite): Observable<ScrapReview> {
    return this.http.put<ScrapReview>(
      `${this.baseUrl}/reviews/${encodeURIComponent(occurrenceId)}`,
      payload,
    );
  }

  finalize(occurrenceId: string, expectedVersion?: number | null): Observable<ScrapReview> {
    let params = new HttpParams();
    if (expectedVersion !== undefined && expectedVersion !== null) {
      params = params.set('expected_version', String(expectedVersion));
    }
    return this.http.post<ScrapReview>(
      `${this.baseUrl}/reviews/${encodeURIComponent(occurrenceId)}/finalize`,
      null,
      { params },
    );
  }

  uploadAttachment(reviewId: string, file: File): Observable<ScrapReviewAttachment> {
    const formData = new FormData();
    formData.append('image', file, file.name);

    return this.http.post<ScrapReviewAttachment>(
      `${this.baseUrl}/reviews/by-id/${encodeURIComponent(reviewId)}/attachments`,
      formData,
    );
  }

  deleteAttachment(reviewId: string, attachmentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/reviews/by-id/${encodeURIComponent(reviewId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
  }

  bulkCreate(payload: ScrapReviewBulkCreate): Observable<ScrapReviewBulkResult> {
    return this.http.post<ScrapReviewBulkResult>(`${this.baseUrl}/reviews/bulk`, payload);
  }
}
