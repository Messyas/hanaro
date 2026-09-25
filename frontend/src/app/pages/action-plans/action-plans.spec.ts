import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LanguageService } from '../../i18n/language.service';
import { GovernanceService } from '../governance.service';
import { ActionEvidenceItem, ActionTask, Plan, WorkflowPage } from '../governance.models';
import { ReportsService } from '../reports/reports.service';
import { ReportVersion } from '../reports/reports.models';
import { ActionPlans } from './action-plans';

describe('ActionPlans pagination', () => {
  let fixture: ComponentFixture<ActionPlans>;
  let component: ActionPlans;
  let governanceService: {
    plans: ReturnType<typeof vi.fn>;
    people: ReturnType<typeof vi.fn>;
    saveTask: ReturnType<typeof vi.fn>;
    board: ReturnType<typeof vi.fn>;
    task: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
    command: ReturnType<typeof vi.fn>;
    uploadEvidence: ReturnType<typeof vi.fn>;
    removeEvidence: ReturnType<typeof vi.fn>;
    downloadEvidence: ReturnType<typeof vi.fn>;
  };
  let reportsService: { eligibleOccurrences: ReturnType<typeof vi.fn> };

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
      saveTask: vi.fn().mockReturnValue(
        of<ActionTask>({
          id: 'task-1',
          plan_id: plan.id,
          title: 'Repair',
          description: '',
          priority: 'MEDIUM',
          due_at: null,
          is_blocked: true,
          blocked_reason: null,
          version: 1,
          status: 'PLANNED',
          position: 0,
          participants: [],
        }),
      ),
      board: vi.fn().mockReturnValue(of({ items: [], total: 0, has_next: false })),
      task: vi.fn(),
      history: vi.fn().mockReturnValue(of({ items: [], total: 0, has_next: false })),
      command: vi.fn(),
      uploadEvidence: vi.fn(),
      removeEvidence: vi.fn(),
      downloadEvidence: vi.fn(),
    };
    reportsService = {
      eligibleOccurrences: vi.fn().mockReturnValue(
        of({
          items: [
            {
              id: 'occ-1',
              organization_code: 'ORG',
              transaction_date: '2026-09-24',
              item_code: 'ITEM-1',
              item_description: 'Scrap part',
            },
          ],
          page: 1,
          page_size: 25,
          total: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [ActionPlans],
      providers: [
        provideRouter([]),
        LanguageService,
        { provide: GovernanceService, useValue: governanceService },
        { provide: ReportsService, useValue: reportsService },
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
    expect(governanceService.plans).toHaveBeenLastCalledWith(1, 50, {
      search: '',
      status: '',
      sort: 'newest',
    });
  });

  it('moves between pages and respects the first and last page limits', () => {
    component.previousPage();
    expect(governanceService.plans).toHaveBeenCalledTimes(1);

    component.nextPage();
    expect(component.page()).toBe(2);
    expect(governanceService.plans).toHaveBeenLastCalledWith(2, 25, {
      search: '',
      status: '',
      sort: 'newest',
    });

    component.page.set(3);
    component.nextPage();
    expect(component.page()).toBe(3);
    expect(governanceService.plans).toHaveBeenCalledTimes(2);

    component.previousPage();
    expect(component.page()).toBe(2);
    expect(governanceService.plans).toHaveBeenLastCalledWith(2, 25, {
      search: '',
      status: '',
      sort: 'newest',
    });
  });

  it('applies server-side plan filters and sort from the first page', () => {
    expect(fixture.nativeElement.querySelector('app-list-filter-popover')).toBeTruthy();
    component.page.set(2);
    component.planSearch = 'Supplier';
    component.planStatus = 'OPEN';
    component.selectPlanSort('oldest');
    component.applyPlanFilters();

    expect(component.page()).toBe(1);
    expect(governanceService.plans).toHaveBeenLastCalledWith(1, 25, {
      search: 'Supplier',
      status: 'OPEN',
      sort: 'oldest',
    });

    component.clearPlanFilters();
    expect(governanceService.plans).toHaveBeenLastCalledWith(1, 25, {
      search: '',
      status: '',
      sort: 'newest',
    });
  });

  it('requires a report and replaces an older version of the same report', () => {
    component.editingPlan.set(true);
    component.planTitle = 'Corrective actions';
    fixture.detectChanges();
    const save = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    component.plan.set({
      ...plan,
      reports: [{ id: 'old', report_id: 'report-1', revision: 1, title: 'Report' }],
    });
    component.linkedVersions = ['old', 'other'];
    component.versions.set([{ id: 'new', report_id: 'report-1' } as ReportVersion]);
    component.toggleVersion('new', true);

    expect(component.linkedVersions).toEqual(['other', 'new']);
    fixture.detectChanges();
    expect(save.disabled).toBe(false);
  });

  it('saves a blocked task without requiring a reason', () => {
    component.plan.set({ ...plan, reports: [] });
    component.newTask();
    component.taskTitle = 'Repair';
    component.taskBlocked = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[name="taskBlocked"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[name="blocked"]')).toBeTruthy();
    component.saveTask();

    expect(governanceService.saveTask).toHaveBeenCalledWith(
      plan.id,
      expect.objectContaining({ is_blocked: true, blocked_reason: null }),
      undefined,
    );
  });

  it('shows a reasonless block without moving the task and prevents validation', () => {
    const task = {
      id: 'task-1',
      plan_id: plan.id,
      title: 'Repair',
      description: '',
      priority: 'MEDIUM',
      due_at: null,
      is_blocked: true,
      blocked_reason: null,
      version: 1,
      status: 'UNDER_VERIFICATION',
      position: 0,
      participants: [],
    } satisfies ActionTask;
    component.plan.set({ ...plan, reports: [] });
    component.columns.set({
      UNDER_VERIFICATION: { items: [task], total: 1, has_next: false },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.blocked-callout')?.textContent).toContain(
      'Bloqueada',
    );
    expect(
      (fixture.nativeElement.querySelector('.validate-btn') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(component.columns()['UNDER_VERIFICATION'].items[0].status).toBe('UNDER_VERIFICATION');
  });

  it('disables task changes while the plan is completed', () => {
    const task = {
      id: 'task-1',
      plan_id: plan.id,
      title: 'Repair',
      description: '',
      priority: 'MEDIUM',
      due_at: null,
      is_blocked: false,
      blocked_reason: null,
      version: 1,
      status: 'UNDER_VERIFICATION',
      position: 0,
      participants: [],
    } satisfies ActionTask;
    component.plan.set({ ...plan, status: 'COMPLETED', reports: [] });
    component.columns.set({
      UNDER_VERIFICATION: { items: [task], total: 1, has_next: false },
    });
    governanceService.task.mockReturnValue(of(task));
    fixture.detectChanges();

    expect(
      (fixture.nativeElement.querySelector('.validate-btn') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.task-card')?.classList.contains('cdk-drag-disabled'),
    ).toBe(true);

    component.openTask(task.id);
    fixture.detectChanges();
    expect(
      (
        fixture.nativeElement.querySelector(
          '.task-detail-drawer button[type="submit"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(fixture.nativeElement.querySelector('.task-activity-actions')).toBeNull();
  });

  it('selects and removes occurrences when saving a task', () => {
    component.plan.set({ ...plan, reports: [] });
    component.newTask();
    component.taskTitle = 'Repair';
    fixture.detectChanges();

    const candidate = component.occurrenceCandidates()!.items[0];
    component.toggleOccurrence(candidate, true);
    component.saveTask();
    expect(governanceService.saveTask).toHaveBeenCalledWith(
      plan.id,
      expect.objectContaining({ occurrence_ids: ['occ-1'] }),
      undefined,
    );

    component.newTask();
    component.taskTitle = 'Repair';
    component.toggleOccurrence(candidate, true);
    component.toggleOccurrence(candidate, false);
    component.saveTask();
    expect(governanceService.saveTask).toHaveBeenLastCalledWith(
      plan.id,
      expect.objectContaining({ occurrence_ids: [] }),
      undefined,
    );
  });

  it('shows linked occurrence labels and submits a comment without moving the task', () => {
    const task = {
      id: 'task-1',
      plan_id: plan.id,
      title: 'Repair',
      description: '',
      priority: 'MEDIUM',
      due_at: null,
      is_blocked: false,
      blocked_reason: null,
      version: 1,
      status: 'UNDER_VERIFICATION',
      position: 0,
      participants: [],
      occurrence_ids: ['occ-1'],
      occurrences: [
        {
          id: 'occ-1',
          organization_code: 'ORG',
          transaction_date: '2026-09-24',
          item_code: 'ITEM-1',
          item_description: 'Scrap part',
        },
      ],
    } satisfies ActionTask;
    component.plan.set({ ...plan, reports: [] });
    governanceService.task.mockReturnValue(of(task));
    governanceService.command.mockReturnValue(of({ ...task, version: 2 }));
    governanceService.history.mockReturnValue(
      of({
        items: [
          {
            id: 'event-1',
            event_type: 'TASK_CHANGED',
            actor_id: 2,
            actor_name: 'Peer',
            created_at: '2026-09-24T12:00:00Z',
            payload: { comment: 'Check supplier' },
          },
        ],
        total: 1,
        has_next: false,
      }),
    );

    component.openTask(task.id);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.task-occurrence-row')?.textContent).toContain(
      'ITEM-1',
    );
    expect(fixture.nativeElement.querySelector('.task-history')?.textContent).toContain(
      'Check supplier',
    );
    expect(fixture.nativeElement.querySelector('.task-history')?.textContent).toContain('Peer');

    component.comment = '  Follow up  ';
    component.addComment();
    expect(governanceService.command).toHaveBeenCalledWith(task, 'comment', {
      comment: 'Follow up',
    });
    expect(component.comment).toBe('');

    component.comment = 'Done';
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '.task-activity-actions .btn-primary',
      ) as HTMLButtonElement
    ).click();
    expect(governanceService.command).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: task.id, version: 2 }),
      'validate',
      { comment: 'Done' },
    );
  });

  it('adds unique tags to the task payload and shows them on the board', () => {
    const boardTask: ActionTask = {
      id: 'task-1',
      plan_id: plan.id,
      title: 'Repair',
      description: '',
      priority: 'MEDIUM',
      tags: ['Urgent'],
      due_at: null,
      is_blocked: false,
      blocked_reason: null,
      version: 1,
      status: 'PLANNED',
      position: 0,
      participants: [],
    };
    component.plan.set({ ...plan, reports: [] });
    component.newTask();
    component.taskTitle = 'Repair';
    component.tagInput = 'Urgent';
    component.addTag();
    component.tagInput = 'urgent';
    component.addTag();
    component.tagInput = 'Supplier';
    component.saveTask();
    expect(component.taskTags).toEqual(['Urgent', 'Supplier']);
    expect(governanceService.saveTask).toHaveBeenCalledWith(
      plan.id,
      expect.objectContaining({ tags: ['Urgent', 'Supplier'] }),
      undefined,
    );

    component.columns.set({
      PLANNED: {
        items: [boardTask],
        total: 1,
        has_next: false,
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.task-card .task-tag')?.textContent).toContain(
      'Urgent',
    );
  });

  it('uploads and removes evidence with the latest task version', () => {
    const evidence: ActionEvidenceItem = {
      id: 'evidence-1',
      filename: 'proof.png',
      content_type: 'image/png',
      size_bytes: 100,
      sha256: 'a'.repeat(64),
      uploaded_by_user_id: 2,
      created_at: '2026-09-24T12:00:00Z',
    };
    const task: ActionTask = {
      id: 'task-1',
      plan_id: plan.id,
      title: 'Repair',
      description: '',
      priority: 'MEDIUM',
      due_at: null,
      is_blocked: false,
      blocked_reason: null,
      version: 3,
      status: 'PLANNED',
      position: 0,
      participants: [],
      evidence: [],
    };
    component.plan.set({ ...plan, reports: [] });
    component.task.set(task);
    component.editingTask.set(true);
    const file = new File(['proof'], 'proof.png', { type: 'image/png' });
    governanceService.uploadEvidence.mockReturnValue(
      of({ ...task, version: 4, evidence: [evidence] }),
    );
    governanceService.removeEvidence.mockReturnValue(of({ ...task, version: 5, evidence: [] }));

    component.uploadEvidence({ target: { files: [file], value: 'proof.png' } } as unknown as Event);
    expect(governanceService.uploadEvidence).toHaveBeenCalledWith(task.id, 3, file);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.task-evidence-row')?.textContent).toContain(
      'proof.png',
    );

    component.removeEvidence(evidence);
    expect(governanceService.removeEvidence).toHaveBeenCalledWith(task.id, evidence.id, 4);
    expect(component.task()?.evidence).toEqual([]);
  });
});
