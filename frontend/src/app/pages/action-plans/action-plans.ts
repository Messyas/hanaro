import { DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
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
import { UiIcon } from '../../ui-icon';
import { GovernanceService } from '../governance.service';
import {
  ActionEvidenceItem,
  ActionTask,
  HistoryEntry,
  Person,
  Plan,
  TaskOccurrence,
  TaskState,
  WorkflowPage,
} from '../governance.models';
import { workflowCopy } from '../governance-copy';
import { BrowserDownloadAdapter } from '../reports/browser-download.adapter';
import { ReportsService } from '../reports/reports.service';
import { EligibleOccurrence, Page, ReportListItem, ReportVersion } from '../reports/reports.models';

const ALLOWED_PAGE_SIZES = [10, 25, 50, 100] as const;
const PAGE_SIZE_STORAGE_KEY = 'hanaro-action-plans-page-size';
const DEFAULT_PAGE_SIZE = 25;

@Component({
  selector: 'app-action-plans',
  imports: [
    FormsModule,
    DatePipe,
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
})
export class ActionPlans {
  private readonly api = inject(GovernanceService);
  private readonly reportsApi = inject(ReportsService);
  private readonly browserDownload = inject(BrowserDownloadAdapter);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());
  readonly c = computed(() => workflowCopy[this.language.currentLanguage()]);
  readonly states: TaskState[] = ['PLANNED', 'IN_PROGRESS', 'UNDER_VERIFICATION', 'COMPLETED'];
  readonly list = signal<WorkflowPage<Plan> | null>(null);
  readonly plan = signal<Plan | null>(null);
  readonly columns = signal<Record<string, WorkflowPage<ActionTask>>>({});
  readonly error = signal('');
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly editingPlan = signal(false);
  readonly editingTask = signal(false);
  readonly task = signal<ActionTask | null>(null);
  readonly history = signal<WorkflowPage<HistoryEntry> | null>(null);
  readonly people = signal<Person[]>([]);
  readonly reports = signal<ReportListItem[]>([]);
  readonly boardFilterOpen = signal(false);
  readonly planFilterOpen = signal(false);
  readonly planStatusOptions = computed(() => [
    { value: '', label: this.c().all },
    { value: 'OPEN', label: this.c().openPlans },
    { value: 'COMPLETED', label: this.c().completedPlans },
  ]);
  readonly planSortOptions = computed(() => [
    { value: 'newest', label: this.c().newest },
    { value: 'oldest', label: this.c().oldest },
    { value: 'title', label: this.c().titleSort },
  ]);
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
  readonly versions = signal<ReportVersion[]>([]);
  readonly occurrenceCandidates = signal<Page<EligibleOccurrence> | null>(null);
  readonly allowedPageSizes = ALLOWED_PAGE_SIZES;
  readonly page = signal(1);
  readonly pageSize = signal(this.readInitialPageSize());
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
  planSearch = '';
  planStatus = '';
  planSort: 'newest' | 'oldest' | 'title' = 'newest';
  peopleSearch = '';
  reportSearch = '';
  reportPage = 1;
  planTitle = '';
  planDescription = '';
  linkedVersions: string[] = [];
  taskTitle = '';
  taskDescription = '';
  taskPriority = 'MEDIUM';
  taskTags: string[] = [];
  tagInput = '';
  due = '';
  taskBlocked = false;
  blocked = '';
  selectedPeople: number[] = [];
  selectedOccurrences: TaskOccurrence[] = [];
  occurrenceSearch = '';
  occurrencePage = 1;
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
    this.api
      .plans(this.page(), this.pageSize(), {
        search: this.planSearch,
        status: this.planStatus as 'OPEN' | 'COMPLETED' | undefined,
        sort: this.planSort,
      })
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
    this.savePageSize(validPageSize);
    this.page.set(1);
    this.load();
  }

  applyPlanFilters(): void {
    this.page.set(1);
    this.load();
  }

  selectPlanSort(value: string): void {
    if (value === 'newest' || value === 'oldest' || value === 'title') {
      this.planSort = value;
    }
  }

  clearPlanFilters(): void {
    this.planSearch = '';
    this.planStatus = '';
    this.planSort = 'newest';
    this.planFilterOpen.set(false);
    this.applyPlanFilters();
  }

  planActiveFiltersCount(): number {
    return [this.planSearch.trim(), this.planStatus].filter(Boolean).length;
  }

  private readInitialPageSize(): number {
    if (!this.isBrowser) return DEFAULT_PAGE_SIZE;
    try {
      const stored = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
      if (ALLOWED_PAGE_SIZES.includes(stored as (typeof ALLOWED_PAGE_SIZES)[number])) {
        return stored;
      }
    } catch {
      // Storage pode estar indisponível em modo privado ou sandbox.
    }
    return DEFAULT_PAGE_SIZE;
  }

  private savePageSize(pageSize: number): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
    } catch {
      // A paginação continua funcional mesmo sem persistência local.
    }
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
    this.api
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
        this.api.board(plan.id, status, this.columnPages[status] || 1, this.search, this.priority),
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
    this.reportsApi
      .list({ page: this.reportPage, pageSize: 25, search: this.reportSearch, status: 'PUBLISHED' })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (p) => this.reports.set(p.items), error: (e) => this.fail(e) });
  }

  loadVersions(reportId: string) {
    this.reportsApi
      .versions(reportId)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (p) => this.versions.set(p.items.filter((version) => !!version.published_at)),
        error: (e) => this.fail(e),
      });
  }

  toggleVersion(id: string, checked: boolean) {
    if (!checked) {
      this.linkedVersions = this.linkedVersions.filter((versionId) => versionId !== id);
      return;
    }
    const selected = this.versions().find((version) => version.id === id);
    if (!selected) return;
    const sameReportIds = new Set([
      ...this.versions()
        .filter((version) => version.report_id === selected.report_id)
        .map((version) => version.id),
      ...(this.plan()?.reports ?? [])
        .filter((report) => report.report_id === selected.report_id)
        .map((report) => report.id),
    ]);
    this.linkedVersions = [
      ...this.linkedVersions.filter((versionId) => !sameReportIds.has(versionId)),
      id,
    ];
  }

  savePlan(status?: 'OPEN' | 'COMPLETED') {
    if (this.busy() || !this.planTitle.trim() || !this.linkedVersions.length) return;
    this.busy.set(true);
    const current = this.plan();
    this.api
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
    this.api
      .people(this.peopleSearch)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (p) => this.people.set(p), error: (e) => this.fail(e) });
  }

  togglePerson(id: number, checked: boolean) {
    this.selectedPeople = checked
      ? [...new Set([...this.selectedPeople, id])]
      : this.selectedPeople.filter((v) => v !== id);
  }

  loadOccurrences() {
    this.reportsApi
      .eligibleOccurrences({
        page: this.occurrencePage,
        pageSize: 25,
        search: this.occurrenceSearch,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (page) => this.occurrenceCandidates.set(page),
        error: (e) => this.fail(e),
      });
  }

  searchOccurrences() {
    this.occurrencePage = 1;
    this.loadOccurrences();
  }

  occurrencePageBy(delta: number) {
    const next = this.occurrencePage + delta;
    if (next < 1 || (delta > 0 && !this.occurrenceCandidates()?.has_next)) return;
    this.occurrencePage = next;
    this.loadOccurrences();
  }

  toggleOccurrence(occurrence: TaskOccurrence, checked: boolean) {
    this.selectedOccurrences = checked
      ? [...this.selectedOccurrences.filter((item) => item.id !== occurrence.id), occurrence]
      : this.selectedOccurrences.filter((item) => item.id !== occurrence.id);
  }

  occurrenceSelected(id: string) {
    return this.selectedOccurrences.some((occurrence) => occurrence.id === id);
  }

  occurrenceLabel(occurrence: TaskOccurrence) {
    return occurrence.item_code || occurrence.item_description || occurrence.id;
  }

  activityLabel(entry: HistoryEntry) {
    if (entry.event_type === 'TASK_EVIDENCE_ADDED') return this.c().evidenceAdded;
    if (entry.event_type === 'TASK_EVIDENCE_REMOVED') return this.c().evidenceRemoved;
    if (entry.payload.comment?.trim()) return this.c().comment;
    if (entry.event_type === 'TASK_VALIDATED') return this.c().completed;
    if (entry.event_type === 'TASK_VERIFICATION') return this.c().verification;
    return this.c().taskUpdated;
  }

  addTag() {
    const tag = this.tagInput.trim();
    if (!tag || tag.length > 40 || this.taskTags.length >= 20) return;
    if (!this.taskTags.some((value) => value.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
      this.taskTags = [...this.taskTags, tag];
    }
    this.tagInput = '';
  }

  removeTag(tag: string) {
    this.taskTags = this.taskTags.filter((value) => value !== tag);
  }

  newTask() {
    this.task.set(null);
    this.taskTitle = '';
    this.taskDescription = '';
    this.taskPriority = 'MEDIUM';
    this.taskTags = [];
    this.tagInput = '';
    this.due = '';
    this.taskBlocked = false;
    this.blocked = '';
    this.selectedPeople = [];
    this.selectedOccurrences = [];
    this.occurrenceSearch = '';
    this.occurrencePage = 1;
    this.occurrenceCandidates.set(null);
    this.comment = '';
    this.history.set(null);
    this.editingTask.set(true);
    this.loadOccurrences();
  }

  openTask(id: string) {
    this.api
      .task(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (t) => {
          this.task.set(t);
          this.taskTitle = t.title;
          this.taskDescription = t.description;
          this.taskPriority = t.priority;
          this.taskTags = t.tags ?? [];
          this.tagInput = '';
          this.due = t.due_at?.slice(0, 10) || '';
          this.taskBlocked = t.is_blocked;
          this.blocked = t.blocked_reason || '';
          this.selectedPeople = t.participants.map((p) => p.id);
          this.selectedOccurrences =
            t.occurrences ??
            (t.occurrence_ids ?? []).map((occurrenceId) => ({
              id: occurrenceId,
              organization_code: '',
              transaction_date: '',
              item_code: null,
              item_description: null,
            }));
          this.occurrenceSearch = '';
          this.occurrencePage = 1;
          this.occurrenceCandidates.set(null);
          this.comment = '';
          this.editingTask.set(true);
          this.historyPage = 1;
          this.loadHistory();
          this.loadOccurrences();
        },
        error: (e) => this.fail(e),
      });
  }

  loadHistory() {
    const task = this.task();
    if (!task) return;
    this.api
      .history(task.id, this.historyPage)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (p) => this.history.set(p), error: (e) => this.fail(e) });
  }

  historyPageBy(delta: number) {
    const next = this.historyPage + delta;
    if (next < 1 || (delta > 0 && !this.history()?.has_next)) return;
    this.historyPage = next;
    this.loadHistory();
  }

  saveTask() {
    const plan = this.plan();
    if (!plan || this.busy() || !this.taskTitle.trim()) return;
    this.addTag();
    this.busy.set(true);
    this.api
      .saveTask(
        plan.id,
        {
          title: this.taskTitle,
          description: this.taskDescription,
          priority: this.taskPriority,
          tags: this.taskTags,
          due_at: this.due ? `${this.due}T23:59:59Z` : null,
          is_blocked: this.taskBlocked,
          blocked_reason: this.taskBlocked ? this.blocked.trim() || null : null,
          participant_ids: this.selectedPeople,
          occurrence_ids: this.selectedOccurrences.map((occurrence) => occurrence.id),
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

  command(task: ActionTask, command: string, extra: object = {}) {
    if (this.busy()) return;
    this.busy.set(true);
    this.api
      .command(task, command, extra)
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

  addComment() {
    const task = this.task();
    const comment = this.comment.trim();
    if (task && comment) this.command(task, 'comment', { comment });
  }

  uploadEvidence(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const task = this.task();
    if (!file || !task || this.busy()) return;
    this.busy.set(true);
    this.api
      .uploadEvidence(task.id, task.version, file)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (updated) => {
          this.task.set(updated);
          this.busy.set(false);
          this.loadHistory();
        },
        error: (error) => this.fail(error),
      });
  }

  removeEvidence(evidence: ActionEvidenceItem) {
    const task = this.task();
    if (!task || this.busy()) return;
    this.busy.set(true);
    this.api
      .removeEvidence(task.id, evidence.id, task.version)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (updated) => {
          this.task.set(updated);
          this.busy.set(false);
          this.loadHistory();
        },
        error: (error) => this.fail(error),
      });
  }

  downloadEvidence(evidence: ActionEvidenceItem) {
    const task = this.task();
    if (!task) return;
    this.api
      .downloadEvidence(task.id, evidence.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (blob) => this.browserDownload.download(blob, evidence.filename),
        error: (error) => this.fail(error),
      });
  }

  drop(event: CdkDragDrop<ActionTask[]>, status: TaskState) {
    const task = event.item.data as ActionTask;
    if (status === 'COMPLETED' || task.status === 'COMPLETED') return;

    this.moveTaskInBoard(task, status, event.currentIndex);
    this.command(task, 'move', { status, position: event.currentIndex * 1024 });
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
