import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type ScrapClassificationKind =
  'PRODUCT_ALIAS' | 'ORGANIZATION' | 'DEPARTMENT' | 'COUNTING' | 'ITEM_TYPE';

export interface ScrapClassificationRule {
  id: string;
  kind: ScrapClassificationKind;
  source_value: string;
  source_context: string | null;
  target_value: string | null;
  target_secondary: string | null;
  boolean_value: boolean | null;
  match_mode: 'EXACT' | 'REGEX';
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ScrapClassificationRuleWrite = Omit<
  ScrapClassificationRule,
  'id' | 'created_at' | 'updated_at'
>;

@Injectable({ providedIn: 'root' })
export class ScrapClassificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/scrap/classifications`;

  list(): Observable<ScrapClassificationRule[]> {
    return this.http.get<ScrapClassificationRule[]>(this.baseUrl);
  }

  create(rule: ScrapClassificationRuleWrite): Observable<ScrapClassificationRule> {
    return this.http.post<ScrapClassificationRule>(this.baseUrl, rule);
  }

  update(id: string, rule: ScrapClassificationRuleWrite): Observable<ScrapClassificationRule> {
    return this.http.put<ScrapClassificationRule>(
      `${this.baseUrl}/${encodeURIComponent(id)}`,
      rule,
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  reapply(): Observable<{ reclassified_records: number; dashboard_revision: string }> {
    return this.http.post<{ reclassified_records: number; dashboard_revision: string }>(
      `${this.baseUrl}/reapply`,
      {},
    );
  }
}
