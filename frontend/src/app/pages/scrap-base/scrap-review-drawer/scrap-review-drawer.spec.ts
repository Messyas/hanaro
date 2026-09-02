import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../i18n/language.service';
import { ScrapReview } from '../scrap-review.models';
import { ScrapReviewService } from '../scrap-review.service';
import { ScrapTemplateService } from '../scrap-template.service';
import { ScrapReviewDrawer } from './scrap-review-drawer';

describe('ScrapReviewDrawer', () => {
  let component: ScrapReviewDrawer;
  let fixture: ComponentFixture<ScrapReviewDrawer>;
  let reviewServiceMock: {
    getDefectTypes: ReturnType<typeof vi.fn>;
    getReview: ReturnType<typeof vi.fn>;
    saveDraft: ReturnType<typeof vi.fn>;
    finalize: ReturnType<typeof vi.fn>;
    uploadAttachment: ReturnType<typeof vi.fn>;
    deleteAttachment: ReturnType<typeof vi.fn>;
  };

  const mockReview: ScrapReview = {
    id: 'rev-1',
    occurrence_id: 'occ-1',
    status: 'DRAFT',
    defect_type: null,
    responsible_user_id: 1,
    responsible_name: 'Usuário Teste',
    title: 'Defeito encontrado',
    description: 'Descrição de teste',
    version: 1,
    source_review_id: null,
    bulk_operation_id: null,
    reviewed_at: null,
    created_at: '',
    updated_at: '',
    attachments: [],
  };

  beforeEach(async () => {
    reviewServiceMock = {
      getDefectTypes: vi.fn().mockReturnValue(of([])),
      getReview: vi.fn().mockReturnValue(of(mockReview)),
      saveDraft: vi.fn().mockReturnValue(of(mockReview)),
      finalize: vi.fn().mockReturnValue(of({ ...mockReview, status: 'REVIEWED' })),
      uploadAttachment: vi.fn(),
      deleteAttachment: vi.fn().mockReturnValue(of(undefined)),
    };

    const authServiceMock = {
      user: () => ({ name: 'Usuário Teste', username: 'user.teste' }),
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
      imports: [ScrapReviewDrawer],
      providers: [
        LanguageService,
        { provide: ScrapReviewService, useValue: reviewServiceMock },
        { provide: ScrapTemplateService, useValue: scrapTemplateServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrapReviewDrawer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads review on activeOccurrenceId', () => {
    fixture.componentRef.setInput('occurrenceId', 'occ-1');
    fixture.detectChanges();

    expect(reviewServiceMock.getReview).toHaveBeenCalledWith('occ-1');
    expect(component.review()).toEqual(mockReview);
  });

  it('toggles preview mode', () => {
    expect(component.isPreviewMode()).toBe(false);
    component.togglePreviewMode();
    expect(component.isPreviewMode()).toBe(true);
  });
});
