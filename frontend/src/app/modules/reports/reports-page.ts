import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { InlineAlert } from '../../shared/components/list-view/inline-alert/inline-alert';
import { ListPagination } from '../../shared/components/list-view/list-pagination/list-pagination';
import { StatusBadge } from '../../shared/components/list-view/status-badge/status-badge';
import { UiIcon } from '../../shared/components/ui-icon/ui-icon';
import { GovernanceCapabilitiesService, workflowCopy } from '../governance/governance.public-api';
import { ReportPreview as ReportPreviewComponent } from './preview/report-preview/report-preview';
import { ReportEditorStore } from './editor/report-editor.store';
import { ReportExportCoordinator } from './export/report-export.coordinator';
import { ReportListStore } from './catalog/report-list.store';
import { ReportHistoryDrawer } from './catalog/report-history-drawer';
import { ReportPublicationCoordinator } from './publication/report-publication.coordinator';
import { ReportPeriodCloseCoordinator } from './period-close/report-period-close.coordinator';
import { ReportPreviewCoordinator } from './preview/report-preview.coordinator';
import {
  movePeriodCloseSection,
  PeriodCloseScopeField,
  setPeriodCloseSectionEnabled,
  setPeriodCloseSectionTitle,
  togglePeriodCloseAction,
  togglePeriodCloseEvidence,
  updatePeriodCloseEvidenceMetadata,
  updatePeriodCloseScopeField,
  updatePeriodCloseScopeFilter,
} from './period-close/report-period-close.workspace';
import { ReportSourceSelectionCoordinator } from './sources/report-source-selection.coordinator';
import {
  EligibleAction,
  EligibleEvidence,
  EligibleOccurrence,
  ReportDetail,
  ReportAnalytics,
  PeriodClosePreview,
  ReportPreview,
  ReportScope,
  ReportVersion,
} from './reports.models';
import { ReportEditorService } from './editor/report-editor.service';
import { ReportCatalogService } from './catalog/report-catalog.service';
import { ReportCatalog } from './catalog/report-catalog';
import { ReportVersionHistory } from './export/report-version-history';
import { ReportSourceDrawer } from './sources/report-source-drawer';
import { COPY } from './reports.copy';

@Component({
  selector: 'app-reports-page',
  imports: [
    FormsModule,
    InlineAlert,
    ListPagination,
    ReportCatalog,
    ReportVersionHistory,
    ReportSourceDrawer,
    ReportPreviewComponent,
    ReportHistoryDrawer,
    StatusBadge,
    UiIcon,
  ],
  providers: [ReportEditorStore, ReportListStore],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.css',
})
export class ReportsPage implements OnInit {
  private readonly editorStore = inject(ReportEditorStore);
  private readonly listStore = inject(ReportListStore);
  private readonly governanceCapabilities = inject(GovernanceCapabilitiesService);
  readonly workflows = computed(() => workflowCopy[this.language.currentLanguage()]);
  readonly historical = this.editorStore.historical;
  readonly exportsAvailable = this.listStore.exportsAvailable;
  private afterSave: (() => void) | null = null;
  private workspaceLoadToken = 0;
  readonly hasPendingDraft = computed(
    () =>
      !!this.active() &&
      (this.draftTitle().trim() !== this.active()!.title ||
        this.draftDescription().trim() !== this.active()!.description),
  );
  private readonly editor = inject(ReportEditorService);
  private readonly catalog = inject(ReportCatalogService);
  private readonly exportCoordinator = inject(ReportExportCoordinator);
  private readonly publication = inject(ReportPublicationCoordinator);
  private readonly periodClose = inject(ReportPeriodCloseCoordinator);
  private readonly previewCoordinator = inject(ReportPreviewCoordinator);
  private readonly sourceSelection = inject(ReportSourceSelectionCoordinator);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly language = inject(LanguageService);
  readonly c = computed(() => COPY[this.language.currentLanguage()]);
  readonly active = this.editorStore.active;
  readonly draftTitle = this.editorStore.draftTitle;
  readonly draftDescription = this.editorStore.draftDescription;
  readonly saving = this.editorStore.saving;
  readonly workspaceError = this.editorStore.workspaceError;
  readonly eligible = this.editorStore.eligible;
  readonly occurrenceCandidates = this.editorStore.occurrenceCandidates;
  readonly occurrencePage = this.editorStore.occurrencePage;
  readonly sourceReports = this.editorStore.sourceReports;
  readonly sourceReportCandidates = this.editorStore.sourceReportCandidates;
  readonly sourceReportPage = this.editorStore.sourceReportPage;
  readonly occurrenceSearch = this.editorStore.occurrenceSearch;
  readonly sourceReportSearch = this.editorStore.sourceReportSearch;
  readonly selectedOccurrences = this.editorStore.selectedOccurrences;
  readonly selectedReports = this.editorStore.selectedReports;
  readonly preview = this.editorStore.dossierPreview;
  readonly analytics = this.editorStore.analytics;
  readonly periodPreview = this.editorStore.periodPreview;
  readonly scopeDraft = this.editorStore.scopeDraft;
  readonly eligibleActions = this.editorStore.eligibleActions;
  readonly actionSearch = this.editorStore.actionSearch;
  readonly actionCandidates = this.editorStore.actionCandidates;
  readonly actionPage = this.editorStore.actionPage;
  readonly eligibleEvidence = this.editorStore.eligibleEvidence;
  readonly evidenceSearch = this.editorStore.evidenceSearch;
  readonly evidenceCandidates = this.editorStore.evidenceCandidates;
  readonly evidencePage = this.editorStore.evidencePage;
  readonly candidatePageSize = 25;
  readonly previewLoading = this.editorStore.previewLoading;
  readonly previewStale = this.editorStore.previewStale;
  readonly versions = this.editorStore.versions;
  readonly versionsPage = this.editorStore.versionsPage;
  readonly versionPage = this.editorStore.versionPage;

  private readonly draftDebounce = new Subject<void>();
  readonly saveStatus = this.editorStore.saveStatus;
  readonly lastSavedTime = this.editorStore.lastSavedTime;
  readonly activeDrawer = this.editorStore.activeDrawer;
  readonly previewOpen = this.editorStore.previewOpen;

  ngOnInit(): void {
    this.governanceCapabilities
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => this.exportsAvailable.set(c.exports_available),
        error: () => this.exportsAvailable.set(false),
      });
    this.draftDebounce
      .pipe(debounceTime(700), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.saveDraft();
      });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const reportId = params.get('reportId');
      if (reportId) this.openReport(reportId, false);
    });
  }

  openReport(reportId: string, navigate = true, preserveError = false): void {
    const loadToken = ++this.workspaceLoadToken;
    if (!preserveError) this.workspaceError.set(null);
    this.editorStore.beginPreviewLoad();
    if (navigate) this.router.navigate(['/relatorios', reportId]);
    this.catalog
      .get(reportId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          if (loadToken !== this.workspaceLoadToken) return;
          this.active.set(report);
          this.scopeDraft.set(
            report.scope ? { ...report.scope, filters: { ...report.scope.filters } } : null,
          );
          if (!preserveError) {
            this.draftTitle.set(report.title);
            this.draftDescription.set(report.description);
          }
          this.saveStatus.set('saved');
          this.lastSavedTime.set(this.formatTime(new Date(report.updated_at || new Date())));
          this.loadWorkspace(reportId);
          const revision = Number(this.route.snapshot.queryParamMap.get('revision'));
          if (revision > 0) this.viewVersion(reportId, revision);
        },
        error: (error) => {
          if (loadToken !== this.workspaceLoadToken) return;
          this.editorStore.failPreviewLoad(this.message(error));
        },
      });
  }
  closeWorkspace(): void {
    if (
      this.hasUnsavedChanges() &&
      !window.confirm('Existem alterações não salvas. Sair mesmo assim?')
    )
      return;
    this.workspaceLoadToken++;
    this.editorStore.reset();
    this.editorStore.closePreview();
    this.active.set(null);
    this.router.navigate(['/relatorios']);
  }
  private hasUnsavedChanges(): boolean {
    return this.hasPendingDraft() || this.previewStale() || this.saving();
  }
  loadWorkspace(reportId = this.active()?.id): void {
    if (!reportId) return;
    if (this.active()?.report_kind === 'PERIOD_CLOSE') {
      this.loadAnalytics(reportId);
      this.loadActionCandidates();
      this.loadEvidenceCandidates();
    } else {
      this.loadCandidates();
      this.refreshPreview();
    }
    this.publication
      .versions(reportId, { page: this.versionPage(), pageSize: this.candidatePageSize })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.versionsPage.set(page);
          this.versions.set(page.items);
          for (const version of page.items) this.restoreExports(version.id);
        },
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  loadAnalytics(reportId = this.active()?.id): void {
    if (!reportId) return;
    this.editorStore.beginPreviewLoad();
    this.previewCoordinator
      .loadPeriodClose(reportId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          this.editorStore.setPeriodPreview(preview);
        },
        error: (error) => {
          this.editorStore.failPreviewLoad(this.message(error));
        },
      });
  }
  loadActionCandidates(): void {
    const report = this.active();
    if (!report || report.report_kind !== 'PERIOD_CLOSE') return;
    this.periodClose
      .loadActionCandidates(report, {
        page: this.actionPage(),
        pageSize: this.candidatePageSize,
        search: this.actionSearch().trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.actionCandidates.set(page);
          this.eligibleActions.set(page.items);
        },
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  loadEvidenceCandidates(): void {
    const report = this.active();
    if (!report || report.report_kind !== 'PERIOD_CLOSE') return;
    this.periodClose
      .loadEvidenceCandidates(report, {
        page: this.evidencePage(),
        pageSize: this.candidatePageSize,
        search: this.evidenceSearch().trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.evidenceCandidates.set(page);
          this.eligibleEvidence.set(page.items);
        },
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  loadCandidates(): void {
    const report = this.active();
    if (!report) return;
    this.sourceSelection
      .loadCandidates(
        report.id,
        {
          page: this.occurrencePage(),
          pageSize: this.candidatePageSize,
          search: this.occurrenceSearch().trim() || undefined,
        },
        {
          page: this.sourceReportPage(),
          pageSize: this.candidatePageSize,
          search: this.sourceReportSearch().trim() || undefined,
        },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ occurrences, reports }) => {
          this.occurrenceCandidates.set(occurrences);
          this.eligible.set(occurrences.items);
          this.sourceReportCandidates.set(reports);
          this.sourceReports.set(reports.items);
        },
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  toggleSelection(kind: 'occurrence' | 'report', id: string, checked: boolean): void {
    this.editorStore.toggleSourceSelection(kind, id, checked);
  }
  addSelected(kind: 'occurrence' | 'report'): void {
    const ids = [...(kind === 'occurrence' ? this.selectedOccurrences() : this.selectedReports())];
    if (ids.length) this.changeSources(kind, 'add', ids);
  }
  removeSource(kind: 'occurrence' | 'report', id: string): void {
    this.changeSources(kind, 'remove', [id]);
  }
  private changeSources(
    kind: 'occurrence' | 'report',
    operation: 'add' | 'remove',
    ids: string[],
  ): void {
    if (this.saving() || this.hasPendingDraft()) {
      this.afterSave = () => this.changeSources(kind, operation, ids);
      if (!this.saving()) this.saveDraft();
      return;
    }
    const report = this.active();
    if (!report) return;
    this.saving.set(true);
    this.workspaceError.set(null);
    this.sourceSelection
      .mutateSources({
        reportId: report.id,
        kind,
        operation,
        expectedVersion: report.version,
        ids,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.active.set(updated);
          this.saving.set(false);
          this.saveStatus.set('saved');
          this.lastSavedTime.set(this.formatTime(new Date()));
          this.selectedOccurrences.set(new Set());
          this.selectedReports.set(new Set());
          this.loadWorkspace();
        },
        error: (error) => this.handleWorkspaceError(error),
      });
  }
  onTitleChange(value: string): void {
    this.draftTitle.set(value);
    this.editorStore.markPreviewStale();
    this.saveStatus.set('saving');
    this.draftDebounce.next();
  }
  onDescriptionChange(value: string): void {
    this.draftDescription.set(value);
    this.editorStore.markPreviewStale();
    this.saveStatus.set('saving');
    this.draftDebounce.next();
  }
  openDrawer(kind: 'occurrence' | 'report'): void {
    this.activeDrawer.set(kind);
    this.loadCandidates();
  }
  closeDrawer(): void {
    this.activeDrawer.set(null);
  }
  closePreview(): void {
    this.editorStore.closePreview();
  }
  openPreview(): void {
    this.editorStore.openPreview();
  }
  saveDraft(): void {
    const report = this.active();
    if (!report || !this.draftTitle().trim()) return;
    if (this.saving()) return;
    if (!this.hasPendingDraft()) {
      const pending = this.afterSave;
      this.afterSave = null;
      pending?.();
      return;
    }
    this.saving.set(true);
    this.saveStatus.set('saving');
    this.workspaceError.set(null);
    this.editor
      .update({
        reportId: report.id,
        expectedVersion: report.version,
        title: this.draftTitle().trim(),
        description: this.draftDescription().trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.active.set({ ...report, ...updated });
          this.saving.set(false);
          this.saveStatus.set('saved');
          this.lastSavedTime.set(this.formatTime(new Date()));
          if (report.report_kind === 'PERIOD_CLOSE') this.loadAnalytics();
          else this.refreshPreview();
          if (this.hasPendingDraft()) this.saveDraft();
          else {
            const pending = this.afterSave;
            this.afterSave = null;
            pending?.();
          }
        },
        error: (error) => {
          this.saveStatus.set('error');
          this.afterSave = null;
          this.handleWorkspaceError(error);
        },
      });
  }
  refreshPreview(): void {
    const report = this.active();
    if (!report) return;
    this.editorStore.beginPreviewLoad();
    this.previewCoordinator
      .loadDossier(report.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          this.editorStore.setDossierPreview(preview);
        },
        error: (error) => {
          this.editorStore.failPreviewLoad(this.message(error));
        },
      });
  }
  setScopeField(field: PeriodCloseScopeField, value: string | boolean): void {
    this.scopeDraft.update((scope) => updatePeriodCloseScopeField(scope, field, value));
    this.editorStore.markPreviewStale();
  }
  setScopeFilter(field: keyof ReportScope['filters'], value: string): void {
    this.scopeDraft.update((scope) => updatePeriodCloseScopeFilter(scope, field, value));
    this.editorStore.markPreviewStale();
  }
  saveScope(): void {
    const report = this.active();
    const scope = this.scopeDraft();
    if (!report || !scope || this.saving()) return;
    this.saving.set(true);
    this.workspaceError.set(null);
    this.periodClose
      .updateScope(report, scope)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.active.set(updated);
          this.scopeDraft.set(
            updated.scope ? { ...updated.scope, filters: { ...updated.scope.filters } } : null,
          );
          this.saving.set(false);
          this.saveStatus.set('saved');
          this.lastSavedTime.set(this.formatTime(new Date()));
          this.loadAnalytics();
        },
        error: (error) => this.handleWorkspaceError(error),
      });
  }
  toggleSection(sectionId: string | undefined, enabled: boolean): void {
    const report = this.active();
    if (!report || !sectionId || this.saving()) return;
    const sections = setPeriodCloseSectionEnabled(report.sections, sectionId, enabled);
    this.editorStore.markPreviewStale();
    this.saving.set(true);
    this.periodClose
      .replaceSections(report, sections)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.active.set(updated);
          this.saving.set(false);
          this.loadAnalytics();
        },
        error: (error) => this.handleWorkspaceError(error),
      });
  }
  updateSectionTitle(sectionId: string | undefined, title: string): void {
    const report = this.active();
    if (!report || !sectionId || this.saving()) return;
    const sections = setPeriodCloseSectionTitle(report.sections, sectionId, title);
    this.persistSections(sections);
  }
  moveSection(sectionId: string | undefined, direction: -1 | 1): void {
    const report = this.active();
    if (!report || !sectionId || this.saving()) return;
    const sections = movePeriodCloseSection(report.sections, sectionId, direction);
    if (sections === report.sections) return;
    this.persistSections(sections);
  }
  private persistSections(sections: ReportDetail['sections']): void {
    const report = this.active();
    if (!report) return;
    this.editorStore.markPreviewStale();
    this.saving.set(true);
    this.periodClose
      .replaceSections(report, sections)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.active.set(updated);
          this.saving.set(false);
          this.loadAnalytics();
        },
        error: (error) => this.handleWorkspaceError(error),
      });
  }
  toggleAction(actionId: string, selected: boolean): void {
    const report = this.active();
    if (!report || this.saving()) return;
    const ids = togglePeriodCloseAction(report.action_source_ids, actionId, selected);
    this.editorStore.markPreviewStale();
    this.saving.set(true);
    this.periodClose
      .replaceActionSources(report, ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.active.set(updated);
          this.saving.set(false);
          this.loadAnalytics();
        },
        error: (error) => this.handleWorkspaceError(error),
      });
  }
  toggleEvidence(candidate: EligibleEvidence, selected: boolean): void {
    const report = this.active();
    if (!report || this.saving()) return;
    const selectedSources = togglePeriodCloseEvidence(report, candidate, selected);
    if (!selectedSources) {
      this.workspaceError.set('Adicione uma seção de evidências antes de selecionar imagens.');
      return;
    }
    this.editorStore.markPreviewStale();
    this.saving.set(true);
    this.periodClose
      .replaceEvidenceSources(report, selectedSources)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.active.set(updated);
          this.saving.set(false);
          this.loadAnalytics();
        },
        error: (error) => this.handleWorkspaceError(error),
      });
  }
  isEvidenceSelected(attachmentId: string): boolean {
    return !!this.active()?.evidence_sources.some(
      (source) => source.review_attachment_id === attachmentId,
    );
  }
  updateEvidenceMetadata(
    sourceId: string,
    field: 'caption' | 'role' | 'captured_at',
    value: string,
  ): void {
    const report = this.active();
    if (!report || this.saving()) return;
    const evidence = updatePeriodCloseEvidenceMetadata(
      report.evidence_sources,
      sourceId,
      field,
      value,
    );
    this.active.set({ ...report, evidence_sources: evidence });
    this.editorStore.markPreviewStale();
    this.saving.set(true);
    this.periodClose
      .replaceEvidenceSources(
        report,
        evidence.map((source) => ({
          section_key: source.section_key,
          review_attachment_id: source.review_attachment_id,
          published_evidence_id: source.published_evidence_id,
          caption: source.caption,
          role: source.role,
          captured_at: source.captured_at,
        })),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.active.set(updated);
          this.saving.set(false);
          this.loadAnalytics();
        },
        error: (error) => this.handleWorkspaceError(error),
      });
  }
  previousActionPage(): void {
    if (this.actionPage() <= 1) return;
    this.actionPage.update((page) => page - 1);
    this.loadActionCandidates();
  }
  nextActionPage(): void {
    if (!this.actionCandidates()?.has_next) return;
    this.actionPage.update((page) => page + 1);
    this.loadActionCandidates();
  }
  previousEvidencePage(): void {
    if (this.evidencePage() <= 1) return;
    this.evidencePage.update((page) => page - 1);
    this.loadEvidenceCandidates();
  }
  nextEvidencePage(): void {
    if (!this.evidenceCandidates()?.has_next) return;
    this.evidencePage.update((page) => page + 1);
    this.loadEvidenceCandidates();
  }
  publish(): void {
    const report = this.active();
    if (!report || !window.confirm(this.c().publishConfirm)) return;
    if (this.saving() || this.hasPendingDraft()) {
      this.afterSave = () => this.publishSaved();
      if (!this.saving()) this.saveDraft();
      return;
    }
    this.publishSaved();
  }
  private publishSaved(): void {
    const report = this.active();
    if (!report) return;
    this.saving.set(true);
    this.publication
      .publish(report)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.openReport(report.id, false);
        },
        error: (error) => this.handleWorkspaceError(error),
      });
  }
  viewVersion(reportId: string, revision: number): void {
    this.publication
      .version(reportId, revision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (v) => this.historical.set(v),
        error: (e) => this.workspaceError.set(this.message(e)),
      });
  }
  private restoreExports(versionId: string): void {
    this.exportCoordinator
      .restoreAndPoll(versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (job) => {
          this.editorStore.setExportJob(versionId, job);
        },
        error: (e) => this.workspaceError.set(this.message(e)),
      });
  }
  formatDate(value: string | null | undefined): string {
    return value
      ? new Intl.DateTimeFormat(this.locale(), {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(new Date(value))
      : '—';
  }
  formatCurrency(value: string, currency: 'BRL' | 'USD'): string {
    return new Intl.NumberFormat(this.locale(), { style: 'currency', currency }).format(
      Number(value),
    );
  }
  lineageCount(occurrenceId: string): number {
    return this.preview()?.lineage[occurrenceId]?.length ?? 0;
  }
  private locale(): string {
    return this.language.currentLanguage() === 'pt'
      ? 'pt-BR'
      : this.language.currentLanguage() === 'ko'
        ? 'ko-KR'
        : 'en-US';
  }
  private message(error: {
    status?: number;
    error?: { detail?: string };
    message?: string;
  }): string {
    return error.error?.detail || error.message || this.c().genericError;
  }
  private handleWorkspaceError(error: {
    status?: number;
    error?: { detail?: string };
    message?: string;
  }): void {
    this.saving.set(false);
    if (error.status === 409 && this.active()) {
      this.workspaceError.set(this.c().conflict);
      this.openReport(this.active()!.id, false, true);
    } else this.workspaceError.set(this.message(error));
  }
  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.activeDrawer()) {
        this.closeDrawer();
      } else if (this.previewOpen()) {
        this.closePreview();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      if (this.active()) {
        event.preventDefault();
        this.saveDraft();
      }
    }
  }
  @HostListener('window:beforeunload', ['$event'])
  protectBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }
  formatTime(date: Date): string {
    return new Intl.DateTimeFormat(this.locale(), {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}
