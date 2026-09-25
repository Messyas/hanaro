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
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { LanguageService } from '../../i18n/language.service';
import { ListFilterInput } from '../../shared/list-filters/list-filter-input';
import { ListFilterPopover } from '../../shared/list-filters/list-filter-popover';
import { ListFilterSelect } from '../../shared/list-filters/list-filter-select';
import { DelayedProgressSpinner } from '../../shared/list-view/delayed-progress-spinner/delayed-progress-spinner';
import { InlineAlert } from '../../shared/list-view/inline-alert/inline-alert';
import { ListFeedback } from '../../shared/list-view/list-feedback/list-feedback';
import { ListPagination } from '../../shared/list-view/list-pagination/list-pagination';
import { ListPanel } from '../../shared/list-view/list-panel/list-panel';
import { StatusBadge } from '../../shared/list-view/status-badge/status-badge';
import { UiIcon } from '../../ui-icon';
import { GovernanceService } from '../governance.service';
import { workflowCopy } from '../governance-copy';
import { ReportPreview as ReportPreviewComponent } from './report-preview/report-preview';
import { ReportEditorStore } from './report-editor.store';
import { ReportExportCoordinator } from './report-export.coordinator';
import { ReportListStore } from './report-list.store';
import { ReportHistoryDrawer } from './report-history-drawer';
import { ReportPublicationCoordinator } from './report-publication.coordinator';
import { ReportPeriodCloseCoordinator } from './report-period-close.coordinator';
import { ReportPreviewCoordinator } from './report-preview.coordinator';
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
} from './report-period-close.workspace';
import { ReportSourceSelectionCoordinator } from './report-source-selection.coordinator';
import {
  EligibleAction,
  EligibleEvidence,
  EligibleOccurrence,
  ExportFormat,
  ExportJob,
  ExportOptions,
  Page,
  ReportDetail,
  ReportAnalytics,
  ReportListItem,
  PeriodClosePreview,
  ReportPreview,
  ReportScope,
  ReportVersion,
} from './reports.models';
import { ReportsService } from './reports.service';

const PAGE_SIZES = [25, 50, 100] as const;
const COPY = {
  pt: {
    title: 'Relatórios de Scrap',
    subtitle: 'Componha, publique e exporte análises rastreáveis.',
    create: 'Novo relatório',
    search: 'Buscar por título ou código',
    all: 'Todos os status',
    draft: 'Rascunho',
    published: 'Publicado',
    empty: 'Nenhum relatório encontrado.',
    loading: 'Carregando relatórios',
    code: 'Código',
    report: 'Relatório',
    author: 'Autor',
    occurrences: 'Ocorrências',
    updated: 'Atualizado',
    publication: 'Última publicação',
    actions: 'Ações',
    edit: 'Editar',
    previous: 'Anterior',
    next: 'Próxima',
    newTitle: 'Criar relatório',
    reportTitle: 'Título',
    description: 'Descrição',
    cancel: 'Cancelar',
    continue: 'Criar e continuar',
    back: 'Voltar à lista',
    save: 'Salvar rascunho',
    saving: 'Salvando…',
    sources: 'Fontes do rascunho',
    occurrenceSource: 'Ocorrências revisadas',
    reportSource: 'Relatórios publicados',
    findOccurrence: 'Buscar item ou descrição',
    findReport: 'Buscar relatório publicado',
    addSelected: 'Adicionar selecionados',
    selected: 'selecionados',
    direct: 'Diretas',
    inherited: 'Relatórios fonte',
    remove: 'Remover',
    preview: 'Prévia consolidada',
    refresh: 'Atualizar prévia',
    totalBrl: 'Valor BRL',
    totalUsd: 'Valor USD',
    publish: 'Publicar nova revisão',
    publishConfirm: 'Publicar uma versão imutável deste rascunho?',
    history: 'Histórico de versões',
    revision: 'Revisão',
    publishedAt: 'Publicada em',
    export: 'Exportar',
    preparing: 'Processando',
    download: 'Baixar',
    noSources: 'Adicione ocorrências revisadas ou relatórios publicados para formar a prévia.',
    conflict:
      'O rascunho foi alterado em outra sessão. Recarregamos a versão atual; revise antes de salvar novamente.',
    genericError: 'Não foi possível concluir a operação. Tente novamente.',
    close: 'Fechar',
    liveDraft: 'Prévia dinâmica',
    lineage: 'rotas de origem',
    archive: 'Arquivado',
    status: 'Status',
    requiredTitle: 'Informe um título.',
    savedAt: 'Salvo às',
    allSaved: 'Todas as alterações salvas',
    retrySave: 'Tentar salvar novamente',
    addOccurrences: 'Adicionar ocorrências',
    addReports: 'Vincular relatórios',
    noOccurrencesSelected: 'Nenhuma ocorrência direta vinculada a este rascunho.',
    noReportsSelected: 'Nenhum relatório publicado vinculado a este rascunho.',
    drawerOccurrencesTitle: 'Adicionar Ocorrências Revisadas',
    drawerReportsTitle: 'Vincular Relatórios Publicados',
    selectAll: 'Selecionar visíveis',
    clearSelection: 'Limpar seleção',
    added: 'Adicionado',
    filters: 'Filtros',
    filterTitle: 'Filtrar relatórios',
    clearFilters: 'Limpar filtros',
    applyFilters: 'Aplicar filtros',
  },
  en: {
    title: 'Scrap Reports',
    subtitle: 'Compose, publish, and export traceable analyses.',
    create: 'New report',
    search: 'Search by title or code',
    all: 'All statuses',
    draft: 'Draft',
    published: 'Published',
    empty: 'No reports found.',
    loading: 'Loading reports',
    code: 'Code',
    report: 'Report',
    author: 'Author',
    occurrences: 'Occurrences',
    updated: 'Updated',
    publication: 'Latest publication',
    actions: 'Actions',
    edit: 'Edit',
    previous: 'Previous',
    next: 'Next',
    newTitle: 'Create report',
    reportTitle: 'Title',
    description: 'Description',
    cancel: 'Cancel',
    continue: 'Create and continue',
    back: 'Back to list',
    save: 'Save draft',
    saving: 'Saving…',
    sources: 'Draft sources',
    occurrenceSource: 'Reviewed occurrences',
    reportSource: 'Published reports',
    findOccurrence: 'Search item or description',
    findReport: 'Search published report',
    addSelected: 'Add selected',
    selected: 'selected',
    direct: 'Direct',
    inherited: 'Source reports',
    remove: 'Remove',
    preview: 'Consolidated preview',
    refresh: 'Refresh preview',
    totalBrl: 'BRL amount',
    totalUsd: 'USD amount',
    publish: 'Publish new revision',
    publishConfirm: 'Publish an immutable version of this draft?',
    history: 'Version history',
    revision: 'Revision',
    publishedAt: 'Published at',
    export: 'Export',
    preparing: 'Processing',
    download: 'Download',
    noSources: 'Add reviewed occurrences or published reports to build the preview.',
    conflict:
      'This draft changed in another session. We reloaded the current version; review it before saving again.',
    genericError: 'The operation could not be completed. Try again.',
    close: 'Close',
    liveDraft: 'Live preview',
    lineage: 'source paths',
    archive: 'Archived',
    status: 'Status',
    requiredTitle: 'Enter a title.',
    savedAt: 'Saved at',
    allSaved: 'All changes saved',
    retrySave: 'Retry saving',
    addOccurrences: 'Add occurrences',
    addReports: 'Link reports',
    noOccurrencesSelected: 'No direct occurrences linked to this draft yet.',
    noReportsSelected: 'No published reports linked to this draft yet.',
    drawerOccurrencesTitle: 'Add Reviewed Occurrences',
    drawerReportsTitle: 'Link Published Reports',
    selectAll: 'Select visible',
    clearSelection: 'Clear selection',
    added: 'Added',
    filters: 'Filters',
    filterTitle: 'Filter reports',
    clearFilters: 'Clear filters',
    applyFilters: 'Apply filters',
  },
  ko: {
    title: '스크랩 보고서',
    subtitle: '추적 가능한 분석을 구성하고 게시 및 내보냅니다.',
    create: '새 보고서',
    search: '제목 또는 코드 검색',
    all: '모든 상태',
    draft: '초안',
    published: '게시됨',
    empty: '보고서가 없습니다.',
    loading: '보고서 로드 중',
    code: '코드',
    report: '보고서',
    author: '작성자',
    occurrences: '발생 건',
    updated: '업데이트',
    publication: '최근 게시',
    actions: '작업',
    edit: '편집',
    previous: '이전',
    next: '다음',
    newTitle: '보고서 만들기',
    reportTitle: '제목',
    description: '설명',
    cancel: '취소',
    continue: '만들고 계속',
    back: '목록으로',
    save: '초안 저장',
    saving: '저장 중…',
    sources: '초안 소스',
    occurrenceSource: '검토된 발생 건',
    reportSource: '게시된 보고서',
    findOccurrence: '품목 또는 설명 검색',
    findReport: '게시된 보고서 검색',
    addSelected: '선택 항목 추가',
    selected: '개 선택',
    direct: '직접',
    inherited: '소스 보고서',
    remove: '제거',
    preview: '통합 미리보기',
    refresh: '미리보기 새로고침',
    totalBrl: 'BRL 금액',
    totalUsd: 'USD 금액',
    publish: '새 개정 게시',
    publishConfirm: '이 초안의 변경 불가능한 버전을 게시하시겠습니까?',
    history: '버전 기록',
    revision: '개정',
    publishedAt: '게시일',
    export: '내보내기',
    preparing: '처리 중',
    download: '다운로드',
    noSources: '미리보기를 만들려면 검토된 발생 건 또는 게시된 보고서를 추가하세요.',
    conflict: '다른 세션에서 초안이 변경되었습니다. 현재 버전을 다시 불러왔습니다.',
    genericError: '작업을 완료할 수 없습니다. 다시 시도하세요.',
    close: '닫기',
    liveDraft: '동적 미리보기',
    lineage: '소스 경로',
    archive: '보관됨',
    status: '상태',
    requiredTitle: '제목을 입력하세요.',
    savedAt: '저장됨: ',
    allSaved: '모든 변경사항 저장됨',
    retrySave: '다시 저장',
    addOccurrences: '발생 내역 추가',
    addReports: '보고서 연결',
    noOccurrencesSelected: '이 초안에 연결된 직접 발생 내역이 없습니다.',
    noReportsSelected: '이 초안에 연결된 게시된 보고서가 없습니다.',
    drawerOccurrencesTitle: '검토된 발생 내역 추가',
    drawerReportsTitle: '게시된 보고서 연결',
    selectAll: '표시된 항목 선택',
    clearSelection: '선택 해제',
    added: '추가됨',
    filters: '필터',
    filterTitle: '보고서 필터',
    clearFilters: '필터 지우기',
    applyFilters: '필터 적용',
  },
} as const;

@Component({
  selector: 'app-reports-page',
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
  private readonly governance = inject(GovernanceService);
  readonly workflows = computed(() => workflowCopy[this.language.currentLanguage()]);
  readonly historical = this.editorStore.historical;
  readonly exportsAvailable = this.listStore.exportsAvailable;
  readonly exportOptionsByVersion = this.editorStore.exportOptionsByVersion;
  readonly exportFormats = this.editorStore.exportFormats;
  private afterSave: (() => void) | null = null;
  private workspaceLoadToken = 0;
  readonly hasPendingDraft = computed(
    () =>
      !!this.active() &&
      (this.draftTitle().trim() !== this.active()!.title ||
        this.draftDescription().trim() !== this.active()!.description),
  );
  private readonly service = inject(ReportsService);
  private readonly exportCoordinator = inject(ReportExportCoordinator);
  private readonly publication = inject(ReportPublicationCoordinator);
  private readonly periodClose = inject(ReportPeriodCloseCoordinator);
  private readonly previewCoordinator = inject(ReportPreviewCoordinator);
  private readonly sourceSelection = inject(ReportSourceSelectionCoordinator);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();
  readonly language = inject(LanguageService);
  readonly c = computed(() => COPY[this.language.currentLanguage()]);
  readonly pageSizes = PAGE_SIZES;
  readonly reports = this.listStore.reports;
  readonly loading = this.listStore.loading;
  readonly error = this.listStore.error;
  readonly page = this.listStore.page;
  readonly pageSize = this.listStore.pageSize;
  readonly search = this.listStore.search;
  readonly statusFilter = this.listStore.statusFilter;
  readonly filterOpen = this.listStore.filterOpen;
  readonly activeFiltersCount = computed(
    () => [this.search().trim(), this.statusFilter()].filter(Boolean).length,
  );
  readonly statusOptions = computed(() => [
    { value: '', label: this.c().all },
    { value: 'DRAFT', label: this.c().draft },
    { value: 'PUBLISHED', label: this.c().published },
  ]);
  readonly showCreate = this.listStore.showCreate;
  readonly createTitle = this.listStore.createTitle;
  readonly createDescription = this.listStore.createDescription;
  readonly createKind = this.listStore.createKind;
  readonly createPeriodFrom = this.listStore.createPeriodFrom;
  readonly createPeriodTo = this.listStore.createPeriodTo;
  readonly creating = this.listStore.creating;
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
  readonly exportJobs = this.editorStore.exportJobs;
  readonly exportFormatOptions = this.editorStore.exportFormatOptions;

  private readonly draftDebounce = new Subject<void>();
  readonly saveStatus = this.editorStore.saveStatus;
  readonly lastSavedTime = this.editorStore.lastSavedTime;
  readonly activeDrawer = this.editorStore.activeDrawer;
  readonly previewOpen = this.editorStore.previewOpen;

  ngOnInit(): void {
    this.governance
      .capabilities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => this.exportsAvailable.set(c.exports_available),
        error: () => this.exportsAvailable.set(false),
      });
    this.searchChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.loadReports();
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
    this.loadReports();
  }

  loadReports(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
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
    this.service
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
  openReport(reportId: string, navigate = true, preserveError = false): void {
    const loadToken = ++this.workspaceLoadToken;
    if (!preserveError) this.workspaceError.set(null);
    this.editorStore.beginPreviewLoad();
    if (navigate) this.router.navigate(['/relatorios', reportId]);
    this.service
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
    this.loadReports();
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
  onDrawerSearch(kind: 'occurrence' | 'report', value: string): void {
    if (kind === 'occurrence') {
      this.occurrenceSearch.set(value);
      this.occurrencePage.set(1);
    } else {
      this.sourceReportSearch.set(value);
      this.sourceReportPage.set(1);
    }
    this.loadCandidates();
  }
  selectAllDrawer(kind: 'occurrence' | 'report'): void {
    this.editorStore.selectAllAvailableSources(kind);
  }
  clearDrawerSelection(kind: 'occurrence' | 'report'): void {
    this.editorStore.clearSourceSelection(kind);
  }
  addSelectedFromDrawer(kind: 'occurrence' | 'report'): void {
    this.addSelected(kind);
    this.closeDrawer();
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
    this.service
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
  previousOccurrencePage(): void {
    if (this.occurrencePage() <= 1) return;
    this.occurrencePage.update((page) => page - 1);
    this.loadCandidates();
  }
  nextOccurrencePage(): void {
    if (!this.occurrenceCandidates()?.has_next) return;
    this.occurrencePage.update((page) => page + 1);
    this.loadCandidates();
  }
  previousSourceReportPage(): void {
    if (this.sourceReportPage() <= 1) return;
    this.sourceReportPage.update((page) => page - 1);
    this.loadCandidates();
  }
  nextSourceReportPage(): void {
    if (!this.sourceReportCandidates()?.has_next) return;
    this.sourceReportPage.update((page) => page + 1);
    this.loadCandidates();
  }
  previousVersionPage(): void {
    if (this.editorStore.previousVersionPage()) this.loadWorkspace();
  }
  nextVersionPage(): void {
    if (this.editorStore.nextVersionPage()) this.loadWorkspace();
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
  export(
    version: ReportVersion,
    format: ExportFormat,
    options = this.exportOptionsFor(version.id),
  ): void {
    const key = `${version.id}:${format}`;
    if (['QUEUED', 'RUNNING'].includes(this.exportJobs()[key]?.status)) return;
    this.exportCoordinator
      .request(version, format, options, this.exportJobs()[key])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (job) => {
          this.editorStore.setExportJob(version.id, job);
          this.exportCoordinator
            .poll(job.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (updated) => this.editorStore.setExportJob(version.id, updated),
              error: (pollError) => this.workspaceError.set(this.message(pollError)),
            });
        },
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  exportOptionsFor(versionId: string): ExportOptions {
    return this.editorStore.exportOptionsFor(versionId, this.language.currentLanguage());
  }
  setVersionExportOption(
    versionId: string,
    key: Exclude<keyof ExportOptions, 'language'>,
    value: boolean,
  ): void {
    this.editorStore.setExportOption(versionId, key, value, this.language.currentLanguage());
  }
  exportFormatFor(versionId: string): ExportFormat {
    return this.editorStore.exportFormatFor(versionId);
  }
  setVersionExportFormat(versionId: string, format: ExportFormat): void {
    this.editorStore.setExportFormat(versionId, format);
  }
  emitVersionExport(version: ReportVersion): void {
    const format = this.exportFormatFor(version.id);
    const exportJob = this.job(version.id, format);
    if (exportJob?.status === 'COMPLETED') {
      this.download(exportJob);
      return;
    }
    this.export(version, format, this.exportOptionsFor(version.id));
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
  download(job: ExportJob): void {
    if (!job.artifact) return;
    this.exportCoordinator
      .download(job)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  job(versionId: string, format: ExportFormat): ExportJob | undefined {
    return this.editorStore.exportJob(versionId, format);
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
  versionTitle(version: ReportVersion): string {
    if (version.content_schema_version >= 2) {
      return version.content.document?.report.title || this.active()?.title || this.c().title;
    }
    const legacyReport = version.content['report'] as { title?: string } | undefined;
    return legacyReport?.title || this.active()?.title || this.c().title;
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
      } else if (this.showCreate()) {
        this.showCreate.set(false);
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
