import { Injectable, signal } from '@angular/core';
import { Page, ReportListItem } from '../reports.models';

const PAGE_SIZES = [25, 50, 100] as const;

@Injectable()
export class ReportListStore {
  readonly exportsAvailable = signal(false);
  readonly reports = signal<Page<ReportListItem> | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal<(typeof PAGE_SIZES)[number]>(25);
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly filterOpen = signal(false);
  readonly showCreate = signal(false);
  readonly createTitle = signal('');
  readonly createDescription = signal('');
  readonly createKind = signal<'DOSSIER' | 'PERIOD_CLOSE'>('DOSSIER');
  readonly createPeriodFrom = signal('');
  readonly createPeriodTo = signal('');
  readonly creating = signal(false);

  reset(): void {
    this.exportsAvailable.set(false);
    this.reports.set(null);
    this.loading.set(false);
    this.error.set(null);
    this.page.set(1);
    this.pageSize.set(25);
    this.search.set('');
    this.statusFilter.set('');
    this.filterOpen.set(false);
    this.showCreate.set(false);
    this.createTitle.set('');
    this.createDescription.set('');
    this.createKind.set('DOSSIER');
    this.createPeriodFrom.set('');
    this.createPeriodTo.set('');
    this.creating.set(false);
  }
}
