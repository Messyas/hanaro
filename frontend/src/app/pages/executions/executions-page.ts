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
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
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

export interface CalendarDay {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
}

@Component({
  selector: 'app-executions-page',
  imports: [DecimalPipe, UiIcon],
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
  readonly statusDropdownOpen = signal<boolean>(false);
  readonly pageSizeDropdownOpen = signal<boolean>(false);
  readonly dateFromPickerOpen = signal<boolean>(false);
  readonly dateToPickerOpen = signal<boolean>(false);
  readonly viewDateFrom = signal<Date>(new Date());
  readonly viewDateTo = signal<Date>(new Date());

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

  // Estado do detalhe
  readonly selectedExecutionId = signal<string | null>(null);
  readonly selectedDetail = signal<ExecutionDetail | null>(null);
  readonly loadingDetail = signal<boolean>(false);
  readonly detailError = signal<string | null>(null);

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.page.set(1);
        this.loadExecutions();
      });

    this.loadExecutions();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.filterOpen() && target && !target.closest('.filter-popover-anchor')) {
      this.closeFilterPopover();
    }
    if (this.statusDropdownOpen() && target && !target.closest('.status-select-anchor')) {
      this.statusDropdownOpen.set(false);
    }
    if (this.pageSizeDropdownOpen() && target && !target.closest('.pagination-size-select')) {
      this.pageSizeDropdownOpen.set(false);
    }
    if (this.dateFromPickerOpen() && target && !target.closest('.date-from-anchor')) {
      this.dateFromPickerOpen.set(false);
    }
    if (this.dateToPickerOpen() && target && !target.closest('.date-to-anchor')) {
      this.dateToPickerOpen.set(false);
    }
  }

  handleEscapeKey(): void {
    if (this.dateFromPickerOpen() || this.dateToPickerOpen()) {
      this.dateFromPickerOpen.set(false);
      this.dateToPickerOpen.set(false);
    } else if (this.statusDropdownOpen()) {
      this.statusDropdownOpen.set(false);
    } else if (this.pageSizeDropdownOpen()) {
      this.pageSizeDropdownOpen.set(false);
    } else if (this.filterOpen()) {
      this.closeFilterPopover();
    } else if (this.selectedExecutionId()) {
      this.closeDetail();
    }
  }

  toggleFilterPopover(event?: Event): void {
    if (event) event.stopPropagation();
    this.filterOpen.update((v) => !v);
    this.statusDropdownOpen.set(false);
    this.dateFromPickerOpen.set(false);
    this.dateToPickerOpen.set(false);
  }

  closeFilterPopover(): void {
    this.filterOpen.set(false);
    this.statusDropdownOpen.set(false);
    this.dateFromPickerOpen.set(false);
    this.dateToPickerOpen.set(false);
  }

  // Custom Select Methods
  toggleStatusDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.statusDropdownOpen.update((v) => !v);
    this.dateFromPickerOpen.set(false);
    this.dateToPickerOpen.set(false);
  }

  selectStatus(value: AutomationExecutionStatus | ''): void {
    this.statusFilter.set(value);
    this.statusDropdownOpen.set(false);
    this.page.set(1);
    this.loadExecutions();
  }

  getStatusOptionLabel(value: AutomationExecutionStatus | ''): string {
    if (!value) return this.t().executionsAllStatus;
    return this.formatStatus(value);
  }

  togglePageSizeDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.pageSizeDropdownOpen.update((v) => !v);
  }

  selectPageSize(size: number): void {
    this.pageSize.set(size);
    this.savePageSize(size);
    this.pageSizeDropdownOpen.set(false);
    this.page.set(1);
    this.loadExecutions();
  }

  // Custom Datepicker Methods
  getMonthYearLabel(viewDate: Date): string {
    const lang = this.language.currentLanguage();
    const locale = lang === 'pt' ? 'pt-BR' : lang === 'ko' ? 'ko-KR' : 'en-US';
    return viewDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }

  getWeekdayLabels(): string[] {
    const lang = this.language.currentLanguage();
    if (lang === 'pt') return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    if (lang === 'ko') return ['일', '월', '화', '수', '목', '금', '토'];
    return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  }

  getCalendarDays(
    viewDate: Date,
    selectedIsoDate: string,
    minDate?: string,
    maxDate?: string,
  ): CalendarDay[] {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDayCurrentMonth = new Date(year, month + 1, 0).getDate();
    const lastDayPrevMonth = new Date(year, month, 0).getDate();

    const todayIso = this.formatIsoDate(new Date());
    const days: CalendarDay[] = [];

    const isDayDisabled = (dStr: string) => {
      if (minDate && dStr < minDate) return true;
      if (maxDate && dStr > maxDate) return true;
      return false;
    };

    // Dias do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = lastDayPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      const dateStr = this.formatIsoDate(d);
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayIso,
        isSelected: dateStr === selectedIsoDate,
        isDisabled: isDayDisabled(dateStr),
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= lastDayCurrentMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = this.formatIsoDate(d);
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayIso,
        isSelected: dateStr === selectedIsoDate,
        isDisabled: isDayDisabled(dateStr),
      });
    }

    // Preenchimento do próximo mês (completar grade de 35 ou 42)
    const remaining = days.length <= 35 ? 35 - days.length : 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = this.formatIsoDate(d);
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayIso,
        isSelected: dateStr === selectedIsoDate,
        isDisabled: isDayDisabled(dateStr),
      });
    }

    return days;
  }

  private formatIsoDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  prevMonthFrom(event?: Event): void {
    if (event) event.stopPropagation();
    this.viewDateFrom.update((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonthFrom(event?: Event): void {
    if (event) event.stopPropagation();
    this.viewDateFrom.update((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  prevMonthTo(event?: Event): void {
    if (event) event.stopPropagation();
    this.viewDateTo.update((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonthTo(event?: Event): void {
    if (event) event.stopPropagation();
    this.viewDateTo.update((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  toggleDateFromPicker(event?: Event): void {
    if (event) event.stopPropagation();
    const next = !this.dateFromPickerOpen();
    this.dateFromPickerOpen.set(next);
    this.dateToPickerOpen.set(false);
    this.statusDropdownOpen.set(false);
    if (next && this.dateFrom() && this.isValidIsoDateString(this.dateFrom())) {
      const parsed = new Date(this.dateFrom() + 'T00:00:00');
      if (!isNaN(parsed.getTime())) this.viewDateFrom.set(parsed);
    }
  }

  toggleDateToPicker(event?: Event): void {
    if (event) event.stopPropagation();
    const next = !this.dateToPickerOpen();
    this.dateToPickerOpen.set(next);
    this.dateFromPickerOpen.set(false);
    this.statusDropdownOpen.set(false);
    if (next && this.dateTo() && this.isValidIsoDateString(this.dateTo())) {
      const parsed = new Date(this.dateTo() + 'T00:00:00');
      if (!isNaN(parsed.getTime())) this.viewDateTo.set(parsed);
    }
  }

  selectDayFrom(dayStr: string): void {
    this.dateFrom.set(dayStr);
    this.dateFromPickerOpen.set(false);
    // Se a data final atual for anterior à nova data inicial, limpamos a data final para preservar a integridade temporal
    if (this.dateTo() && this.dateTo() < dayStr) {
      this.dateTo.set('');
    }
    this.page.set(1);
    this.loadExecutions();
  }

  selectDayTo(dayStr: string): void {
    if (this.dateFrom() && dayStr < this.dateFrom()) {
      return; // Bloqueado contra datas inconsistentes
    }
    this.dateTo.set(dayStr);
    this.dateToPickerOpen.set(false);
    this.page.set(1);
    this.loadExecutions();
  }

  setTodayFrom(): void {
    const today = this.formatIsoDate(new Date());
    this.selectDayFrom(today);
  }

  setTodayTo(): void {
    const today = this.formatIsoDate(new Date());
    this.selectDayTo(today);
  }

  clearDateFromInput(): void {
    this.dateFrom.set('');
    this.dateFromPickerOpen.set(false);
    this.page.set(1);
    this.loadExecutions();
  }

  clearDateToInput(): void {
    this.dateTo.set('');
    this.dateToPickerOpen.set(false);
    this.page.set(1);
    this.loadExecutions();
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
    this.searchSubject.next('');
    this.page.set(1);
    this.loadExecutions();
  }

  clearSearch(event?: Event): void {
    if (event) event.stopPropagation();
    this.searchQuery.set('');
    this.searchSubject.next('');
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

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
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
    this.loadingDetail.set(true);
    this.detailError.set(null);

    this.executionsService.getDetail(executionId).subscribe({
      next: (detail) => {
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
