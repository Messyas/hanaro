import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  AutomationExecutionStatus,
  ExecutionPage,
  ExecutionSortField,
  ExecutionsFilterParams,
  SortOrder,
} from './executions.models';
import { ExecutionsService } from './executions.service';

@Injectable()
export class ExecutionsListStore {
  private readonly executionsService = inject(ExecutionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();
  private listRequest: Subscription | null = null;

  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly statusFilter = signal<AutomationExecutionStatus | ''>('');
  readonly searchQuery = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly sortBy = signal<ExecutionSortField>('started_at');
  readonly sortOrder = signal<SortOrder>('desc');
  readonly data = signal<ExecutionPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.searchChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.page.set(1);
        this.load();
      });
  }

  queueSearch(query: string): void {
    this.searchChanges.next(query);
  }

  load(): void {
    const from = this.dateFrom();
    const to = this.dateTo();
    if (from && to && to < from) return;

    const params: ExecutionsFilterParams = {
      page: this.page(),
      page_size: this.pageSize(),
      sort_by: this.sortBy(),
      sort_order: this.sortOrder(),
    };
    if (isValidIsoDateString(from)) params.date_from = from;
    if (isValidIsoDateString(to)) params.date_to = to;
    if (this.statusFilter()) params.status = this.statusFilter() as AutomationExecutionStatus;
    if (this.searchQuery().trim()) params.search = this.searchQuery().trim();

    this.loading.set(true);
    this.error.set(null);
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
          this.error.set(err.error?.detail || err.message || 'Erro ao carregar dados do servidor.');
          this.loading.set(false);
        },
      });
  }
}

function isValidIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
