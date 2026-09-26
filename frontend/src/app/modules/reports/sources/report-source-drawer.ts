import { Component, computed, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../core/i18n/language.service';
import { ListPagination } from '../../../shared/components/list-view/list-pagination/list-pagination';
import { UiIcon } from '../../../shared/components/ui-icon/ui-icon';
import { ReportEditorStore } from '../editor/report-editor.store';
import { COPY } from '../reports.copy';

type SourceKind = 'occurrence' | 'report';

@Component({
  selector: 'app-report-source-drawer',
  imports: [FormsModule, ListPagination, UiIcon],
  templateUrl: './report-source-drawer.html',
  styleUrl: './report-source-drawer.css',
})
export class ReportSourceDrawer {
  private readonly store = inject(ReportEditorStore);
  private readonly language = inject(LanguageService);

  readonly resultsRequested = output<void>();
  readonly selected = output<SourceKind>();
  readonly c = computed(() => COPY[this.language.currentLanguage()]);
  readonly active = this.store.active;
  readonly activeDrawer = this.store.activeDrawer;
  readonly occurrenceSearch = this.store.occurrenceSearch;
  readonly sourceReportSearch = this.store.sourceReportSearch;
  readonly selectedOccurrences = this.store.selectedOccurrences;
  readonly selectedReports = this.store.selectedReports;
  readonly eligible = this.store.eligible;
  readonly sourceReports = this.store.sourceReports;
  readonly occurrenceCandidates = this.store.occurrenceCandidates;
  readonly sourceReportCandidates = this.store.sourceReportCandidates;
  readonly occurrencePage = this.store.occurrencePage;
  readonly sourceReportPage = this.store.sourceReportPage;
  readonly saving = this.store.saving;
  readonly candidatePageSize = 25;

  closeDrawer(): void {
    this.activeDrawer.set(null);
  }

  onDrawerSearch(kind: SourceKind, value: string): void {
    if (kind === 'occurrence') {
      this.occurrenceSearch.set(value);
      this.occurrencePage.set(1);
    } else {
      this.sourceReportSearch.set(value);
      this.sourceReportPage.set(1);
    }
    this.resultsRequested.emit();
  }

  toggleSelection(kind: SourceKind, id: string, checked: boolean): void {
    this.store.toggleSourceSelection(kind, id, checked);
  }

  selectAllDrawer(kind: SourceKind): void {
    this.store.selectAllAvailableSources(kind);
  }

  clearDrawerSelection(kind: SourceKind): void {
    this.store.clearSourceSelection(kind);
  }

  addSelectedFromDrawer(kind: SourceKind): void {
    this.selected.emit(kind);
    this.closeDrawer();
  }

  previousOccurrencePage(): void {
    if (this.occurrencePage() <= 1) return;
    this.occurrencePage.update((page) => page - 1);
    this.resultsRequested.emit();
  }

  nextOccurrencePage(): void {
    if (!this.occurrenceCandidates()?.has_next) return;
    this.occurrencePage.update((page) => page + 1);
    this.resultsRequested.emit();
  }

  previousSourceReportPage(): void {
    if (this.sourceReportPage() <= 1) return;
    this.sourceReportPage.update((page) => page - 1);
    this.resultsRequested.emit();
  }

  nextSourceReportPage(): void {
    if (!this.sourceReportCandidates()?.has_next) return;
    this.sourceReportPage.update((page) => page + 1);
    this.resultsRequested.emit();
  }

  formatCurrency(value: string, currency: 'BRL' | 'USD'): string {
    const code = this.language.currentLanguage();
    const locale = code === 'pt' ? 'pt-BR' : code === 'ko' ? 'ko-KR' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value));
  }
}
