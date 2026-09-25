import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LanguageService } from '../../i18n/language.service';
import { ListFilterDateRange } from '../../shared/list-filters/list-filter-date-range';
import { ListFilterInput } from '../../shared/list-filters/list-filter-input';
import { ListFilterPopover } from '../../shared/list-filters/list-filter-popover';
import { ListFilterSelect } from '../../shared/list-filters/list-filter-select';
import { DelayedProgressSpinner } from '../../shared/list-view/delayed-progress-spinner/delayed-progress-spinner';
import { InlineAlert } from '../../shared/list-view/inline-alert/inline-alert';
import { ListFeedback } from '../../shared/list-view/list-feedback/list-feedback';
import { ListPagination } from '../../shared/list-view/list-pagination/list-pagination';
import { ListTableSkeleton } from '../../shared/list-view/list-table-skeleton/list-table-skeleton';
import { StatusBadge, StatusBadgeTone } from '../../shared/list-view/status-badge/status-badge';
import { ListPanel } from '../../shared/list-view/list-panel/list-panel';
import {
  PAGE_SIZE_OPTIONS,
  PageSize,
  PageSizePreference,
} from '../../shared/list-view/page-size-preference';
import { UiIcon } from '../../ui-icon';
import { ActionPlansService } from './action-plans.service';
import { ActionPlansStore } from './action-plans.store';
import { GovernanceDirectoryService } from '../../core/governance/governance-directory.service';
import { ActionTask, ActionTaskCommand, TaskState } from './action-plans.models';
import { workflowCopy } from '../../pages/governance-copy';
import { ActionPlanReportLookup } from '../reports/reports.public-api';

const ALLOWED_PAGE_SIZES = PAGE_SIZE_OPTIONS;
const DEFAULT_PAGE_SIZE: PageSize = 25;
const PAGE_SIZE_STORAGE_KEY = 'hanaro-action-plans-page-size';

@Component({
  selector: 'app-action-plans',
  imports: [
    FormsModule,
    DragDropModule,
    RouterLink,
    UiIcon,
    ListPanel,
    ListPagination,
    ListTableSkeleton,
    StatusBadge,
    ListFeedback,
    InlineAlert,
    DelayedProgressSpinner,
    ListFilterDateRange,
    ListFilterInput,
    ListFilterPopover,
    ListFilterSelect,
  ],
  templateUrl: './action-plans.html',
  styleUrls: ['./action-plans.css'],
  providers: [ActionPlansStore],
})
export class ActionPlans {
  private readonly store = inject(ActionPlansStore);
  private readonly planApi = inject(ActionPlansService);
  private readonly directoryApi = inject(GovernanceDirectoryService);
  private readonly reportLookup = inject(ActionPlanReportLookup);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pageSizePreference = inject(PageSizePreference);
  readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());
  readonly c = computed(() => workflowCopy[this.language.currentLanguage()]);
  readonly states: TaskState[] = ['PLANNED', 'IN_PROGRESS', 'UNDER_VERIFICATION', 'COMPLETED'];
  readonly list = this.store.list;
  readonly plan = this.store.plan;
  readonly columns = this.store.columns;
  readonly error = this.store.error;
  readonly loading = this.store.loading;
  readonly busy = this.store.busy;
  readonly editingPlan = this.store.editingPlan;
  readonly editingTask = this.store.editingTask;
  readonly task = this.store.task;
  readonly history = this.store.history;
  readonly people = this.store.people;
  readonly reports = this.store.reports;
  readonly boardFilterOpen = this.store.boardFilterOpen;
  readonly priorityOptions = computed(() => [
    { value: '', label: this.c().all },
    { value: 'LOW', label: this.c().low },
    { value: 'MEDIUM', label: this.c().medium },
    { value: 'HIGH', label: this.c().high },
    { value: 'URGENT', label: this.c().urgent },
  ]);
  readonly taskPriorityOptions = computed(() =>
    this.priorityOptions().filter((option) => option.value),
  );
  readonly versions = this.store.versions;
  readonly allowedPageSizes = ALLOWED_PAGE_SIZES;
  readonly page = signal(1);
  readonly pageSize = signal<number>(
    this.pageSizePreference.read(PAGE_SIZE_STORAGE_KEY, DEFAULT_PAGE_SIZE),
  );
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil((this.list()?.total || 0) / this.pageSize())),
  );
  readonly tableColumns = computed(() => [
    'Plano de Ação',
    'Status',
    'Relatórios vinculados',
    'Ações',
  ]);

  historyPage = 1;
  columnPages: Record<string, number> = {};
  search = '';
  priority = '';
  peopleSearch = '';
  reportSearch = '';
  reportPage = 1;
  planTitle = '';
  planDescription = '';
  linkedVersions: string[] = [];
  taskTitle = '';
  taskDescription = '';
  taskPriority = 'MEDIUM';
  due = '';
  blocked = '';
  selectedPeople: number[] = [];
  comment = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      const id = params.get('planId');
      if (id) this.open(id);
      else this.load();
    });
    this.loadPeople();
  }

  fail(error: { status?: number; error?: { detail?: string } }) {
    this.error.set(
      error.status === 409 ? this.c().conflict : error.error?.detail || this.c().error,
    );
    this.busy.set(false);
    this.loading.set(false);
  }

  load() {
    this.loading.set(true);
    this.planApi
      .plans(this.page(), this.pageSize())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (page) => {
          // Older/list-only API responses omitted `reports`, which caused the
          // template to throw and left child components only partially drawn.
          this.list.set({
            ...page,
            items: page.items.map((item) => ({ ...item, reports: item.reports ?? [] })),
          });
          this.loading.set(false);
        },
        error: (e) => this.fail(e),
      });
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((page) => page + 1);
      this.load();
    }
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update((page) => page - 1);
      this.load();
    }
  }

  selectPageSize(pageSize: number): void {
    const validPageSize = ALLOWED_PAGE_SIZES.includes(
      pageSize as (typeof ALLOWED_PAGE_SIZES)[number],
    )
      ? pageSize
      : DEFAULT_PAGE_SIZE;
    this.pageSize.set(validPageSize);
    this.pageSizePreference.save(PAGE_SIZE_STORAGE_KEY, validPageSize as PageSize);
    this.page.set(1);
    this.load();
  }

  getPriorityTone(priority: string): StatusBadgeTone {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
        return 'danger';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  getPlanStatusTone(status: string): StatusBadgeTone {
    return status === 'COMPLETED' ? 'success' : 'info';
  }

  open(id: string) {
    this.loading.set(true);
    this.planApi
      .plan(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (plan) => {
          this.plan.set(plan);
          this.loading.set(false);
          this.loadBoard();
          const task = this.route.snapshot.queryParamMap.get('task');
          if (task) this.openTask(task);
        },
        error: (e) => this.fail(e),
      });
  }

  loadBoard() {
    const plan = this.plan();
    if (!plan) return;
    forkJoin(
      this.states.map((status) =>
        this.planApi.getBoard({
          planId: plan.id,
          status,
          page: this.columnPages[status] || 1,
          search: this.search,
          priority: this.priority,
        }),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (pages) =>
          this.columns.set(Object.fromEntries(this.states.map((s, i) => [s, pages[i]]))),
        error: (e) => this.fail(e),
      });
  }

  clearBoardFilters(): void {
    this.search = '';
    this.priority = '';
    this.boardFilterOpen.set(false);
    this.loadBoard();
  }

  boardActiveFiltersCount(): number {
    return [this.search.trim(), this.priority].filter(Boolean).length;
  }

  columnPage(status: TaskState, delta: number) {
    this.columnPages[status] = (this.columnPages[status] || 1) + delta;
    this.loadBoard();
  }

  stateLabel(state: TaskState) {
    return {
      PLANNED: this.c().planned,
      IN_PROGRESS: this.c().progress,
      UNDER_VERIFICATION: this.c().verification,
      COMPLETED: this.c().completed,
    }[state];
  }

  editPlan(isNew = false) {
    const p = isNew ? null : this.plan();
    this.planTitle = p?.title || '';
    this.planDescription = p?.description || '';
    this.linkedVersions = p?.reports.map((v) => v.id) || [];
    if (isNew) this.plan.set(null);
    this.editingPlan.set(true);
    this.loadReports();
  }

  loadReports() {
    this.reportLookup
      .searchPublishedReports(this.reportSearch)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (reports) => this.reports.set(reports), error: (e) => this.fail(e) });
  }

  loadVersions(reportId: string) {
    this.reportLookup
      .listPublishedVersions(reportId)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (versions) => this.versions.set(versions), error: (e) => this.fail(e) });
  }

  toggleVersion(id: string, checked: boolean) {
    this.linkedVersions = checked
      ? [...new Set([...this.linkedVersions, id])]
      : this.linkedVersions.filter((v) => v !== id);
  }

  savePlan(status?: 'OPEN' | 'COMPLETED') {
    if (this.busy() || !this.planTitle.trim()) return;
    this.busy.set(true);
    const current = this.plan();
    this.planApi
      .savePlan(
        {
          title: this.planTitle,
          description: this.planDescription,
          report_version_ids: this.linkedVersions,
          expected_version: current?.version,
          status: status || current?.status || 'OPEN',
        },
        current?.id,
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (p) => {
          this.plan.set(p);
          this.busy.set(false);
          this.editingPlan.set(false);
          this.router.navigate(['/planos-de-acao', p.id]);
          this.loadBoard();
        },
        error: (e) => this.fail(e),
      });
  }

  finishPlan() {
    this.editPlan();
    this.savePlan(this.plan()?.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED');
  }

  loadPeople() {
    this.directoryApi
      .people(this.peopleSearch)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (p) => this.people.set(p), error: (e) => this.fail(e) });
  }

  togglePerson(id: number, checked: boolean) {
    this.selectedPeople = checked
      ? [...new Set([...this.selectedPeople, id])]
      : this.selectedPeople.filter((v) => v !== id);
  }

  newTask() {
    this.task.set(null);
    this.taskTitle = '';
    this.taskDescription = '';
    this.taskPriority = 'MEDIUM';
    this.due = '';
    this.blocked = '';
    this.selectedPeople = [];
    this.history.set(null);
    this.editingTask.set(true);
  }

  openTask(id: string) {
    this.planApi
      .task(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (t) => {
          this.task.set(t);
          this.taskTitle = t.title;
          this.taskDescription = t.description;
          this.taskPriority = t.priority;
          this.due = t.due_at?.slice(0, 10) || '';
          this.blocked = t.blocked_reason || '';
          this.selectedPeople = t.participants.map((p) => p.id);
          this.editingTask.set(true);
          this.historyPage = 1;
          this.loadHistory();
        },
        error: (e) => this.fail(e),
      });
  }

  loadHistory() {
    const task = this.task();
    if (!task) return;
    this.planApi
      .history(task.id, this.historyPage)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (p) => this.history.set(p), error: (e) => this.fail(e) });
  }

  saveTask() {
    const plan = this.plan();
    if (!plan || this.busy() || !this.taskTitle.trim()) return;
    this.busy.set(true);
    this.planApi
      .saveTask(
        plan.id,
        {
          title: this.taskTitle,
          description: this.taskDescription,
          priority: this.taskPriority,
          due_at: this.due ? `${this.due}T23:59:59Z` : null,
          blocked_reason: this.blocked.trim() || null,
          participant_ids: this.selectedPeople,
          occurrence_ids: this.task()?.occurrence_ids || [],
          expected_version: this.task()?.version,
        },
        this.task()?.id,
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (t) => {
          this.task.set(t);
          this.busy.set(false);
          this.editingTask.set(false);
          this.loadBoard();
        },
        error: (e) => this.fail(e),
      });
  }

  sendTaskCommand(task: ActionTask, action: ActionTaskCommand) {
    if (this.busy()) return;
    this.busy.set(true);
    this.planApi
      .sendCommand(task, action)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (updated) => {
          if (this.task()?.id === updated.id) this.task.set(updated);
          this.comment = '';
          this.busy.set(false);
          this.loadBoard();
          this.loadHistory();
        },
        error: (e) => {
          this.fail(e);
          this.loadBoard();
        },
      });
  }

  drop(event: CdkDragDrop<ActionTask[]>, status: TaskState) {
    if (status === 'COMPLETED') return;
    const task = event.item.data as ActionTask;
    if (task.status === 'COMPLETED') return;

    this.moveTaskInBoard(task, status, event.currentIndex);
    this.sendTaskCommand(task, {
      command: 'move',
      status,
      position: event.currentIndex * 1024,
    });
  }

  private moveTaskInBoard(task: ActionTask, targetStatus: TaskState, targetIndex: number): void {
    const sourceStatus = task.status;

    this.columns.update((columns) => {
      const source = columns[sourceStatus];
      const target = columns[targetStatus];
      if (!source || !target) return columns;

      const withoutTask = source.items.filter((item) => item.id !== task.id);
      const movedTask = { ...task, status: targetStatus };

      if (sourceStatus === targetStatus) {
        const insertionIndex = Math.min(Math.max(targetIndex, 0), withoutTask.length);
        const reordered = [...withoutTask];
        reordered.splice(insertionIndex, 0, movedTask);
        return { ...columns, [sourceStatus]: { ...source, items: reordered } };
      }

      const targetItems = target.items.filter((item) => item.id !== task.id);
      const insertionIndex = Math.min(Math.max(targetIndex, 0), targetItems.length);
      targetItems.splice(insertionIndex, 0, movedTask);

      return {
        ...columns,
        [sourceStatus]: {
          ...source,
          items: withoutTask,
          total: Math.max(0, source.total - 1),
        },
        [targetStatus]: {
          ...target,
          items: targetItems,
          total: target.total + 1,
        },
      };
    });
  }

  overdue(task: ActionTask) {
    return task.status !== 'COMPLETED' && !!task.due_at && Date.parse(task.due_at) < Date.now();
  }

  back() {
    this.plan.set(null);
    this.router.navigate(['/planos-de-acao']);
    this.load();
  }
}
