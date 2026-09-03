import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
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
  let templatesSignal: ReturnType<typeof signal<any[]>>;
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

  const mockReviewedReview: ScrapReview = {
    ...mockReview,
    id: 'rev-2',
    status: 'REVIEWED',
    reviewed_at: '2026-09-02T12:00:00Z',
    version: 2,
    defect_type: {
      id: 'dt-1',
      code: 'OXIDACAO',
      name: 'Oxidação',
      description: null,
      display_order: 1,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
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
      user: () => ({ id: 1, name: 'Usuário Teste', username: 'user.teste' }),
    };

    templatesSignal = signal<any[]>([]);
    const scrapTemplateServiceMock = {
      templates: templatesSignal,
      loading: () => false,
      activeTemplate: () => null,
      loadTemplates: vi.fn().mockReturnValue(of([])),
      createTemplate: vi.fn().mockReturnValue(of({})),
      updateTemplate: vi.fn().mockReturnValue(of({})),
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

  it('toggles preview mode for drafts', () => {
    expect(component.isPreviewMode()).toBe(false);
    component.togglePreviewMode();
    expect(component.isPreviewMode()).toBe(true);
  });

  it('renders edit button next to favorite for reviewed occurrence and enables editing', () => {
    reviewServiceMock.getReview.mockReturnValue(of(mockReviewedReview));
    fixture.componentRef.setInput('occurrenceId', 'occ-1');
    fixture.detectChanges();

    expect(component.review()?.status).toBe('REVIEWED');
    expect(component.isPreviewMode()).toBe(true);
    expect(component.isReadOnly()).toBe(true);

    const editBtn = fixture.nativeElement.querySelector('.edit-report-btn');
    expect(editBtn).toBeTruthy();

    // Inicia edição do relatório finalizado
    component.toggleEditFinalized();
    fixture.detectChanges();

    expect(component.isEditingFinalized()).toBe(true);
    expect(component.isPreviewMode()).toBe(false);
    expect(component.isReadOnly()).toBe(false);

    // Altera valores e salva
    component.localFormModel.set({
      defectTypeId: 'dt-1',
      title: 'Título Editado',
      description: 'Descrição Editada',
    });

    const updatedReview: ScrapReview = {
      ...mockReviewedReview,
      title: 'Título Editado',
      description: 'Descrição Editada',
      version: 3,
    };
    reviewServiceMock.saveDraft.mockReturnValue(of(updatedReview));

    component.saveFinalizedEdit();

    expect(reviewServiceMock.saveDraft).toHaveBeenCalledWith('occ-1', {
      defect_type_id: 'dt-1',
      title: 'Título Editado',
      description: 'Descrição Editada',
      expected_version: 2,
    });
    expect(component.isEditingFinalized()).toBe(false);
    expect(component.isPreviewMode()).toBe(true);
    expect(component.review()?.title).toBe('Título Editado');
  });

  it('cancels finalized review editing and restores previous values', () => {
    reviewServiceMock.getReview.mockReturnValue(of(mockReviewedReview));
    fixture.componentRef.setInput('occurrenceId', 'occ-1');
    fixture.detectChanges();

    component.startEditFinalized();
    expect(component.isEditingFinalized()).toBe(true);

    component.localFormModel.set({
      defectTypeId: 'dt-1',
      title: 'Mudança não salva',
      description: 'Descrição não salva',
    });

    component.cancelEditFinalized();

    expect(component.isEditingFinalized()).toBe(false);
    expect(component.isPreviewMode()).toBe(true);
    expect(component.localFormModel().title).toBe(mockReviewedReview.title);
  });

  it('uploads pending files before finalizing and renders in preview mode', () => {
    fixture.componentRef.setInput('occurrenceId', 'occ-1');
    fixture.detectChanges();

    const mockFile = new File(['fake-image-bytes'], 'evidencia.png', { type: 'image/png' });
    component.pendingUploadFiles.set([mockFile]);
    component.localFormModel.set({
      defectTypeId: 'dt-1',
      title: 'Título Completo',
      description: 'Descrição Completa',
    });

    const savedDraftReview: ScrapReview = {
      ...mockReview,
      id: 'rev-draft-1',
      version: 1,
    };
    reviewServiceMock.saveDraft.mockReturnValue(of(savedDraftReview));

    const mockUploadedAttachment = {
      id: 'att-1',
      url: '/api/v1/scrap/reviews/by-id/rev-draft-1/attachments/att-1',
      original_filename: 'evidencia.png',
      content_type: 'image/webp',
      size_bytes: 1024,
      width: 100,
      height: 100,
      position: 1,
      created_at: '',
    };
    reviewServiceMock.uploadAttachment.mockReturnValue(of(mockUploadedAttachment));

    const finalReviewed: ScrapReview = {
      ...savedDraftReview,
      status: 'REVIEWED',
      version: 2,
      attachments: [mockUploadedAttachment],
    };
    reviewServiceMock.finalize.mockReturnValue(of(finalReviewed));

    component.confirmFinalize();

    expect(reviewServiceMock.saveDraft).toHaveBeenCalled();
    expect(reviewServiceMock.uploadAttachment).toHaveBeenCalledWith('rev-draft-1', mockFile);
    expect(reviewServiceMock.finalize).toHaveBeenCalledWith('occ-1', 2);
    expect(component.review()?.status).toBe('REVIEWED');
    expect(component.review()?.attachments.length).toBe(1);
    expect(component.isPreviewMode()).toBe(true);
  });

  it('operates in review queue mode with multiple occurrences and navigates', () => {
    fixture.componentRef.setInput('queueOccurrenceIds', ['occ-101', 'occ-102', 'occ-103']);
    fixture.detectChanges();

    expect(component.isQueueMode()).toBe(true);
    expect(component.queueTotal()).toBe(3);
    expect(component.queueCurrentDisplay()).toBe(1);
    expect(component.isQueueFirst()).toBe(true);
    expect(component.isQueueLast()).toBe(false);
    expect(component.activeOccurrenceId()).toBe('occ-101');

    component.nextInQueue();
    expect(component.queueIndex()).toBe(1);
    expect(component.queueCurrentDisplay()).toBe(2);
    expect(component.isQueueFirst()).toBe(false);
    expect(component.isQueueLast()).toBe(false);
    expect(component.activeOccurrenceId()).toBe('occ-102');

    component.previousInQueue();
    expect(component.queueIndex()).toBe(0);
    expect(component.isQueueFirst()).toBe(true);
  });

  it('advances in queue when finalized and finishes queue on last item', () => {
    fixture.componentRef.setInput('queueOccurrenceIds', ['occ-101', 'occ-102']);
    fixture.detectChanges();

    component.localFormModel.set({
      defectTypeId: 'dt-1',
      title: 'Item 1 Revisado',
      description: 'Descrição 1',
    });

    const queueFinishedSpy = vi.spyOn(component.queueFinished, 'emit');

    component.confirmFinalize();
    expect(component.queueIndex()).toBe(1);
    expect(component.activeOccurrenceId()).toBe('occ-102');
    expect(queueFinishedSpy).not.toHaveBeenCalled();

    component.localFormModel.set({
      defectTypeId: 'dt-1',
      title: 'Item 2 Revisado',
      description: 'Descrição 2',
    });

    component.confirmFinalize();
    expect(queueFinishedSpy).toHaveBeenCalled();
  });

  it('renders heart-filled icon when report is favorited and heart outline when not', () => {
    reviewServiceMock.getReview.mockReturnValue(of(mockReviewedReview));
    fixture.componentRef.setInput('occurrenceId', 'occ-1');
    fixture.detectChanges();

    expect(component.isFavoriteTemplate()).toBe(false);
    let heartIcon = fixture.nativeElement.querySelector('.template-heart-btn ui-icon');
    expect(heartIcon).toBeTruthy();

    // Salva o modelo como favorito
    templatesSignal.set([
      {
        id: 'tpl-1',
        source_review_id: 'rev-2',
        name: 'Template 1',
        title: 'Title',
        description: 'Desc',
        created_by_user_id: 1,
        is_active: true,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
    ]);
    fixture.detectChanges();

    expect(component.isFavoriteTemplate()).toBe(true);
  });
});
