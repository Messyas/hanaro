import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ExportJob, Page, ReportExportRequest } from '../reports.models';

@Injectable({ providedIn: 'root' })
export class ReportExportService {
  private readonly http = inject(HttpClient);

  request(request: ReportExportRequest): Observable<ExportJob> {
    return this.http.post<ExportJob>(
      `${environment.apiBaseUrl}/report-versions/${request.versionId}/exports`,
      {
        format: request.format,
        options: request.options,
        template_version: request.templateVersion,
        ...(request.retryFailed ? { retry_failed: true } : {}),
      },
    );
  }

  history(versionId: string, page = 1): Observable<Page<ExportJob>> {
    return this.http.get<Page<ExportJob>>(
      `${environment.apiBaseUrl}/report-versions/${versionId}/exports`,
      {
        params: { page, page_size: 100 },
      },
    );
  }

  status(jobId: string): Observable<ExportJob> {
    return this.http.get<ExportJob>(`${environment.apiBaseUrl}/exports/${jobId}`);
  }

  download(jobId: string): Observable<Blob> {
    return this.http.get(`${environment.apiBaseUrl}/exports/${jobId}/download`, {
      responseType: 'blob',
    });
  }
}
