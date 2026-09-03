import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LanguageService } from '../../../i18n/language.service';
import { ScrapReview } from '../scrap-review.models';
import { ScrapReviewService } from '../scrap-review.service';
import { ScrapReviewTemplate } from '../scrap-template.models';
import { ScrapBulkReviewDialog } from './scrap-bulk-review-dialog';

describe('ScrapBulkReviewDialog', () => {
  let component: ScrapBulkReviewDialog;
  let fixture: ComponentFixture<ScrapBulkReviewDialog>;
  let reviewServiceMock: { bulkCreate: ReturnType<typeof vi.fn> };

  const bulkResult = {
    operation_id: 'bulk-1',
    status: 'COMPLETED',
    requested_count: 2,
    created_count: 2,
    skipped_count: 0,
    created_occurrence_ids: ['occ-1', 'occ-2'],
    skipped: [],
  };

  beforeEach(async () => {
    reviewServiceMock = { bulkCreate: vi.fn().mockReturnValue(of(bulkResult)) };
    await TestBed.configureTestingModule({
      imports: [ScrapBulkReviewDialog],
      providers: [LanguageService, { provide: ScrapReviewService, useValue: reviewServiceMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(ScrapBulkReviewDialog);
    component = fixture.componentInstance;
  });

  it('applies the selected template to occurrences chosen in the main table', () => {
    const template = {
      id: 'tpl-1',
      name: 'Modelo de oxidação',
      title: 'Oxidação identificada',
      description: 'Análise padrão',
      defect_type_id: 'def-1',
      created_by_user_id: 1,
      source_review_id: 'rev-1',
      defect_type: null,
      is_active: true,
      created_at: '',
      updated_at: '',
    } satisfies ScrapReviewTemplate;
    fixture.componentRef.setInput('selectedOccurrenceIds', ['occ-1', 'occ-2']);
    fixture.componentRef.setInput('preselectedTemplate', template);
    fixture.detectChanges();

    const completedSpy = vi.spyOn(component.bulkCompleted, 'emit');
    component.executeBulk();

    expect(reviewServiceMock.bulkCreate).toHaveBeenCalledWith({
      template_id: 'tpl-1',
      occurrence_ids: ['occ-1', 'occ-2'],
      copy_attachments: false,
    });
    expect(completedSpy).toHaveBeenCalledWith(bulkResult);
  });

  it('keeps attachment copying opt-in for a direct report reference', () => {
    const reference = {
      id: 'rev-ref-1',
      occurrence_id: 'occ-ref',
      status: 'REVIEWED',
      defect_type: null,
      responsible_user_id: 1,
      responsible_name: 'Analista',
      title: 'Relatório de referência',
      description: 'Descrição',
      version: 1,
      source_review_id: null,
      bulk_operation_id: null,
      reviewed_at: '',
      created_at: '',
      updated_at: '',
      attachments: [
        {
          id: 'att-1',
          original_filename: 'evidencia.webp',
          content_type: 'image/webp',
          size_bytes: 100,
          width: 10,
          height: 10,
          position: 1,
          created_at: '',
          url: '/attachment/att-1',
        },
      ],
    } satisfies ScrapReview;
    fixture.componentRef.setInput('selectedOccurrenceIds', ['occ-1']);
    fixture.componentRef.setInput('preselectedReference', reference);
    fixture.detectChanges();
    component.toggleCopyAttachments();
    component.executeBulk();

    expect(reviewServiceMock.bulkCreate).toHaveBeenCalledWith({
      reference_review_id: 'rev-ref-1',
      occurrence_ids: ['occ-1'],
      copy_attachments: true,
    });
  });
});
