import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ScrapReviewAttachment } from '../scrap-review.models';
import { ScrapReviewAttachments } from './scrap-review-attachments';

describe('ScrapReviewAttachments', () => {
  let component: ScrapReviewAttachments;
  let fixture: ComponentFixture<ScrapReviewAttachments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrapReviewAttachments],
      providers: [LanguageService],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrapReviewAttachments);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes with empty attachments', () => {
    expect(component.totalCount()).toBe(0);
    expect(component.canAddMore()).toBe(true);
  });

  it('opens and closes lightbox', () => {
    component.openLightbox('test.png', 'Test Photo');
    expect(component.lightboxItem()).toEqual({ url: 'test.png', name: 'Test Photo' });

    component.closeLightbox();
    expect(component.lightboxItem()).toBeNull();
  });

  it('closes lightbox on escape key', () => {
    component.openLightbox('test.png', 'Test Photo');
    component.onEscape();
    expect(component.lightboxItem()).toBeNull();
  });

  it('combines persisted attachments and local items in displayItems without duplicates', () => {
    const mockAtt: ScrapReviewAttachment = {
      id: 'att-1',
      url: '/api/v1/scrap/reviews/by-id/rev-1/attachments/att-1',
      original_filename: 'foto1.jpg',
      content_type: 'image/jpeg',
      size_bytes: 2048,
      width: 100,
      height: 100,
      position: 1,
      created_at: '',
    };

    fixture.componentRef.setInput('attachments', [mockAtt]);
    component.localItems.set([
      { id: 'loc-1', name: 'foto1.jpg', sizeBytes: 2048, url: 'blob:loc-1', isLocalPreview: true },
      { id: 'loc-2', name: 'foto2.png', sizeBytes: 4096, url: 'blob:loc-2', isLocalPreview: true },
    ]);
    fixture.detectChanges();

    const items = component.displayItems();
    expect(items.length).toBe(2);
    expect(items[0].name).toBe('foto1.jpg');
    expect(items[0].isPersisted).toBe(true);
    expect(items[1].name).toBe('foto2.png');
    expect(items[1].isPersisted).toBe(false);
  });
});
