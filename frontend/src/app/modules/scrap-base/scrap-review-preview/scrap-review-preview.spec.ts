import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../../core/i18n/language.service';
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

  it('renders default values when no review is supplied', () => {
    expect(component.displayTitle()).toBe('Relatório de Scrap');
    expect(component.displayDescription()).toBe('');
    expect(component.renderedDescriptionHtml()).toBe('');
  });

  it('renders review title, description, and metadata from input', () => {
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

  it('renders markdown syntax into formatted HTML elements', () => {
    const markdown = `## Causa Raiz
Identificada **falha de soldagem** no pino \`J1\`.

- Linha 4
- Operador 12

> Atenção: requer revisão na bancada.`;

    fixture.componentRef.setInput('draftForm', {
      defectTypeId: 't-1',
      title: 'Relatório Técnico',
      description: markdown,
    });
    fixture.detectChanges();

    const html = component.renderedDescriptionHtml();
    expect(html).toContain('<h2 class="md-h2">Causa Raiz</h2>');
    expect(html).toContain('<strong>falha de soldagem</strong>');
    expect(html).toContain('<code class="md-inline-code">J1</code>');
    expect(html).toContain('<ul class="md-ul">');
    expect(html).toContain('<li>Linha 4</li>');
    expect(html).toContain('<blockquote class="md-quote">');
  });

  it('combines review attachments with draft pending attachments without duplicates', () => {
    const mockReview: ScrapReview = {
      id: 'rev-1',
      occurrence_id: 'occ-1',
      status: 'DRAFT',
      defect_type: null,
      responsible_user_id: 1,
      responsible_name: 'Maria Analista',
      title: 'Teste',
      description: '',
      version: 1,
      source_review_id: null,
      bulk_operation_id: null,
      reviewed_at: null,
      created_at: '',
      updated_at: '',
      attachments: [
        {
          id: 'att-1',
          url: 'https://cdn.example.com/foto1.webp',
          original_filename: 'foto1.webp',
          content_type: 'image/webp',
          size_bytes: 1024,
          width: 800,
          height: 600,
          position: 1,
          created_at: '',
        },
      ],
    };

    fixture.componentRef.setInput('review', mockReview);
    fixture.componentRef.setInput('draftAttachments', [
      { url: 'blob:http://localhost/pending-1', name: 'foto2.jpg' },
      { url: 'https://cdn.example.com/foto1.webp', name: 'foto1.webp' }, // Duplicata proposital
    ]);
    fixture.detectChanges();

    const images = component.allImages();
    expect(images.length).toBe(2);
    expect(images[0].url).toBe('https://cdn.example.com/foto1.webp');
    expect(images[1].url).toBe('blob:http://localhost/pending-1');
  });
});
