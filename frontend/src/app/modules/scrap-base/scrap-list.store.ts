import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import {
  ScrapFilterParams,
  ScrapPage,
  ScrapReviewFilterStatus,
  ScrapSortField,
  SortOrder,
} from './scrap-base.models';
import { ScrapBaseService } from './scrap-base.service';

const PAGE_SIZES = [25, 50, 100, 200] as const;

@Injectable({ providedIn: 'root' })
export class ScrapListStore {
  private readonly scrapBaseService = inject(ScrapBaseService);
  private readonly authService = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();
  private listRequest: Subscription | null = null;
  private excludeReviewed = false;

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
  readonly reviewStatusFilter = signal<ScrapReviewFilterStatus | ''>('');
  readonly defectTypeFilter = signal('');
  readonly responsibleFilter = signal<'mine' | ''>('');
  readonly data = signal<ScrapPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => {
        this.searchQuery.set(search.trim());
        this.page.set(1);
        this.load(this.excludeReviewed);
      });
  }

  onSearchInput(value: string): void {
    this.searchText.set(value);
    this.searchSubject.next(value);
  }

  load(excludeReviewed: boolean, onLoaded?: (page: ScrapPage) => void): void {
    if (this.dateFrom() && this.dateTo() && this.dateTo() < this.dateFrom()) return;
    this.excludeReviewed = excludeReviewed;
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.listRequest = this.scrapBaseService
      .list(this.buildFilters(excludeReviewed))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.data.set(page);
          this.loading.set(false);
          onLoaded?.(page);
        },
        error: (error: { error?: { detail?: string }; message?: string }) => {
          this.error.set(
            error.error?.detail || error.message || this.language.translations().scrapErrorTitle,
          );
          this.loading.set(false);
        },
      });
  }

  private buildFilters(excludeReviewed: boolean): ScrapFilterParams {
    const organizations = this.organization()
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const currentUser = this.authService.user();
    const responsibleIds =
      this.responsibleFilter() === 'mine' && currentUser?.id ? [currentUser.id] : undefined;

    return {
      page: this.page(),
      page_size: this.pageSize(),
      sort_by: this.sortBy(),
      sort_order: this.sortOrder(),
      ...(this.dateFrom() ? { date_from: this.dateFrom() } : {}),
      ...(this.dateTo() ? { date_to: this.dateTo() } : {}),
      ...(organizations.length ? { organizations } : {}),
      ...(this.searchQuery() ? { search: this.searchQuery() } : {}),
      ...(this.reviewStatusFilter()
        ? { review_status: this.reviewStatusFilter() as ScrapReviewFilterStatus }
        : {}),
      ...(this.defectTypeFilter() ? { defect_type_ids: [this.defectTypeFilter()] } : {}),
      ...(responsibleIds ? { responsible_user_ids: responsibleIds } : {}),
      ...(excludeReviewed ? { exclude_reviewed: true } : {}),
    };
  }
}
