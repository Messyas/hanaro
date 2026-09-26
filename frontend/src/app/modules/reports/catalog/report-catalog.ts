import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { ListFilterInput } from '../../../shared/components/list-filters/list-filter-input';
import { ListFilterPopover } from '../../../shared/components/list-filters/list-filter-popover';
import { ListFilterSelect } from '../../../shared/components/list-filters/list-filter-select';
import { DelayedProgressSpinner } from '../../../shared/components/list-view/delayed-progress-spinner/delayed-progress-spinner';
import { InlineAlert } from '../../../shared/components/list-view/inline-alert/inline-alert';
import { ListFeedback } from '../../../shared/components/list-view/list-feedback/list-feedback';
import { ListPagination } from '../../../shared/components/list-view/list-pagination/list-pagination';
import { ListPanel } from '../../../shared/components/list-view/list-panel/list-panel';
import { StatusBadge } from '../../../shared/components/list-view/status-badge/status-badge';
import { UiIcon } from '../../../shared/components/ui-icon/ui-icon';
import { COPY } from '../reports.copy';
import { ReportCatalogService } from './report-catalog.service';
import { ReportListStore } from './report-list.store';

const PAGE_SIZES = [25, 50, 100] as const;

@Component({
  selector: 'app-report-catalog',
  imports: [
    FormsModule,
    DelayedProgressSpinner,
    InlineAlert,
    ListFeedback,
    ListPagination,
    ListPanel,
    ListFilterInput,
    ListFilterPopover,
    ListFilterSelect,
    StatusBadge,
    UiIcon,
  ],
  templateUrl: './report-catalog.html',
  styleUrl: './report-catalog.css',
})
export class ReportCatalog implements OnInit {
  private readonly catalog = inject(ReportCatalogService);
  private readonly store = inject(ReportListStore);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();

  readonly opened = output<string>();
  readonly c = computed(() => COPY[this.language.currentLanguage()]);
  readonly pageSizes = PAGE_SIZES;
  readonly reports = this.store.reports;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly page = this.store.page;
  readonly pageSize = this.store.pageSize;
  readonly search = this.store.search;
  readonly statusFilter = this.store.statusFilter;
  readonly filterOpen = this.store.filterOpen;
  readonly activeFiltersCount = computed(
    () => [this.search().trim(), this.statusFilter()].filter(Boolean).length,
  );
  readonly statusOptions = computed(() => [
    { value: '', label: this.c().all },
    { value: 'DRAFT', label: this.c().draft },
    { value: 'PUBLISHED', label: this.c().published },
  ]);
  readonly showCreate = this.store.showCreate;
  readonly createTitle = this.store.createTitle;
  readonly createDescription = this.store.createDescription;
  readonly createKind = this.store.createKind;
  readonly createPeriodFrom = this.store.createPeriodFrom;
  readonly createPeriodTo = this.store.createPeriodTo;
  readonly creating = this.store.creating;

  ngOnInit(): void {
    this.searchChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.loadReports();
      });
    this.loadReports();
  }

  loadReports(): void {
    this.loading.set(true);
    this.error.set(null);
    this.catalog
      .list({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search().trim() || undefined,
        status: this.statusFilter() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.reports.set(page);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(this.message(error));
          this.loading.set(false);
        },
      });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.searchChanges.next(value);
  }

  onStatus(value: string): void {
    this.statusFilter.set(value);
    this.page.set(1);
    this.loadReports();
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('');
    this.page.set(1);
    this.filterOpen.set(false);
    this.loadReports();
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update((value) => value - 1);
      this.loadReports();
    }
  }

  nextPage(): void {
    if (this.reports()?.has_next) {
      this.page.update((value) => value + 1);
      this.loadReports();
    }
  }

  onPageSize(value: number): void {
    this.pageSize.set(value as (typeof PAGE_SIZES)[number]);
    this.page.set(1);
    this.loadReports();
  }

  createReport(): void {
    if (!this.createTitle().trim()) {
      this.error.set(this.c().requiredTitle);
      return;
    }
    this.creating.set(true);
    const kind = this.createKind();
    if (kind === 'PERIOD_CLOSE' && (!this.createPeriodFrom() || !this.createPeriodTo())) {
      this.error.set('Informe o período do fechamento.');
      this.creating.set(false);
      return;
    }
    const input =
      kind === 'DOSSIER'
        ? { title: this.createTitle().trim(), description: this.createDescription().trim() }
        : {
            title: this.createTitle().trim(),
            description: this.createDescription().trim(),
            report_kind: 'PERIOD_CLOSE' as const,
            content_schema_version: 2,
            scope: {
              period_from: this.createPeriodFrom(),
              period_to: this.createPeriodTo(),
              cutoff_at: null,
              timezone: 'America/Manaus',
              metric_code: 'MATERIAL_SCRAP_COST' as const,
              metric_policy_version: 'scrap-cost-v1' as const,
              currency: 'USD' as const,
              comparison_mode: 'NONE' as const,
              comparison_from: null,
              comparison_to: null,
              is_provisional: true,
              filters: { organization_codes: [], product_codes: [], divisions: [], lines: [] },
            },
          };
    this.catalog
      .create(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.creating.set(false);
          this.showCreate.set(false);
          this.createTitle.set('');
          this.createDescription.set('');
          this.createPeriodFrom.set('');
          this.createPeriodTo.set('');
          this.openReport(report.id);
        },
        error: (error) => {
          this.creating.set(false);
          this.error.set(this.message(error));
        },
      });
  }

  openReport(reportId: string): void {
    this.opened.emit(reportId);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const locale =
      this.language.currentLanguage() === 'pt'
        ? 'pt-BR'
        : this.language.currentLanguage() === 'ko'
          ? 'ko-KR'
          : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  }

  @HostListener('window:keydown.escape')
  closeCreateDialog(): void {
    this.showCreate.set(false);
  }

  private message(error: { error?: { detail?: string }; message?: string }): string {
    return error.error?.detail || error.message || this.c().genericError;
  }
}
