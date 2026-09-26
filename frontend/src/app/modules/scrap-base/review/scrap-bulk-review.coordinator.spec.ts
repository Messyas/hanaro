import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ScrapListItem } from '../list/scrap-base.models';
import { ScrapReviewTemplate } from '../templates/scrap-template.models';
import { ScrapReviewService } from './scrap-review.service';
import { ScrapBulkReviewCoordinator } from './scrap-bulk-review.coordinator';

const selectableItem = (occurrenceId: string): ScrapListItem => ({
  id: `transaction-${occurrenceId}`,
  occurrence_id: occurrenceId,
  current_transaction_id: null,
  source_line: 1,
  organization_code: 'ORG',
  account_code: 'ACC',
  account_alias: 'Account',
  receipt_department: null,
  item_code: 'ITEM',
  item_description: null,
  transaction_date: '2026-09-01',
  issue_quantity: '1',
  issue_amount_brl: '1',
  work_order: null,
  amount_usd: '1',
  to_be_counted: true,
  occurrence_status: 'ACTIVE',
  review_id: null,
  review_status: null,
  defect_type_id: null,
  defect_type_name: null,
  responsible_user_id: null,
  responsible_name: null,
  reviewed_at: null,
  review_updated_at: null,
  attachment_count: 0,
});

const template: ScrapReviewTemplate = {
  id: 'template-1',
  name: 'Template',
  title: 'Review title',
  description: 'Review description',
  defect_type_id: null,
  created_by_user_id: 1,
  source_review_id: null,
  is_active: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

describe('ScrapBulkReviewCoordinator', () => {
  let coordinator: ScrapBulkReviewCoordinator;
  let reviewService: { bulkCreate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reviewService = {
      bulkCreate: vi.fn().mockReturnValue(
        of({
          operation_id: 'operation-1',
          status: 'partial',
          requested_count: 2,
          created_count: 1,
          skipped_count: 1,
          created_occurrence_ids: ['occ-1'],
          skipped: [{ occurrence_id: 'occ-2', reason: 'ALREADY_REVIEWED' }],
        }),
      ),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: ScrapReviewService, useValue: reviewService }],
    });
    coordinator = TestBed.inject(ScrapBulkReviewCoordinator);
  });

  it('keeps ineligible items out of selection and enforces the 500 item limit', () => {
    expect(coordinator.toggleItemSelection(null, [])).toBe('ignored');
    expect(
      coordinator.toggleItemSelection(
        { ...selectableItem('inactive'), occurrence_status: 'INACTIVE' },
        [],
      ),
    ).toBe('ignored');

    const items = Array.from({ length: 501 }, (_, index) => selectableItem(`occ-${index}`));
    for (const item of items.slice(0, 500)) {
      expect(coordinator.toggleItemSelection(item, items)).toBe('selected');
    }

    expect(coordinator.toggleItemSelection(items[500], items)).toBe('limit-reached');
    expect(coordinator.selectedCount()).toBe(500);
  });

  it('removes only created IDs after a partial result and clears its active source', () => {
    coordinator.selectionMode.set(true);
    coordinator.selectedOccurrenceIds.set(new Set(['occ-1', 'occ-2']));
    coordinator.activeTemplate.set(template);

    coordinator.executeBulk(false).subscribe();

    expect(reviewService.bulkCreate).toHaveBeenCalledWith({
      occurrence_ids: ['occ-1', 'occ-2'],
      copy_attachments: false,
      template_id: 'template-1',
    });
    expect(coordinator.selectedOccurrenceIds()).toEqual(new Set(['occ-2']));
    expect(coordinator.activeTemplate()).toBeNull();
    expect(coordinator.bulkResult()?.skipped[0]?.occurrence_id).toBe('occ-2');
    expect(coordinator.selectionMode()).toBe(true);
    expect(coordinator.isSubmitting()).toBe(false);
  });
});
