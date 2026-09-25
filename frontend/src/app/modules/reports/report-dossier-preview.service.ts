import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ReportPreview } from './reports.models';

@Injectable({ providedIn: 'root' })
export class ReportDossierPreviewService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/reports`;

  load(reportId: string): Observable<ReportPreview> {
    return this.http.get<ReportPreview>(`${this.base}/${reportId}/preview`);
  }
}
