import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
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
import { ScrapFilterParams, ScrapPage, ScrapSortField, SortOrder } from './scrap-base.models';
import { ScrapBaseService } from './scrap-base.service';

const PAGE_SIZES = [25, 50, 100, 200] as const;

@Component({
  selector: 'app-scrap-base-page',
  imports: [
    InlineAlert,
    DelayedProgressSpinner,
    ListFeedback,
    ListFilterDateRange,
    ListFilterInput,
    ListFilterPopover,
    ListFilterSelect,
    ListPagination,
    ListPanel,
    ListTableSkeleton,
    StatusBadge,
  ],
  templateUrl: './scrap-base-page.html',
  styleUrl: './scrap-base-page.css',
})
export class ScrapBasePage implements OnInit {
  private readonly scrapBaseService = inject(ScrapBaseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();
  private listRequest: Subscription | null = null;

  readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());
  readonly pageSizes = PAGE_SIZES;
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly organization = signal('');
  readonly searchText = signal('');
  readonly searchQuery = signal('');
  readonly page = signal(1);
  readonly pageSize = signal<(typeof PAGE_SIZES)[number]>(50);
  readonly sortBy = signal<ScrapSortField>('transaction_date');
  readonly sortOrder = signal<SortOrder>('desc');
  readonly filterOpen = signal(false);
  readonly data = signal<ScrapPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly tableColumns = computed(() => [
    this.t().scrapColDate,
    this.t().scrapColOrganization,
    this.t().scrapColItem,
    this.t().scrapColDescription,
    this.t().scrapColOrder,
    this.t().scrapColQuantity,
    this.t().scrapColAmountBrl,
    this.t().scrapColAmountUsd,
    this.t().scrapColOccurrence,
  ]);
  readonly sortOptions = computed<readonly ListFilterSelectOption[]>(() => [
    { value: 'transaction_date', label: this.t().scrapSortTransactionDate },
    { value: 'organization_code', label: this.t().scrapSortOrganization },
    { value: 'item_code', label: this.t().scrapSortItemCode },
    { value: 'issue_quantity', label: this.t().scrapSortQuantity },
    { value: 'issue_amount_brl', label: this.t().scrapSortAmountBrl },
    { value: 'amount_usd', label: this.t().scrapSortAmountUsd },
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
    ].filter(Boolean).length;
  });

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => {
        this.searchQuery.set(search.trim());
        this.page.set(1);
        this.loadScrap();
      });
    this.loadScrap();
  }

  loadScrap(): void {
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
        },
        error: (err: { error?: { detail?: string }; message?: string }) => {
          this.error.set(err.error?.detail || err.message || this.t().scrapErrorTitle);
          this.loading.set(false);
        },
      });
  }

  onSearchInput(value: string): void {
    this.searchText.set(value);
    this.searchSubject.next(value);
  }

  onDateChange(): void {
    if (!this.dateRangeError()) {
      this.page.set(1);
      this.loadScrap();
    }
  }

  onOrganizationChange(): void {
    this.page.set(1);
    this.loadScrap();
  }

  onSortChange(value: string): void {
    this.sortBy.set(value as ScrapSortField);
    this.page.set(1);
    this.loadScrap();
  }

  onPageSizeChange(value: number): void {
    this.pageSize.set(value as (typeof PAGE_SIZES)[number]);
    this.page.set(1);
    this.loadScrap();
  }

  toggleSortOrder(): void {
    this.sortOrder.update((order) => (order === 'asc' ? 'desc' : 'asc'));
    this.page.set(1);
    this.loadScrap();
  }

  clearFilters(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.organization.set('');
    this.searchText.set('');
    this.searchQuery.set('');
    this.page.set(1);
    this.loadScrap();
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update((page) => page - 1);
      this.loadScrap();
    }
  }

  nextPage(): void {
    if (this.page() < (this.data()?.total_pages ?? 1)) {
      this.page.update((page) => page + 1);
      this.loadScrap();
    }
  }

  formatNumber(value: string): string {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value));
  }

  formatCurrency(value: string, currency: 'BRL' | 'USD'): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value));
  }

  formatTransactionDate(value: string): string {
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  formatOccurrenceStatus(status: string): string {
    return status === 'ACTIVE' ? this.t().scrapOccurrenceActive : status.replaceAll('_', ' ');
  }

  calendarLocale(): string {
    const language = this.language.currentLanguage();
    return language === 'pt' ? 'pt-BR' : language === 'ko' ? 'ko-KR' : 'en-US';
  }

  private buildFilters(): ScrapFilterParams {
    const organizations = this.organization()
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      page: this.page(),
      page_size: this.pageSize(),
      sort_by: this.sortBy(),
      sort_order: this.sortOrder(),
      ...(this.dateFrom() ? { date_from: this.dateFrom() } : {}),
      ...(this.dateTo() ? { date_to: this.dateTo() } : {}),
      ...(organizations.length ? { organizations } : {}),
      ...(this.searchQuery() ? { search: this.searchQuery() } : {}),
    };
  }
}
