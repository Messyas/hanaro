import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, takeWhile, timer } from 'rxjs';
import { BrowserDownloadAdapter } from './browser-download.adapter';
import { BrowserDownloadPort } from './browser-download.port';
import { ExportFormat, ExportJob, ExportOptions, Page } from './reports.models';
import { ReportsService } from './reports.service';

@Injectable({ providedIn: 'root' })
export class ReportExportCoordinator {
  private readonly service = inject(ReportsService);
  private readonly browserDownload: BrowserDownloadPort = inject(BrowserDownloadAdapter);

  request(
    versionId: string,
    format: ExportFormat,
    options: ExportOptions,
    retry: boolean,
    templateVersion: '1' | '2',
  ): Observable<ExportJob> {
    return this.service.requestExport(versionId, format, options, retry, templateVersion);
  }

  history(versionId: string): Observable<Page<ExportJob>> {
    return this.service.exportHistory(versionId);
  }

  poll(jobId: string): Observable<ExportJob> {
    return timer(0, 1500).pipe(
      switchMap(() => this.service.exportStatus(jobId)),
      takeWhile((job) => job.status === 'QUEUED' || job.status === 'RUNNING', true),
    );
  }

  download(job: ExportJob): Observable<void> {
    if (!job.artifact) return new Observable((subscriber) => subscriber.complete());

    return new Observable((subscriber) => {
      const subscription = this.service.download(job.id).subscribe({
        next: (blob) => {
          this.browserDownload.download(blob, job.artifact?.filename ?? 'report');
          subscriber.next();
          subscriber.complete();
        },
        error: (error) => subscriber.error(error),
      });

      return () => subscription.unsubscribe();
    });
  }
}
