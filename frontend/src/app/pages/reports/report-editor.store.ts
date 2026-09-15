import { Injectable, computed, signal } from '@angular/core';
import { PeriodClosePreview, ReportPreview } from './reports.models';

@Injectable()
export class ReportEditorStore {
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
    this.periodPreview.set(null);
    this.dossierPreview.set(null);
    this.previewLoading.set(false);
    this.previewStale.set(false);
  }
}
