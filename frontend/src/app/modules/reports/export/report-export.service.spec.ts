import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReportExportRequestBuilder } from '../reports.models';
import { ReportExportService } from './report-export.service';

describe('ReportExportService', () => {
  let service: ReportExportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReportExportService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportExportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests an idempotent asynchronous export contract', () => {
    const request = ReportExportRequestBuilder.forVersion({
      id: 'version-1',
      content_schema_version: 1,
    } as never).build();
    service.request(request).subscribe();
    const httpRequest = http.expectOne('/api/v1/report-versions/version-1/exports');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual({
      format: 'PDF',
      options: {
        language: 'pt',
        include_money: true,
        include_summary: true,
        include_occurrences: true,
        include_justifications: true,
        include_evidence: true,
        notify_on_completion: false,
      },
      template_version: '1',
    });
    httpRequest.flush({ id: 'job-1', status: 'QUEUED' });
  });
});
