import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GovernanceService } from './governance.service';

describe('GovernanceService task evidence', () => {
  let service: GovernanceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GovernanceService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GovernanceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends plan filters and sort with server-side pagination', () => {
    service.plans(2, 10, { search: ' Supplier ', status: 'OPEN', sort: 'oldest' }).subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/v1/action-plans');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('page_size')).toBe('10');
    expect(request.request.params.get('search')).toBe('Supplier');
    expect(request.request.params.get('status')).toBe('OPEN');
    expect(request.request.params.get('sort')).toBe('oldest');
    request.flush({ items: [], total: 0, has_next: false });
  });

  it('uploads a file with the expected task version', () => {
    const file = new File(['proof'], 'proof.png', { type: 'image/png' });
    service.uploadEvidence('task-1', 3, file).subscribe();

    const request = http.expectOne('/api/v1/actions/task-1/evidence');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    const sentFile = request.request.body.get('file') as File;
    expect([sentFile.name, sentFile.type, sentFile.size]).toEqual([
      file.name,
      file.type,
      file.size,
    ]);
    expect(request.request.body.get('expected_version')).toBe('3');
    request.flush({ id: 'task-1', version: 4 });
  });

  it('soft-removes by version and downloads through the authenticated HTTP client', () => {
    service.removeEvidence('task-1', 'evidence-1', 4).subscribe();
    const removal = http.expectOne(
      (request) => request.url === '/api/v1/actions/task-1/evidence/evidence-1',
    );
    expect(removal.request.method).toBe('DELETE');
    expect(removal.request.params.get('expected_version')).toBe('4');
    removal.flush({ id: 'task-1', version: 5 });

    service.downloadEvidence('task-1', 'evidence-1').subscribe();
    const download = http.expectOne('/api/v1/actions/task-1/evidence/evidence-1/download');
    expect(download.request.method).toBe('GET');
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob(['proof']));
  });
});
