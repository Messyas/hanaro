import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LanguageService } from '../../i18n/language.service';
import { ThemeService } from '../../theme/theme.service';
import { ScrapDefectType } from '../scrap-base/scrap-review.models';
import { ScrapReviewService } from '../scrap-base/scrap-review.service';
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

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        LanguageService,
        ThemeService,
        { provide: ScrapReviewService, useValue: scrapReviewServiceMock },
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
    expect(text).toContain('Sistema');
    expect(text).toContain('Tema da interface');
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
});
