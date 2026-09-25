import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LanguageService } from '../../i18n/language.service';
import { GovernanceService } from '../governance.service';
import { Plan, WorkflowPage } from '../governance.models';
import { ReportCatalogService } from '../reports/report-catalog.service';
import { ReportPublicationService } from '../reports/report-publication.service';
import { ActionPlans } from './action-plans';

describe('ActionPlans pagination', () => {
  let fixture: ComponentFixture<ActionPlans>;
  let component: ActionPlans;
  let governanceService: {
    plans: ReturnType<typeof vi.fn>;
    people: ReturnType<typeof vi.fn>;
  };

  const plan: Plan = {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Plano demonstrativo',
    description: 'Redução de Scrap',
    status: 'OPEN',
    version: 1,
    // Reproduces the legacy list response that caused Angular to abort the
    // render before filling the shared pagination component.
    reports: undefined as unknown as Plan['reports'],
  };

  beforeEach(async () => {
    localStorage.removeItem('hanaro-action-plans-page-size');
    governanceService = {
      plans: vi.fn((page: number, pageSize: number) =>
        of<WorkflowPage<Plan>>({
          items: [plan],
          total: 60,
          has_next: page * pageSize < 60,
        }),
      ),
      people: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [ActionPlans],
      providers: [
        provideRouter([]),
        LanguageService,
        { provide: GovernanceService, useValue: governanceService },
        {
          provide: ReportCatalogService,
          useValue: { list: vi.fn().mockReturnValue(of({ items: [] })) },
        },
        {
          provide: ReportPublicationService,
          useValue: { versions: vi.fn().mockReturnValue(of({ items: [] })) },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({})) },
        },
      ],
    }).compileComponents();

    TestBed.inject(LanguageService).setLanguage('pt');
    fixture = TestBed.createComponent(ActionPlans);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.removeItem('hanaro-action-plans-page-size'));

  it('renders the shared pagination with its labels, value and navigation icons', () => {
    const pagination = fixture.nativeElement.querySelector('app-list-pagination') as HTMLElement;

    expect(pagination.textContent).toContain('Página 1 de 3');
    expect(pagination.textContent?.toLocaleLowerCase('pt-BR')).toContain('por página');
    expect(pagination.textContent).toContain('25');
    expect(pagination.querySelectorAll('.pagination-nav ui-icon svg')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('0 relatório(s)');
  });

  it('changes the number of displayed items, returns to page one and persists the choice', () => {
    component.page.set(2);
    component.selectPageSize(50);

    expect(component.page()).toBe(1);
    expect(component.pageSize()).toBe(50);
    expect(localStorage.getItem('hanaro-action-plans-page-size')).toBe('50');
    expect(governanceService.plans).toHaveBeenLastCalledWith(1, 50);
  });

  it('moves between pages and respects the first and last page limits', () => {
    component.previousPage();
    expect(governanceService.plans).toHaveBeenCalledTimes(1);

    component.nextPage();
    expect(component.page()).toBe(2);
    expect(governanceService.plans).toHaveBeenLastCalledWith(2, 25);

    component.page.set(3);
    component.nextPage();
    expect(component.page()).toBe(3);
    expect(governanceService.plans).toHaveBeenCalledTimes(2);

    component.previousPage();
    expect(component.page()).toBe(2);
    expect(governanceService.plans).toHaveBeenLastCalledWith(2, 25);
  });
});
