import { Injectable, computed, signal } from '@angular/core';
import {
  Page,
  PeriodClosePreview,
  ReportAnalytics,
  ReportPreview,
  ReportScope,
  ReportVersion,
} from './reports.models';

@Injectable()
export class ReportEditorStore {
  readonly occurrenceSearch = signal('');
  readonly sourceReportSearch = signal('');
  readonly selectedOccurrences = signal(new Set<string>());
  readonly selectedReports = signal(new Set<string>());
  readonly activeDrawer = signal<'occurrence' | 'report' | null>(null);
  readonly analytics = signal<ReportAnalytics | null>(null);
  readonly scopeDraft = signal<ReportScope | null>(null);
  readonly draftTitle = signal('');
  readonly draftDescription = signal('');
  readonly saving = signal(false);
  readonly saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly lastSavedTime = signal<string | null>(null);
  readonly historical = signal<ReportVersion | null>(null);
  readonly versions = signal<ReportVersion[]>([]);
  readonly versionsPage = signal<Page<ReportVersion> | null>(null);
  readonly versionPage = signal(1);
  readonly periodPreview = signal<PeriodClosePreview | null>(null);
  readonly dossierPreview = signal<ReportPreview | null>(null);
  readonly previewLoading = signal(false);
  readonly previewStale = signal(false);
  readonly hasPreview = computed(() => !!this.periodPreview() || !!this.dossierPreview());

  beginPreviewLoad(): void {
    this.previewLoading.set(true);
  }
  setPeriodPreview(preview: PeriodClosePreview): void {
    this.periodPreview.set(preview);
    this.previewStale.set(false);
    this.previewLoading.set(false);
  }
  setDossierPreview(preview: ReportPreview): void {
    this.dossierPreview.set(preview);
    this.previewStale.set(false);
    this.previewLoading.set(false);
  }
  markPreviewStale(): void {
    this.previewStale.set(true);
  }
  failPreviewLoad(): void {
    this.previewLoading.set(false);
  }
  reset(): void {
    this.analytics.set(null);
    this.scopeDraft.set(null);
    this.occurrenceSearch.set('');
    this.sourceReportSearch.set('');
    this.selectedOccurrences.set(new Set());
    this.selectedReports.set(new Set());
    this.activeDrawer.set(null);
    this.draftTitle.set('');
    this.draftDescription.set('');
    this.saving.set(false);
    this.saveStatus.set('idle');
    this.lastSavedTime.set(null);
    this.historical.set(null);
    this.versions.set([]);
    this.versionsPage.set(null);
    this.versionPage.set(1);
    this.periodPreview.set(null);
    this.dossierPreview.set(null);
    this.previewLoading.set(false);
    this.previewStale.set(false);
  }
}
