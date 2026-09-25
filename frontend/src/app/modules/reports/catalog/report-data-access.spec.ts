import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReportCatalogService } from './report-catalog.service';
import { ReportPeriodCloseService } from '../period-close/report-period-close.service';

describe('Report data access services', () => {
  let catalog: ReportCatalogService;
  let periodClose: ReportPeriodCloseService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportCatalogService,
        ReportPeriodCloseService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    catalog = TestBed.inject(ReportCatalogService);
    periodClose = TestBed.inject(ReportPeriodCloseService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses server-side pagination and filters', () => {
    catalog.list({ page: 2, pageSize: 50, search: 'weekly', status: 'PUBLISHED' }).subscribe();
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

  it('requests paginated action candidates', () => {
    periodClose
      .eligibleActions('factory-1', { page: 3, pageSize: 25, search: 'setup' })
      .subscribe();
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
});
