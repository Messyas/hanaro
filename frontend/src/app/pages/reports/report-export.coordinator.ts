import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, takeWhile, timer } from 'rxjs';
import { BrowserDownloadAdapter } from './browser-download.adapter';
import { BrowserDownloadPort } from './browser-download.port';
import {
  ExportFormat,
  ExportJob,
  ExportOptions,
  Page,
  ReportExportRequestBuilder,
  ReportVersion,
} from './reports.models';
import { ReportExportService } from './report-export.service';

@Injectable({ providedIn: 'root' })
export class ReportExportCoordinator {
  private readonly service = inject(ReportExportService);
  private readonly browserDownload: BrowserDownloadPort = inject(BrowserDownloadAdapter);

  request(
    version: ReportVersion,
    format: ExportFormat,
    options: ExportOptions,
    currentJob: ExportJob | undefined,
  ): Observable<ExportJob> {
    const request = ReportExportRequestBuilder.forVersion(version)
      .withFormat(format)
      .withOptions(options)
      .retryAfter(currentJob)
      .build();
    return this.service.request(request);
  }

  history(versionId: string): Observable<Page<ExportJob>> {
    return this.service.history(versionId);
  }

  poll(jobId: string): Observable<ExportJob> {
    return timer(0, 1500).pipe(
      switchMap(() => this.service.status(jobId)),
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
