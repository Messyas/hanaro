import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ScrapReview, ScrapReviewAttachment } from './scrap-review.models';
import { ScrapReviewService } from './scrap-review.service';
import { ScrapReviewWorkflowCoordinator } from './scrap-review-workflow.coordinator';

const review = (overrides: Partial<ScrapReview> = {}): ScrapReview => ({
  id: 'review-1',
  occurrence_id: 'occ-1',
  status: 'DRAFT',
  defect_type: null,
  responsible_user_id: 7,
  responsible_name: 'Reviewer',
  title: 'Review',
  description: 'Description',
  version: 2,
  source_review_id: null,
  bulk_operation_id: null,
  reviewed_at: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  attachments: [],
  ...overrides,
});

const attachment = (id: string): ScrapReviewAttachment => ({
  id,
  original_filename: `${id}.png`,
  content_type: 'image/png',
  size_bytes: 10,
  width: 1,
  height: 1,
  position: 0,
  created_at: '2026-09-01T00:00:00Z',
  url: `/attachments/${id}`,
});

describe('ScrapReviewWorkflowCoordinator', () => {
  it('saves, uploads files in order and finalizes with the latest version', () => {
    const sequence: string[] = [];
    const saved = review();
    const first = new File(['a'], 'first.png', { type: 'image/png' });
    const second = new File(['b'], 'second.png', { type: 'image/png' });
    const service = {
      saveDraft: vi.fn().mockImplementation(() => {
        sequence.push('save');
        return of(saved);
      }),
      uploadAttachment: vi.fn().mockImplementation((_reviewId: string, file: File) => {
        sequence.push(`upload:${file.name}`);
        return of(attachment(file.name));
      }),
      finalize: vi.fn().mockImplementation((_occurrenceId: string, version: number) => {
        sequence.push(`finalize:${version}`);
        return of(review({ status: 'REVIEWED', version }));
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        ScrapReviewWorkflowCoordinator,
        { provide: ScrapReviewService, useValue: service },
      ],
    });
    const coordinator = TestBed.inject(ScrapReviewWorkflowCoordinator);
    let result: unknown;

    coordinator
      .finalizeReview(
        'occ-1',
        { title: 'Review', description: 'Description', defect_type_id: null },
        [first, second],
      )
      .subscribe((value) => (result = value));

    expect(sequence).toEqual(['save', 'upload:first.png', 'upload:second.png', 'finalize:4']);
    expect(result).toMatchObject({ kind: 'finalized', review: { version: 4 } });
    expect(service.finalize).toHaveBeenCalledWith('occ-1', 4);
  });

  it('keeps successful uploads and blocks finalization when an attachment fails', () => {
    const uploaded = new File(['ok'], 'uploaded.png', { type: 'image/png' });
    const failed = new File(['bad'], 'retry.png', { type: 'image/png' });
    const service = {
      saveDraft: vi.fn().mockReturnValue(of(review())),
      uploadAttachment: vi
        .fn()
        .mockReturnValueOnce(of(attachment('uploaded')))
        .mockReturnValueOnce(throwError(() => new Error('network error'))),
      finalize: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        ScrapReviewWorkflowCoordinator,
        { provide: ScrapReviewService, useValue: service },
      ],
    });
    const coordinator = TestBed.inject(ScrapReviewWorkflowCoordinator);
    let result: unknown;

    coordinator
      .finalizeReview(
        'occ-1',
        { title: 'Review', description: 'Description', defect_type_id: null },
        [uploaded, failed],
      )
      .subscribe((value) => (result = value));

    expect(result).toMatchObject({
      kind: 'attachments-failed',
      review: { attachments: [{ id: 'uploaded' }], version: 3 },
      failedFiles: [failed],
    });
    expect(service.finalize).not.toHaveBeenCalled();
  });
});
