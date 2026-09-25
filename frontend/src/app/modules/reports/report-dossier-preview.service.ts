import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ReportPreview } from './reports.models';

@Injectable({ providedIn: 'root' })
export class ReportDossierPreviewService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/reports';

  load(reportId: string): Observable<ReportPreview> {
    return this.http.get<ReportPreview>(`${this.base}/${reportId}/preview`);
  }
}
