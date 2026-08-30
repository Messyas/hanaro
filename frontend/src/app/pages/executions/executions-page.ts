import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../i18n/language.service';
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

const ALLOWED_PAGE_SIZES = [10, 25, 50, 100] as const;
const PAGE_SIZE_STORAGE_KEY = 'hanaro-executions-page-size';
const DEFAULT_PAGE_SIZE = 25;

@Component({
  selector: 'app-executions-page',
  imports: [DecimalPipe, UiIcon],
  templateUrl: './executions-page.html',
  styleUrl: './executions-page.css',
  host: {
    '(document:keydown.escape)': 'closeDetail()',
  },
})
export class ExecutionsPage implements OnInit {
  private readonly executionsService = inject(ExecutionsService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());

  // Filtros e paginação
  readonly dateFrom = signal<string>('');
  readonly dateTo = signal<string>('');
  readonly statusFilter = signal<AutomationExecutionStatus | ''>('');
  readonly searchQuery = signal<string>('');
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(this.readInitialPageSize());
  readonly sortBy = signal<ExecutionSortField>('started_at');
  readonly sortOrder = signal<SortOrder>('desc');

  // Estado da listagem
  readonly data = signal<ExecutionPage | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Estado do detalhe
  readonly selectedExecutionId = signal<string | null>(null);
  readonly selectedDetail = signal<ExecutionDetail | null>(null);
  readonly loadingDetail = signal<boolean>(false);
  readonly detailError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadExecutions();
  }

  loadExecutions(): void {
    this.loading.set(true);
    this.error.set(null);

    const params: ExecutionsFilterParams = {
      page: this.page(),
      page_size: this.pageSize(),
      sort_by: this.sortBy(),
      sort_order: this.sortOrder(),
    };

    if (this.dateFrom()) params.date_from = this.dateFrom();
    if (this.dateTo()) params.date_to = this.dateTo();
    if (this.statusFilter()) params.status = this.statusFilter() as AutomationExecutionStatus;
    if (this.searchQuery().trim()) params.search = this.searchQuery().trim();

    this.executionsService.list(params).subscribe({
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

  clearFilters(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.statusFilter.set('');
    this.searchQuery.set('');
    this.page.set(1);
    this.loadExecutions();
  }

  onDateFromChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dateFrom.set(value);
    this.page.set(1);
    this.loadExecutions();
  }

  onDateToChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dateTo.set(value);
    this.page.set(1);
    this.loadExecutions();
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AutomationExecutionStatus | '';
    this.statusFilter.set(value);
    this.page.set(1);
    this.loadExecutions();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.page.set(1);
    this.loadExecutions();
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
    this.loadingDetail.set(true);
    this.detailError.set(null);

    this.executionsService.getDetail(executionId).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.loadingDetail.set(false);
      },
      error: (err: { error?: { detail?: string }; message?: string }) => {
        const message = err.error?.detail || err.message || 'Erro ao carregar detalhes da execução.';
        this.detailError.set(message);
        this.loadingDetail.set(false);
      },
    });
  }

  closeDetail(): void {
    this.selectedExecutionId.set(null);
    this.selectedDetail.set(null);
    this.loadingDetail.set(false);
    this.detailError.set(null);
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
      if (isNaN(date.getTime())) return iso;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    } catch {
      return iso;
    }
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

  formatStatus(status: AutomationExecutionStatus): string {
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
