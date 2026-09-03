import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../i18n/language.service';
import { ThemeService } from '../../theme/theme.service';
import { ScrapDefectType } from '../scrap-base/scrap-review.models';
import { ScrapReviewService } from '../scrap-base/scrap-review.service';
import { ScrapTargetService } from './scrap-target.service';
import { ScrapClassificationService } from './scrap-classification.service';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  let component: SettingsPage;
  let fixture: ComponentFixture<SettingsPage>;
  let scrapReviewServiceMock: {
    getDefectTypes: ReturnType<typeof vi.fn>;
    createDefectType: ReturnType<typeof vi.fn>;
    updateDefectType: ReturnType<typeof vi.fn>;
    deleteDefectType: ReturnType<typeof vi.fn>;
  };
  let scrapTargetServiceMock: {
    getTargets: ReturnType<typeof vi.fn>;
    saveYearPlan: ReturnType<typeof vi.fn>;
    deleteYearPlan: ReturnType<typeof vi.fn>;
  };
  let authServiceMock: {
    isAuthenticated: ReturnType<typeof vi.fn>;
  };
  let scrapClassificationServiceMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    reapply: ReturnType<typeof vi.fn>;
  };

  const mockTypes: ScrapDefectType[] = [
    {
      id: 'type-1',
      code: 'OXIDACAO',
      name: 'Oxidação de Trilha',
      description: 'Corrosão nos pinos',
      display_order: 1,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'type-2',
      code: 'TRINCA',
      name: 'Trinca no Conector',
      description: null,
      display_order: 2,
      is_active: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    scrapReviewServiceMock = {
      getDefectTypes: vi.fn().mockReturnValue(of(mockTypes)),
      createDefectType: vi.fn(),
      updateDefectType: vi.fn(),
      deleteDefectType: vi.fn().mockReturnValue(of(undefined)),
    };

    scrapTargetServiceMock = {
      getTargets: vi.fn().mockReturnValue(of([])),
      saveYearPlan: vi.fn().mockReturnValue(of([])),
      deleteYearPlan: vi.fn().mockReturnValue(of(undefined)),
    };

    authServiceMock = {
      isAuthenticated: vi.fn().mockReturnValue(true),
    };
    scrapClassificationServiceMock = {
      list: vi.fn().mockReturnValue(of([])),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      reapply: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        LanguageService,
        ThemeService,
        { provide: ScrapReviewService, useValue: scrapReviewServiceMock },
        { provide: ScrapTargetService, useValue: scrapTargetServiceMock },
        { provide: ScrapClassificationService, useValue: scrapClassificationServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    TestBed.inject(LanguageService).setLanguage('pt');
    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders preferences tab by default and loads defect types', () => {
    expect(component.activeTab()).toBe('preferences');
    expect(scrapReviewServiceMock.getDefectTypes).toHaveBeenCalledWith(true);
    expect(component.defectTypes().length).toBe(2);
    expect(component.activeCount()).toBe(1);
    expect(component.totalCount()).toBe(2);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Preferências');
    expect(text).toContain('Classificações de Material');
    expect(text).toContain('Tipos de Scrap');
    expect(text).toContain('Tema da interface');
  });

  it('switches to classifications tab and renders material classifications', () => {
    component.selectTab('classifications');
    fixture.detectChanges();

    expect(component.activeTab()).toBe('classifications');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Classificações de material');
  });

  it('switches to system tab and renders scrap defect types table', () => {
    component.selectTab('system');
    fixture.detectChanges();

    expect(component.activeTab()).toBe('system');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Tipos de Scrap');
    expect(text).toContain('Oxidação de Trilha');
    expect(text).toContain('OXIDACAO');
    expect(text).toContain('Trinca no Conector');
    expect(text).toContain('TRINCA');
  });

  it('auto-generates code from name if code is not manually customized', () => {
    component.onNewNameInput('Avaria de Transporte - Lote 1');
    expect(component.newCode()).toBe('AVARIA_DE_TRANSPORTE_LOTE_1');

    // Manual input overrides auto-slug
    component.onNewCodeInput('AVARIA_TRANS');
    expect(component.newCode()).toBe('AVARIA_TRANS');
    expect(component.codeManuallyEdited()).toBe(true);

    component.onNewNameInput('Outro Nome');
    expect(component.newCode()).toBe('AVARIA_TRANS');
  });

  it('creates a new defect type collaboratively', () => {
    const created: ScrapDefectType = {
      id: 'type-3',
      code: 'QUEBRA',
      name: 'Quebra no Manuseio',
      description: 'Queda na bancada',
      display_order: 0,
      is_active: true,
      created_at: '2026-09-02T00:00:00Z',
      updated_at: '2026-09-02T00:00:00Z',
    };
    scrapReviewServiceMock.createDefectType.mockReturnValue(of(created));

    component.newName.set('Quebra no Manuseio');
    component.newCode.set('QUEBRA');
    component.newDesc.set('Queda na bancada');

    component.createDefectType();

    expect(scrapReviewServiceMock.createDefectType).toHaveBeenCalledWith({
      name: 'Quebra no Manuseio',
      code: 'QUEBRA',
      description: 'Queda na bancada',
    });
    expect(component.defectTypes().length).toBe(3);
    expect(component.newName()).toBe('');
    expect(component.newCode()).toBe('');
    expect(component.feedbackMessage()?.type).toBe('success');
  });

  it('creates a persisted product alias rule for the scrap catalog', () => {
    const created = {
      id: 'rule-1',
      kind: 'PRODUCT_ALIAS' as const,
      source_value: 'F700-1234',
      source_context: null,
      target_value: 'TV 55 Premium',
      target_secondary: null,
      boolean_value: null,
      match_mode: 'EXACT' as const,
      priority: 0,
      is_active: true,
      created_at: '2026-09-03T00:00:00Z',
      updated_at: '2026-09-03T00:00:00Z',
    };
    scrapClassificationServiceMock.create.mockReturnValue(of(created));
    component.classificationKind.set('PRODUCT_ALIAS');
    component.classificationSource.set('F700-1234');
    component.classificationTarget.set('TV 55 Premium');

    component.saveClassification();

    expect(scrapClassificationServiceMock.create).toHaveBeenCalledWith({
      kind: 'PRODUCT_ALIAS',
      source_value: 'F700-1234',
      source_context: null,
      target_value: 'TV 55 Premium',
      target_secondary: null,
      boolean_value: null,
      match_mode: 'EXACT',
      priority: 0,
      is_active: true,
    });
    expect(component.classificationRules()).toContainEqual(created);
  });

  it('toggles active status of an existing defect type', () => {
    const updated = { ...mockTypes[0], is_active: false };
    scrapReviewServiceMock.updateDefectType.mockReturnValue(of(updated));

    component.toggleActive(mockTypes[0], false);

    expect(scrapReviewServiceMock.updateDefectType).toHaveBeenCalledWith('type-1', {
      is_active: false,
    });
    const found = component.defectTypes().find((t) => t.id === 'type-1');
    expect(found?.is_active).toBe(false);
  });

  it('prompts and confirms deletion of a defect type', () => {
    component.promptDelete(mockTypes[0]);
    expect(component.confirmingDeleteItem()).toBe(mockTypes[0]);

    component.confirmDelete(mockTypes[0]);
    expect(scrapReviewServiceMock.deleteDefectType).toHaveBeenCalledWith('type-1');
    expect(component.confirmingDeleteItem()).toBeNull();
    expect(component.defectTypes().find((t) => t.id === 'type-1')).toBeUndefined();
    expect(component.feedbackMessage()?.type).toBe('success');
  });

  it('switches to targets tab and loads targets for the year', () => {
    scrapTargetServiceMock.getTargets.mockReturnValue(
      of([
        { year: 2026, month: 1, amount: 1000, currency: 'USD', updated_at: '2026-01-01' },
        { year: 2026, month: 2, amount: 2000, currency: 'USD', updated_at: '2026-01-01' },
      ]),
    );

    component.selectTab('targets');
    expect(component.activeTab()).toBe('targets');
    expect(scrapTargetServiceMock.getTargets).toHaveBeenCalledWith(2026);
    expect(component.monthlyTargets()[0].amount).toBe(1000);
    expect(component.monthlyTargets()[1].amount).toBe(2000);
  });

  it('applies prefill curve and linear modes correctly', () => {
    component.prefillMode.set('curve');
    component.prefillJanValue.set(11000);
    component.prefillDecValue.set(0);
    component.applyPrefill();

    expect(component.monthlyTargets()[0].amount).toBe(11000);
    expect(component.monthlyTargets()[11].amount).toBe(0);
    expect(component.currentYearTotal()).toBeGreaterThan(0);

    component.prefillMode.set('linear');
    component.prefillAnnualTotal.set(120000);
    component.applyPrefill();

    expect(component.monthlyTargets()[0].amount).toBe(10000);
    expect(component.monthlyTargets()[6].amount).toBe(10000);
    expect(component.currentYearTotal()).toBe(120000);
  });

  it('saves year plan via scrapTargetService', () => {
    scrapTargetServiceMock.saveYearPlan.mockReturnValue(of([]));
    component.updateMonthAmount(1, 5000);
    component.saveTargetsPlan();

    expect(scrapTargetServiceMock.saveYearPlan).toHaveBeenCalledWith(
      2026,
      expect.arrayContaining([{ month: 1, amount: 5000 }]),
    );
    expect(component.targetFeedback()?.type).toBe('success');
  });
});
