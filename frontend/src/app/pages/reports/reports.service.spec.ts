import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReportsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses server-side pagination and filters', () => {
    service.list({ page: 2, pageSize: 50, search: 'weekly', status: 'PUBLISHED' }).subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/api/v1/reports');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('page_size')).toBe('50');
    expect(request.request.params.get('search')).toBe('weekly');
    expect(request.request.params.get('status')).toBe('PUBLISHED');
    request.flush({
      items: [],
      page: 2,
      page_size: 50,
      total: 0,
      total_pages: 0,
      has_next: false,
      has_previous: true,
    });
  });

  it('sends bulk sources with expected_version', () => {
    service.mutateSources('report-1', 'occurrence', 'add', 7, ['occ-1', 'occ-2']).subscribe();
    const request = http.expectOne('/api/v1/reports/report-1/occurrence-sources/add');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ expected_version: 7, ids: ['occ-1', 'occ-2'] });
    request.flush({});
  });

  it('requests paginated action candidates', () => {
    service.eligibleActions('factory-1', { page: 3, pageSize: 25, search: 'setup' }).subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/reports/eligible-actions',
    );
    expect(request.request.params.get('factory_id')).toBe('factory-1');
    expect(request.request.params.get('page')).toBe('3');
    expect(request.request.params.get('page_size')).toBe('25');
    expect(request.request.params.get('search')).toBe('setup');
    request.flush({
      items: [],
      page: 3,
      page_size: 25,
      total: 0,
      total_pages: 0,
      has_next: false,
      has_previous: true,
    });
  });

  it('requests an idempotent asynchronous export contract', () => {
    service.requestExport('version-1', 'PDF').subscribe();
    const request = http.expectOne('/api/v1/report-versions/version-1/exports');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ format: 'PDF', options: {}, template_version: '1' });
    request.flush({ id: 'job-1', status: 'QUEUED' });
  });
});
