import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../../i18n/language.service';
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
});
