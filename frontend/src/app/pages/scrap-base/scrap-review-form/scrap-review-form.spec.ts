import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../i18n/language.service';
import { ScrapReviewForm } from './scrap-review-form';

describe('ScrapReviewForm', () => {
  let component: ScrapReviewForm;
  let fixture: ComponentFixture<ScrapReviewForm>;

  beforeEach(async () => {
    const authServiceMock = {
      user: () => ({ name: 'Engenheiro de Qualidade', username: 'eng.qualidade' }),
    };

    await TestBed.configureTestingModule({
      imports: [ScrapReviewForm],
      providers: [LanguageService, { provide: AuthService, useValue: authServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrapReviewForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes with session user as responsible', () => {
    expect(component.responsibleName()).toBe('Engenheiro de Qualidade');
    expect(component.canFinalize()).toBe(false);
  });

  it('updates form model and verifies canFinalize', () => {
    component.onDefectTypeChanged('def-1');
    component.reviewModel.update((m) => ({
      ...m,
      title: 'Título de teste',
      description: 'Descrição de teste',
    }));
    fixture.detectChanges();

    expect(component.canFinalize()).toBe(true);
  });
});
