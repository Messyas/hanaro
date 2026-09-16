import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
    service.request('version-1', 'PDF').subscribe();
    const request = http.expectOne('/api/v1/report-versions/version-1/exports');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ format: 'PDF', options: {}, template_version: '1' });
    request.flush({ id: 'job-1', status: 'QUEUED' });
  });
});
