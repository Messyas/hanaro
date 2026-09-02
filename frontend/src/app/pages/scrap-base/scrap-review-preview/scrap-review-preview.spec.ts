import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../../i18n/language.service';
import { ScrapReview } from '../scrap-review.models';
import { ScrapReviewPreview } from './scrap-review-preview';

describe('ScrapReviewPreview', () => {
  let component: ScrapReviewPreview;
  let fixture: ComponentFixture<ScrapReviewPreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrapReviewPreview],
      providers: [LanguageService],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrapReviewPreview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders default empty values when no review is supplied', () => {
    expect(component.displayTitle()).toBe('—');
    expect(component.displayDescription()).toBe('');
  });

  it('renders review title and description from input', () => {
    const mockReview: ScrapReview = {
      id: 'rev-1',
      occurrence_id: 'occ-1',
      status: 'REVIEWED',
      defect_type: {
        id: 't-1',
        code: 'DEF',
        name: 'Solda Trincada',
        description: null,
        display_order: 1,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      responsible_user_id: 1,
      responsible_name: 'Maria Analista',
      title: 'Trinca na carcaça de alumínio',
      description: 'Causa: vibração excessiva no transporte.',
      version: 1,
      source_review_id: null,
      bulk_operation_id: null,
      reviewed_at: '2026-08-30T10:00:00Z',
      created_at: '2026-08-30T09:00:00Z',
      updated_at: '2026-08-30T10:00:00Z',
      attachments: [],
    };

    fixture.componentRef.setInput('review', mockReview);
    fixture.detectChanges();

    expect(component.displayTitle()).toBe('Trinca na carcaça de alumínio');
    expect(component.displayDescription()).toBe('Causa: vibração excessiva no transporte.');
    expect(component.displayDefectType()).toBe('Solda Trincada');
    expect(component.displayResponsible()).toBe('Maria Analista');
    expect(component.isReviewed()).toBe(true);
  });
});
