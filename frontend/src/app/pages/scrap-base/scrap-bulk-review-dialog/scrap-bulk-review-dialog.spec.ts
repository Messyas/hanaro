import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LanguageService } from '../../../i18n/language.service';
import { ScrapBaseService } from '../scrap-base.service';
import { ScrapReviewService } from '../scrap-review.service';
import { ScrapTemplateService } from '../scrap-template.service';
import { ScrapBulkReviewDialog } from './scrap-bulk-review-dialog';

describe('ScrapBulkReviewDialog', () => {
  let component: ScrapBulkReviewDialog;
  let fixture: ComponentFixture<ScrapBulkReviewDialog>;
  let scrapBaseServiceMock: { list: ReturnType<typeof vi.fn> };
  let reviewServiceMock: {
    getReview: ReturnType<typeof vi.fn>;
    bulkCreate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    scrapBaseServiceMock = {
      list: vi
        .fn()
        .mockReturnValue(of({ items: [], page: 1, page_size: 15, total_items: 0, total_pages: 0 })),
    };
    reviewServiceMock = {
      getReview: vi.fn(),
      bulkCreate: vi.fn(),
    };

    const scrapTemplateServiceMock = {
      templates: () => [],
      loading: () => false,
      activeTemplate: () => null,
      loadTemplates: vi.fn().mockReturnValue(of([])),
      createTemplate: vi.fn().mockReturnValue(of({})),
      deleteTemplate: vi.fn().mockReturnValue(of(undefined)),
      setActiveTemplate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ScrapBulkReviewDialog],
      providers: [
        LanguageService,
        { provide: ScrapBaseService, useValue: scrapBaseServiceMock },
        { provide: ScrapReviewService, useValue: reviewServiceMock },
        { provide: ScrapTemplateService, useValue: scrapTemplateServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrapBulkReviewDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('searches for reviewed candidate occurrences', () => {
    expect(scrapBaseServiceMock.list).toHaveBeenCalledWith({
      review_status: 'REVIEWED',
      search: undefined,
      page: 1,
      page_size: 15,
    });
  });

  it('toggles copy attachments', () => {
    expect(component.copyAttachments()).toBe(false);
    component.toggleCopyAttachments();
    expect(component.copyAttachments()).toBe(true);
  });
});
