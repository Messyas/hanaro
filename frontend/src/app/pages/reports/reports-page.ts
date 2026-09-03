import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../i18n/language.service';
import { ListFilterDateRange } from '../../shared/list-filters/list-filter-date-range';
import { ListFilterInput } from '../../shared/list-filters/list-filter-input';
import { ListFilterPopover } from '../../shared/list-filters/list-filter-popover';
import {
  ListFilterSelect,
  ListFilterSelectOption,
} from '../../shared/list-filters/list-filter-select';
import { DelayedProgressSpinner } from '../../shared/list-view/delayed-progress-spinner/delayed-progress-spinner';
import { InlineAlert } from '../../shared/list-view/inline-alert/inline-alert';
import { ListFeedback } from '../../shared/list-view/list-feedback/list-feedback';
import { ListPagination } from '../../shared/list-view/list-pagination/list-pagination';
import { ListPanel } from '../../shared/list-view/list-panel/list-panel';
import { ListTableSkeleton } from '../../shared/list-view/list-table-skeleton/list-table-skeleton';
import { StatusBadge } from '../../shared/list-view/status-badge/status-badge';
import { UiIcon } from '../../ui-icon';
import {
  ScrapFilterParams,
  ScrapListItem,
  ScrapPage,
  ScrapSortField,
  SortOrder,
} from '../scrap-base/scrap-base.models';
import { ScrapBaseService } from '../scrap-base/scrap-base.service';
import { ScrapDefectType, ScrapReview } from '../scrap-base/scrap-review.models';
import { ScrapReviewPreview } from '../scrap-base/scrap-review-preview/scrap-review-preview';
import { ScrapReviewService } from '../scrap-base/scrap-review.service';

const PAGE_SIZES = [25, 50, 100] as const;

@Component({
  selector: 'app-reports-page',
  imports: [
    DelayedProgressSpinner,
    InlineAlert,
    ListFeedback,
    ListFilterDateRange,
    ListFilterInput,
    ListFilterPopover,
    ListFilterSelect,
    ListPagination,
    ListPanel,
    ListTableSkeleton,
    ScrapReviewPreview,
    UiIcon,
  ],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.css',
})
export class ReportsPage implements OnInit {
  private readonly scrapBaseService = inject(ScrapBaseService);
  private readonly reviewService = inject(ScrapReviewService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchSubject = new Subject<string>();
  private listRequest: Subscription | null = null;

  readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());
  readonly pageSizes = PAGE_SIZES;

  // Filtros
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly organization = signal('');
  readonly searchText = signal('');
  readonly searchQuery = signal('');
  readonly defectTypeFilter = signal('');
  readonly responsibleFilter = signal<'mine' | ''>('');
  readonly page = signal(1);
  readonly pageSize = signal<(typeof PAGE_SIZES)[number]>(25);
  readonly sortBy = signal<ScrapSortField>('transaction_date');
  readonly sortOrder = signal<SortOrder>('desc');
  readonly filterOpen = signal(false);

  readonly defectTypes = signal<ScrapDefectType[]>([]);
  readonly data = signal<ScrapPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Detalhe / Drawer de visualização somente leitura
  readonly selectedOccurrenceId = signal<string | null>(null);
  readonly selectedOccurrence = signal<ScrapListItem | null>(null);
  readonly selectedReview = signal<ScrapReview | null>(null);
  readonly loadingDetail = signal(false);
  readonly detailError = signal<string | null>(null);

  readonly tableColumns = computed(() => [
    this.t().scrapColDate,
    this.t().scrapColOrganization,
    this.t().scrapColItem,
    this.t().scrapColDescription,
    this.t().scrapColAmountUsd,
    this.t().scrapColDefectType,
    this.t().scrapColResponsible,
    'FOTOS',
    this.t().scrapColAction,
  ]);

  readonly sortOptions = computed<readonly ListFilterSelectOption[]>(() => [
    { value: 'transaction_date', label: this.t().scrapSortTransactionDate },
    { value: 'organization_code', label: this.t().scrapSortOrganization },
    { value: 'item_code', label: this.t().scrapSortItemCode },
    { value: 'amount_usd', label: this.t().scrapSortAmountUsd },
  ]);

  readonly defectTypeOptions = computed<readonly ListFilterSelectOption[]>(() => {
    const list: ListFilterSelectOption[] = [
      { value: '', label: this.t().scrapFilterDefectTypeAll },
    ];
    for (const dt of this.defectTypes()) {
      list.push({ value: dt.id, label: dt.name });
    }
    return list;
  });

  readonly responsibleOptions = computed<readonly ListFilterSelectOption[]>(() => [
    { value: '', label: this.t().scrapFilterResponsibleAll },
    { value: 'mine', label: this.t().scrapFilterResponsibleMine },
  ]);

  readonly dateRangeError = computed(() => {
    return Boolean(this.dateFrom() && this.dateTo() && this.dateTo() < this.dateFrom());
  });

  readonly activeFiltersCount = computed(() => {
    return [
      this.dateFrom(),
      this.dateTo(),
      this.organization().trim(),
      this.searchText().trim(),
      this.defectTypeFilter(),
      this.responsibleFilter(),
    ].filter(Boolean).length;
  });

  ngOnInit(): void {
    this.loadDefectTypes();

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const occurrenceId = params.get('occurrenceId');
      if (occurrenceId) {
        this.openReportDetail(occurrenceId);
      } else {
        this.selectedOccurrenceId.set(null);
        this.selectedReview.set(null);
      }
    });

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => {
        this.searchQuery.set(search.trim());
        this.page.set(1);
        this.loadReports();
      });

    this.loadReports();
  }

  loadDefectTypes(): void {
    this.reviewService
      .getDefectTypes(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types) => this.defectTypes.set(types),
        error: () => this.defectTypes.set([]),
      });
  }

  loadReports(): void {
    if (this.dateRangeError()) return;

    const filters = this.buildFilters();

    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.listRequest = this.scrapBaseService
      .list(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.data.set(page);
          this.loading.set(false);

          const currentId = this.selectedOccurrenceId();
          if (currentId) {
            const found = page.items.find((i) => i.occurrence_id === currentId);
            if (found) {
              this.selectedOccurrence.set(found);
            }
          }
        },
        error: (err: { error?: { detail?: string }; message?: string }) => {
          this.error.set(err.error?.detail || err.message || this.t().scrapErrorTitle);
          this.loading.set(false);
        },
      });
  }

  openReportDetail(occurrenceId: string, item?: ScrapListItem): void {
    this.selectedOccurrenceId.set(occurrenceId);
    if (item) {
      this.selectedOccurrence.set(item);
    }
    this.loadingDetail.set(true);
    this.detailError.set(null);

    this.router.navigate(['/relatorios', occurrenceId], { queryParamsHandling: 'preserve' });

    this.reviewService
      .getReview(occurrenceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rev) => {
          this.selectedReview.set(rev);
          this.loadingDetail.set(false);
        },
        error: (err) => {
          this.loadingDetail.set(false);
          this.detailError.set(err.error?.detail || err.message || 'Erro ao carregar relatório.');
        },
      });
  }

  closeDetail(): void {
    this.selectedOccurrenceId.set(null);
    this.selectedOccurrence.set(null);
    this.selectedReview.set(null);
    this.router.navigate(['/relatorios'], { queryParamsHandling: 'preserve' });
  }

  onUseAsReference(review: ScrapReview): void {
    this.router.navigate(['/base-de-scrap'], {
      state: { referenceReview: review },
    });
  }

  onSearchInput(value: string): void {
    this.searchText.set(value);
    this.searchSubject.next(value);
  }

  onDateChange(): void {
    if (!this.dateRangeError()) {
      this.page.set(1);
      this.loadReports();
    }
  }

  onOrganizationChange(): void {
    this.page.set(1);
    this.loadReports();
  }

  onSortChange(value: string): void {
    this.sortBy.set(value as ScrapSortField);
    this.page.set(1);
    this.loadReports();
  }

  onPageSizeChange(value: number): void {
    this.pageSize.set(value as (typeof PAGE_SIZES)[number]);
    this.page.set(1);
    this.loadReports();
  }

  onDefectTypeFilterChange(value: string): void {
    this.defectTypeFilter.set(value);
    this.page.set(1);
    this.loadReports();
  }

  onResponsibleFilterChange(value: string): void {
    this.responsibleFilter.set(value as 'mine' | '');
    this.page.set(1);
    this.loadReports();
  }

  toggleSortOrder(): void {
    this.sortOrder.update((order) => (order === 'asc' ? 'desc' : 'asc'));
    this.page.set(1);
    this.loadReports();
  }

  clearFilters(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.organization.set('');
    this.searchText.set('');
    this.searchQuery.set('');
    this.defectTypeFilter.set('');
    this.responsibleFilter.set('');
    this.page.set(1);
    this.loadReports();
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadReports();
    }
  }

  nextPage(): void {
    if (this.page() < (this.data()?.total_pages ?? 1)) {
      this.page.update((p) => p + 1);
      this.loadReports();
    }
  }

  formatCurrency(value: string): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(
      Number(value),
    );
  }

  formatTransactionDate(value: string | null | undefined): string {
    if (!value) return '—';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  calendarLocale(): string {
    const language = this.language.currentLanguage();
    return language === 'pt' ? 'pt-BR' : language === 'ko' ? 'ko-KR' : 'en-US';
  }

  private buildFilters(): ScrapFilterParams {
    const organizations = this.organization()
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const currentUser = this.authService.user();
    const responsibleIds =
      this.responsibleFilter() === 'mine' && currentUser?.id ? [currentUser.id] : undefined;

    return {
      review_status: 'REVIEWED',
      page: this.page(),
      page_size: this.pageSize(),
      sort_by: this.sortBy(),
      sort_order: this.sortOrder(),
      ...(this.dateFrom() ? { date_from: this.dateFrom() } : {}),
      ...(this.dateTo() ? { date_to: this.dateTo() } : {}),
      ...(organizations.length ? { organizations } : {}),
      ...(this.searchQuery() ? { search: this.searchQuery() } : {}),
      ...(this.defectTypeFilter() ? { defect_type_ids: [this.defectTypeFilter()] } : {}),
      ...(responsibleIds ? { responsible_user_ids: responsibleIds } : {}),
    };
  }
}
