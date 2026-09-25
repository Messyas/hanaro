import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Subscription, debounceTime, distinctUntilChanged, timer } from 'rxjs';
import { LanguageService } from '../../i18n/language.service';
import { ListFilterDateRange } from '../../shared/list-filters/list-filter-date-range';
import { ListFilterInput } from '../../shared/list-filters/list-filter-input';
import { ListFilterPopover } from '../../shared/list-filters/list-filter-popover';
import {
  ListFilterSelect,
  ListFilterSelectOption,
} from '../../shared/list-filters/list-filter-select';
import { InlineAlert } from '../../shared/list-view/inline-alert/inline-alert';
import { DelayedProgressSpinner } from '../../shared/list-view/delayed-progress-spinner/delayed-progress-spinner';
import { ListFeedback } from '../../shared/list-view/list-feedback/list-feedback';
import { ListPagination } from '../../shared/list-view/list-pagination/list-pagination';
import { ListPanel } from '../../shared/list-view/list-panel/list-panel';
import { ListTableSkeleton } from '../../shared/list-view/list-table-skeleton/list-table-skeleton';
import { StatusBadge } from '../../shared/list-view/status-badge/status-badge';
import type { StatusBadgeTone } from '../../shared/list-view/status-badge/status-badge';
import { UiIcon } from '../../ui-icon';
import {
  AutomationExecutionStatus,
  AutomationSnapshotStatus,
  ExecutionDetail,
  ExecutionPage,
  ExecutionSortField,
  ExecutionStepCode,
  ExecutionStepStatus,
  ExecutionsFilterParams,
  SortOrder,
} from './executions.models';
import { ExecutionsService } from './executions.service';
import { ExecutionManualUploadDialog } from './execution-manual-upload-dialog';

const ALLOWED_PAGE_SIZES = [10, 25, 50, 100] as const;
const PAGE_SIZE_STORAGE_KEY = 'hanaro-executions-page-size';
const DEFAULT_PAGE_SIZE = 25;
const EXECUTION_POLL_INTERVAL_MS = 5_000;

@Component({
  selector: 'app-executions-page',
  imports: [
    DecimalPipe,
    InlineAlert,
    DelayedProgressSpinner,
    ExecutionManualUploadDialog,
    ListFeedback,
    ListFilterDateRange,
    ListFilterInput,
    ListFilterPopover,
    ListFilterSelect,
    ListPagination,
    ListPanel,
    ListTableSkeleton,
    StatusBadge,
    UiIcon,
  ],
  templateUrl: './executions-page.html',
  styleUrl: './executions-page.css',
  host: {
    '(document:keydown.escape)': 'handleEscapeKey()',
  },
})
export class ExecutionsPage implements OnInit {
  private readonly executionsService = inject(ExecutionsService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly searchSubject = new Subject<string>();
  private listRequest: Subscription | null = null;

  readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());

  readonly allowedPageSizes = ALLOWED_PAGE_SIZES;

  // Filtros e paginação
  readonly dateFrom = signal<string>('');
  readonly dateTo = signal<string>('');
  readonly statusFilter = signal<AutomationExecutionStatus | ''>('');
  readonly searchQuery = signal<string>('');
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(this.readInitialPageSize());
  readonly sortBy = signal<ExecutionSortField>('started_at');
  readonly sortOrder = signal<SortOrder>('desc');

  // Popovers e Dropdowns customizados
  readonly filterOpen = signal<boolean>(false);

  // Verificação de consistência temporal das datas
  readonly dateRangeError = computed<boolean>(() => {
    const from = this.dateFrom().trim();
    const to = this.dateTo().trim();
    if (from && to && to < from) {
      return true;
    }
    return false;
  });

  readonly statusOptions: Array<{ value: AutomationExecutionStatus | '' }> = [
    { value: '' },
    { value: 'COMPLETED' },
    { value: 'FAILED' },
    { value: 'RUNNING' },
    { value: 'QUEUED' },
    { value: 'CANCELLED' },
  ];
  readonly sharedStatusOptions = computed<readonly ListFilterSelectOption[]>(() =>
    this.statusOptions.map(({ value }) => ({ value, label: this.getStatusOptionLabel(value) })),
  );

  readonly activeFiltersCount = computed(() => {
    let count = 0;
    if (this.searchQuery().trim()) count++;
    if (this.statusFilter()) count++;
    if (this.dateFrom() || this.dateTo()) count++;
    return count;
  });

  // Estado da listagem
  readonly data = signal<ExecutionPage | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly tableColumns = computed(() => [
    this.t().executionsColProcess,
    this.t().executionsColOrigin,
    this.t().executionsColTrigger,
    this.t().executionsColStart,
    this.t().executionsColEnd,
    this.t().executionsColDuration,
    this.t().executionsColReceived,
    this.t().executionsColValid,
    this.t().executionsColRejected,
    this.t().executionsColSnapshot,
    this.t().executionsColStatus,
  ]);

  // Estado do detalhe
  readonly selectedExecutionId = signal<string | null>(null);
  readonly selectedDetail = signal<ExecutionDetail | null>(null);
  readonly loadingDetail = signal<boolean>(false);
  readonly detailError = signal<string | null>(null);
  readonly retrying = signal<boolean>(false);
  readonly manualUploadOpen = signal(false);

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.page.set(1);
        this.loadExecutions();
      });

    this.loadExecutions();

    timer(EXECUTION_POLL_INTERVAL_MS, EXECUTION_POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.hasActiveExecution()) return;
        this.loadExecutions();
        const selectedId = this.selectedExecutionId();
        if (selectedId) this.loadDetail(selectedId, false);
      });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.filterOpen() && target && !target.closest('.filter-popover-anchor')) {
      this.closeFilterPopover();
    }
  }

  handleEscapeKey(): void {
    if (this.filterOpen()) {
      this.closeFilterPopover();
    } else if (this.selectedExecutionId()) {
      this.closeDetail();
    }
  }

  toggleFilterPopover(event?: Event): void {
    if (event) event.stopPropagation();
    this.filterOpen.update((v) => !v);
  }

  closeFilterPopover(): void {
    this.filterOpen.set(false);
  }

  selectStatus(value: AutomationExecutionStatus | ''): void {
    this.statusFilter.set(value);
    this.page.set(1);
    this.loadExecutions();
  }

  onStatusChanged(value: string): void {
    this.selectStatus(value as AutomationExecutionStatus | '');
  }

  getStatusOptionLabel(value: AutomationExecutionStatus | ''): string {
    if (!value) return this.t().executionsAllStatus;
    return this.formatStatus(value);
  }

  selectPageSize(size: number): void {
    this.pageSize.set(size);
    this.savePageSize(size);
    this.page.set(1);
    this.loadExecutions();
  }

  dateRangeLocale(): string {
    const language = this.language.currentLanguage();
    return language === 'pt' ? 'pt-BR' : language === 'ko' ? 'ko-KR' : 'en-US';
  }

  private isValidIsoDateString(str: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const [y, m, d] = str.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const testDate = new Date(y, m - 1, d);
    return (
      testDate.getFullYear() === y && testDate.getMonth() === m - 1 && testDate.getDate() === d
    );
  }
  loadExecutions(): void {
    if (this.dateRangeError()) {
      return; // Não envia consulta ao backend com intervalo de datas inválido
    }

    this.loading.set(true);
    this.error.set(null);

    const params: ExecutionsFilterParams = {
      page: this.page(),
      page_size: this.pageSize(),
      sort_by: this.sortBy(),
      sort_order: this.sortOrder(),
    };

    if (this.dateFrom() && this.isValidIsoDateString(this.dateFrom())) {
      params.date_from = this.dateFrom();
    }
    if (this.dateTo() && this.isValidIsoDateString(this.dateTo())) {
      params.date_to = this.dateTo();
    }
    if (this.statusFilter()) params.status = this.statusFilter() as AutomationExecutionStatus;
    if (this.searchQuery().trim()) params.search = this.searchQuery().trim();

    this.listRequest?.unsubscribe();
    this.listRequest = this.executionsService
      .list(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.data.set(result);
          this.loading.set(false);
        },
        error: (err: { error?: { detail?: string }; message?: string }) => {
          const message = err.error?.detail || err.message || 'Erro ao carregar dados do servidor.';
          this.error.set(message);
          this.loading.set(false);
        },
      });
  }

  refresh(): void {
    this.loadExecutions();
  }

  openManualUpload(): void {
    this.manualUploadOpen.set(true);
  }

  handleManualUploadClosed(): void {
    this.manualUploadOpen.set(false);
  }

  handleManualUploadAccepted(executionId: string): void {
    this.manualUploadOpen.set(false);
    this.page.set(1);
    this.loadExecutions();
    this.openDetail(executionId);
  }
  clearFilters(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.statusFilter.set('');
    this.searchQuery.set('');
    this.page.set(1);
    this.loadExecutions();
  }

  clearSearch(event?: Event): void {
    if (event) event.stopPropagation();
    this.searchQuery.set('');
    this.page.set(1);
    this.loadExecutions();
  }

  clearStatus(event?: Event): void {
    if (event) event.stopPropagation();
    this.statusFilter.set('');
    this.page.set(1);
    this.loadExecutions();
  }

  clearDates(event?: Event): void {
    if (event) event.stopPropagation();
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(1);
    this.loadExecutions();
  }

  onDateFromChange(event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value;
    const normalized = rawValue.replace(/\//g, '-').trim();
    this.dateFrom.set(normalized);
    // Dispara a busca apenas se o campo estiver vazio ou for uma data ISO completa e válida
    if (!normalized || this.isValidIsoDateString(normalized)) {
      if (!this.dateRangeError()) {
        this.page.set(1);
        this.loadExecutions();
      }
    }
  }

  onDateToChange(event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value;
    const normalized = rawValue.replace(/\//g, '-').trim();
    this.dateTo.set(normalized);
    // Dispara a busca apenas se o campo estiver vazio ou for uma data ISO completa e válida
    if (!normalized || this.isValidIsoDateString(normalized)) {
      if (!this.dateRangeError()) {
        this.page.set(1);
        this.loadExecutions();
      }
    }
  }

  onDateRangeChanged(): void {
    if (!this.dateRangeError()) {
      this.page.set(1);
      this.loadExecutions();
    }
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onSharedSearch(value: string): void {
    this.searchSubject.next(value);
  }

  onPageSizeChange(event: Event): void {
    const rawValue = Number((event.target as HTMLSelectElement).value);
    const validSize = ALLOWED_PAGE_SIZES.includes(rawValue as (typeof ALLOWED_PAGE_SIZES)[number])
      ? rawValue
      : DEFAULT_PAGE_SIZE;

    this.pageSize.set(validSize);
    this.savePageSize(validSize);
    this.page.set(1);
    this.loadExecutions();
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadExecutions();
    }
  }

  nextPage(): void {
    const totalPages = this.data()?.total_pages || 1;
    if (this.page() < totalPages) {
      this.page.update((p) => p + 1);
      this.loadExecutions();
    }
  }

  openDetail(executionId: string): void {
    this.selectedExecutionId.set(executionId);
    this.selectedDetail.set(null);
    this.detailError.set(null);
    this.loadDetail(executionId, true);
  }

  private loadDetail(executionId: string, showLoading: boolean): void {
    if (showLoading) this.loadingDetail.set(true);
    this.executionsService.getDetail(executionId).subscribe({
      next: (detail) => {
        if (this.selectedExecutionId() !== executionId) return;
        this.selectedDetail.set(detail);
        this.loadingDetail.set(false);
      },
      error: (err: { error?: { detail?: string }; message?: string }) => {
        const message =
          err.error?.detail || err.message || 'Erro ao carregar detalhes da execução.';
        this.detailError.set(message);
        this.loadingDetail.set(false);
      },
    });
  }

  retrySelectedExecution(): void {
    const detail = this.selectedDetail();
    if (!detail || detail.status !== 'FAILED' || this.retrying()) return;

    this.retrying.set(true);
    this.detailError.set(null);
    this.executionsService
      .retry(detail.execution_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.selectedDetail.set(updated);
          this.retrying.set(false);
          this.loadExecutions();
        },
        error: (err: { error?: { detail?: string }; message?: string }) => {
          this.detailError.set(
            err.error?.detail || err.message || 'Não foi possível reenviar a execução.',
          );
          this.retrying.set(false);
        },
      });
  }

  closeDetail(): void {
    this.selectedExecutionId.set(null);
    this.selectedDetail.set(null);
    this.loadingDetail.set(false);
    this.detailError.set(null);
    this.retrying.set(false);
  }

  private hasActiveExecution(): boolean {
    const isActive = (status: AutomationExecutionStatus) =>
      status === 'QUEUED' || status === 'RUNNING';
    return (
      this.data()?.items.some((item) => isActive(item.status)) === true ||
      (this.selectedDetail() !== null && isActive(this.selectedDetail()!.status))
    );
  }

  private readInitialPageSize(): number {
    if (!this.isBrowser) return DEFAULT_PAGE_SIZE;
    try {
      const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (ALLOWED_PAGE_SIZES.includes(parsed as (typeof ALLOWED_PAGE_SIZES)[number])) {
          return parsed;
        }
      }
    } catch {
      // Storage inacessível em sandbox/privado
    }
    return DEFAULT_PAGE_SIZE;
  }

  private savePageSize(size: number): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
    } catch {
      // Storage indisponível
    }
  }

  // Formatters
  formatShortId(id: string): string {
    if (!id) return '';
    return `EXE-${id.substring(0, 8).toUpperCase()}`;
  }

  formatDateTime(iso: string | null): string {
    if (!iso) return '—';
    try {
      const date = new Date(iso);
      if (isNaN(date.getTime())) return iso.replace(/-/g, '/');
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    } catch {
      return iso.replace(/-/g, '/');
    }
  }

  formatDateSlash(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    return dateStr.replace(/-/g, '/');
  }

  formatDuration(ms: number | null): string {
    if (ms === null || ms === undefined || ms < 0) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
    }
    return `${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
  }

  formatTrigger(trigger: string): string {
    const t = this.t();
    if (trigger === 'SCHEDULED') return t.executionsTriggerScheduled;
    if (trigger === 'MANUAL') return t.executionsTriggerManual;
    return trigger || t.executionsTriggerAutomatic;
  }

  formatStatus(status: AutomationExecutionStatus | string): string {
    const t = this.t();
    switch (status) {
      case 'COMPLETED':
        return t.executionsStatusCompleted;
      case 'FAILED':
        return t.executionsStatusFailed;
      case 'RUNNING':
        return t.executionsStatusRunning;
      case 'QUEUED':
        return t.executionsStatusQueued;
      case 'CANCELLED':
        return t.executionsStatusCancelled;
      default:
        return status;
    }
  }

  getStatusBadgeClass(status: AutomationExecutionStatus): string {
    switch (status) {
      case 'COMPLETED':
        return 'badge badge-success';
      case 'FAILED':
        return 'badge badge-danger';
      case 'RUNNING':
        return 'badge badge-warning';
      case 'QUEUED':
        return 'badge badge-info';
      case 'CANCELLED':
        return 'badge badge-neutral';
      default:
        return 'badge badge-neutral';
    }
  }

  getStatusBadgeTone(status: AutomationExecutionStatus): StatusBadgeTone {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'FAILED':
      case 'CANCELLED':
        return 'danger';
      case 'RUNNING':
      case 'QUEUED':
        return 'warning';
    }
  }

  formatSnapshotStatus(status: AutomationSnapshotStatus): string {
    const t = this.t();
    switch (status) {
      case 'PUBLISHED':
        return t.executionsSnapshotPublished;
      case 'UNCHANGED_REPLAY':
        return t.executionsSnapshotUnchangedReplay;
      case 'PRESERVED_PREVIOUS':
        return t.executionsSnapshotPreservedPrevious;
      case 'NOT_PUBLISHED':
        return t.executionsSnapshotNotPublished;
      default:
        return status;
    }
  }

  getSnapshotBadgeClass(status: AutomationSnapshotStatus): string {
    switch (status) {
      case 'PUBLISHED':
        return 'badge badge-success';
      case 'UNCHANGED_REPLAY':
        return 'badge badge-info';
      case 'PRESERVED_PREVIOUS':
        return 'badge badge-danger';
      case 'NOT_PUBLISHED':
        return 'badge badge-neutral';
      default:
        return 'badge badge-neutral';
    }
  }

  getSnapshotBadgeTone(status: AutomationSnapshotStatus): StatusBadgeTone {
    switch (status) {
      case 'PUBLISHED':
        return 'success';
      case 'NOT_PUBLISHED':
        return 'neutral';
      case 'UNCHANGED_REPLAY':
      case 'PRESERVED_PREVIOUS':
        return 'info';
    }
  }

  formatStepName(code: ExecutionStepCode): string {
    const t = this.t();
    switch (code) {
      case 'GERP_REQUEST':
        return t.executionsStepGerpRequest;
      case 'GERP_REPORT_GENERATION':
        return t.executionsStepGerpReportGeneration;
      case 'FILE_DOWNLOAD':
        return t.executionsStepFileDownload;
      case 'FILE_VALIDATION':
        return t.executionsStepFileValidation;
      case 'DATA_NORMALIZATION':
        return t.executionsStepDataNormalization;
      case 'EXCHANGE_RATE':
        return t.executionsStepExchangeRate;
      case 'JSON_VALIDATION':
        return t.executionsStepJsonValidation;
      case 'SNAPSHOT_PUBLICATION':
        return t.executionsStepSnapshotPublication;
      default:
        return code;
    }
  }

  formatStepStatus(status: ExecutionStepStatus): string {
    const t = this.t();
    switch (status) {
      case 'COMPLETED':
        return t.executionsStatusCompleted;
      case 'FAILED':
        return t.executionsStatusFailed;
      case 'RUNNING':
        return t.executionsStatusRunning;
      case 'PENDING':
        return t.executionsStepPending;
      case 'SKIPPED':
        return t.executionsStepSkipped;
      default:
        return status;
    }
  }

  getStepStatusBadgeClass(status: ExecutionStepStatus): string {
    switch (status) {
      case 'COMPLETED':
        return 'badge badge-success';
      case 'FAILED':
        return 'badge badge-danger';
      case 'RUNNING':
        return 'badge badge-warning';
      case 'PENDING':
        return 'badge badge-neutral';
      case 'SKIPPED':
        return 'badge badge-info';
      default:
        return 'badge badge-neutral';
    }
  }
}
