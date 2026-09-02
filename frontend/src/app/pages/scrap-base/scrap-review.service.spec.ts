import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ScrapReviewService } from './scrap-review.service';
import {
  ScrapDefectType,
  ScrapReview,
  ScrapReviewAttachment,
  ScrapReviewBulkCreate,
  ScrapReviewBulkResult,
  ScrapReviewWrite,
} from './scrap-review.models';

describe('ScrapReviewService', () => {
  let service: ScrapReviewService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScrapReviewService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ScrapReviewService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('fetches defect types', () => {
    const mockTypes: ScrapDefectType[] = [
      {
        id: 'type-1',
        code: 'DEF-01',
        name: 'Defeito de solda',
        description: 'Solda fria',
        display_order: 1,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    service.getDefectTypes().subscribe((result) => expect(result).toEqual(mockTypes));

    const req = httpTesting.expectOne('/api/v1/scrap/review-types');
    expect(req.request.method).toBe('GET');
    req.flush(mockTypes);
  });

  it('fetches review by occurrenceId', () => {
    const mockReview: ScrapReview = {
      id: 'rev-1',
      occurrence_id: 'occ-123',
      status: 'DRAFT',
      defect_type: null,
      responsible_user_id: 10,
      responsible_name: 'Usuário Teste',
      title: 'Título',
      description: 'Desc',
      version: 1,
      source_review_id: null,
      bulk_operation_id: null,
      reviewed_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      attachments: [],
    };

    service.getReview('occ-123').subscribe((result) => expect(result).toEqual(mockReview));

    const req = httpTesting.expectOne('/api/v1/scrap/reviews/occ-123');
    expect(req.request.method).toBe('GET');
    req.flush(mockReview);
  });

  it('saves draft with PUT and expected version', () => {
    const payload: ScrapReviewWrite = {
      defect_type_id: 'type-1',
      title: 'Novo título',
      description: 'Nova descrição',
      expected_version: 2,
    };

    service.saveDraft('occ-123', payload).subscribe();

    const req = httpTesting.expectOne('/api/v1/scrap/reviews/occ-123');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'rev-1', version: 3 });
  });

  it('finalizes review with POST and expected_version query param', () => {
    service.finalize('occ-123', 3).subscribe();

    const req = httpTesting.expectOne((r) => r.url === '/api/v1/scrap/reviews/occ-123/finalize');
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('expected_version')).toBe('3');
    req.flush({ id: 'rev-1', status: 'REVIEWED' });
  });

  it('uploads attachment as multipart with image field', () => {
    const file = new File(['dummy-content'], 'evidence.png', { type: 'image/png' });
    const mockAttachment: ScrapReviewAttachment = {
      id: 'att-1',
      original_filename: 'evidence.png',
      content_type: 'image/png',
      size_bytes: 13,
      width: 100,
      height: 100,
      position: 1,
      created_at: '2026-01-01T00:00:00Z',
      url: '/api/v1/scrap/reviews/by-id/rev-1/attachments/att-1',
    };

    service.uploadAttachment('rev-1', file).subscribe((res) => expect(res).toEqual(mockAttachment));

    const req = httpTesting.expectOne('/api/v1/scrap/reviews/by-id/rev-1/attachments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const formData = req.request.body as FormData;
    expect(formData.has('image')).toBe(true);
    req.flush(mockAttachment);
  });

  it('deletes attachment with DELETE', () => {
    service.deleteAttachment('rev-1', 'att-1').subscribe();

    const req = httpTesting.expectOne('/api/v1/scrap/reviews/by-id/rev-1/attachments/att-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('creates reviews in bulk', () => {
    const payload: ScrapReviewBulkCreate = {
      reference_review_id: 'ref-1',
      occurrence_ids: ['occ-1', 'occ-2'],
      copy_attachments: false,
    };

    const mockResult: ScrapReviewBulkResult = {
      operation_id: 'op-1',
      status: 'COMPLETED',
      requested_count: 2,
      created_count: 2,
      skipped_count: 0,
      created_occurrence_ids: ['occ-1', 'occ-2'],
      skipped: [],
    };

    service.bulkCreate(payload).subscribe((res) => expect(res).toEqual(mockResult));

    const req = httpTesting.expectOne('/api/v1/scrap/reviews/bulk');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResult);
  });
});
