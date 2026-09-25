import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ReportDetail, UpdateReportCommand } from './reports.models';

@Injectable({ providedIn: 'root' })
export class ReportEditorService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/reports';

  update(command: UpdateReportCommand): Observable<ReportDetail> {
    return this.http.patch<ReportDetail>(`${this.base}/${command.reportId}`, {
      expected_version: command.expectedVersion,
      title: command.title,
      description: command.description,
    });
  }
}
