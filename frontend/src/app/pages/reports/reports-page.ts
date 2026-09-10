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
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeWhile, timer } from 'rxjs';
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
import {
  EligibleOccurrence,
  ExportFormat,
  ExportJob,
  ExportOptions,
  Page,
  ReportDetail,
  ReportListItem,
  ReportPreview,
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
    StatusBadge,
    UiIcon,
  ],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.css',
})
export class ReportsPage implements OnInit {
  private readonly governance = inject(GovernanceService);
  readonly workflows = computed(() => workflowCopy[this.language.currentLanguage()]);
  readonly historical = signal<ReportVersion | null>(null);
  readonly exportsAvailable = signal(false);
  readonly options = signal<ExportOptions>({
    language: 'pt',
    include_money: true,
    include_summary: true,
    include_occurrences: true,
    include_justifications: true,
    include_evidence: true,
    notify_on_completion: false,
  });
  private afterSave: (() => void) | null = null;
  readonly hasPendingDraft = computed(
    () =>
      !!this.active() &&
      (this.draftTitle().trim() !== this.active()!.title ||
        this.draftDescription().trim() !== this.active()!.description),
  );
  private readonly service = inject(ReportsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();
  readonly language = inject(LanguageService);
  readonly c = computed(() => COPY[this.language.currentLanguage()]);
  readonly pageSizes = PAGE_SIZES;
  readonly reports = signal<Page<ReportListItem> | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal<(typeof PAGE_SIZES)[number]>(25);
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly filterOpen = signal(false);
  readonly activeFiltersCount = computed(
    () => [this.search().trim(), this.statusFilter()].filter(Boolean).length,
  );
  readonly statusOptions = computed(() => [
    { value: '', label: this.c().all },
    { value: 'DRAFT', label: this.c().draft },
    { value: 'PUBLISHED', label: this.c().published },
  ]);
  readonly showCreate = signal(false);
  readonly createTitle = signal('');
  readonly createDescription = signal('');
  readonly creating = signal(false);
  readonly active = signal<ReportDetail | null>(null);
  readonly draftTitle = signal('');
  readonly draftDescription = signal('');
  readonly saving = signal(false);
  readonly workspaceError = signal<string | null>(null);
  readonly eligible = signal<EligibleOccurrence[]>([]);
  readonly sourceReports = signal<ReportListItem[]>([]);
  readonly occurrenceSearch = signal('');
  readonly sourceReportSearch = signal('');
  readonly selectedOccurrences = signal(new Set<string>());
  readonly selectedReports = signal(new Set<string>());
  readonly preview = signal<ReportPreview | null>(null);
  readonly previewLoading = signal(false);
  readonly versions = signal<ReportVersion[]>([]);
  readonly exportJobs = signal<Record<string, ExportJob>>({});

  private readonly draftDebounce = new Subject<void>();
  readonly saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly lastSavedTime = signal<string | null>(null);
  readonly activeDrawer = signal<'occurrence' | 'report' | null>(null);

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
    this.service
      .create(this.createTitle().trim(), this.createDescription().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.creating.set(false);
          this.showCreate.set(false);
          this.createTitle.set('');
          this.createDescription.set('');
          this.openReport(report.id);
        },
        error: (error) => {
          this.creating.set(false);
          this.error.set(this.message(error));
        },
      });
  }
  openReport(reportId: string, navigate = true, preserveError = false): void {
    if (!preserveError) this.workspaceError.set(null);
    this.previewLoading.set(true);
    if (navigate) this.router.navigate(['/relatorios', reportId]);
    this.service
      .get(reportId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.active.set(report);
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
          this.workspaceError.set(this.message(error));
          this.previewLoading.set(false);
        },
      });
  }
  closeWorkspace(): void {
    this.active.set(null);
    this.router.navigate(['/relatorios']);
    this.loadReports();
  }
  loadWorkspace(reportId = this.active()?.id): void {
    if (!reportId) return;
    this.loadCandidates();
    this.refreshPreview();
    this.service
      .versions(reportId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.versions.set(page.items);
          for (const version of page.items) this.restoreExports(version.id);
        },
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  loadCandidates(): void {
    const report = this.active();
    if (!report) return;
    this.service
      .eligibleOccurrences(this.occurrenceSearch())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.eligible.set(page.items),
        error: (error) => this.workspaceError.set(this.message(error)),
      });
    this.service
      .sourceReports(report.id, this.sourceReportSearch())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.sourceReports.set(page.items),
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  toggleSelection(kind: 'occurrence' | 'report', id: string, checked: boolean): void {
    const target = kind === 'occurrence' ? this.selectedOccurrences : this.selectedReports;
    target.update((current) => {
      const next = new Set(current);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
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
    this.service
      .mutateSources(report.id, kind, operation, report.version, ids)
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
    this.saveStatus.set('saving');
    this.draftDebounce.next();
  }
  onDescriptionChange(value: string): void {
    this.draftDescription.set(value);
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
  onDrawerSearch(kind: 'occurrence' | 'report', value: string): void {
    if (kind === 'occurrence') {
      this.occurrenceSearch.set(value);
    } else {
      this.sourceReportSearch.set(value);
    }
    this.loadCandidates();
  }
  selectAllDrawer(kind: 'occurrence' | 'report'): void {
    const report = this.active();
    if (!report) return;
    if (kind === 'occurrence') {
      const available = this.eligible()
        .filter((item) => !report.occurrence_source_ids.includes(item.id))
        .map((item) => item.id);
      this.selectedOccurrences.set(new Set(available));
    } else {
      const available = this.sourceReports()
        .filter((item) => !report.report_source_ids.includes(item.id))
        .map((item) => item.id);
      this.selectedReports.set(new Set(available));
    }
  }
  clearDrawerSelection(kind: 'occurrence' | 'report'): void {
    if (kind === 'occurrence') {
      this.selectedOccurrences.set(new Set());
    } else {
      this.selectedReports.set(new Set());
    }
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
      .update(report.id, report.version, this.draftTitle().trim(), this.draftDescription().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.active.set({ ...report, ...updated });
          this.saving.set(false);
          this.saveStatus.set('saved');
          this.lastSavedTime.set(this.formatTime(new Date()));
          this.refreshPreview();
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
    this.previewLoading.set(true);
    this.service
      .preview(report.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          this.preview.set(preview);
          this.previewLoading.set(false);
        },
        error: (error) => {
          this.workspaceError.set(this.message(error));
          this.previewLoading.set(false);
        },
      });
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
    this.service
      .publish(report.id, report.version)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.openReport(report.id, false);
        },
        error: (error) => this.handleWorkspaceError(error),
      });
  }
  export(version: ReportVersion, format: ExportFormat): void {
    const key = `${version.id}:${format}`;
    if (['QUEUED', 'RUNNING'].includes(this.exportJobs()[key]?.status)) return;
    this.service
      .requestExport(
        version.id,
        format,
        { ...this.options(), language: this.language.currentLanguage() },
        this.exportJobs()[key]?.status === 'FAILED',
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (job) => {
          this.setJob(key, job);
          this.pollExport(key, job.id);
        },
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  setOption(key: keyof ExportOptions, value: boolean): void {
    this.options.update((o) => ({ ...o, [key]: value }));
  }
  viewVersion(reportId: string, revision: number): void {
    this.service
      .version(reportId, revision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (v) => this.historical.set(v),
        error: (e) => this.workspaceError.set(this.message(e)),
      });
  }
  createPlan(version: ReportVersion): void {
    this.governance
      .savePlan({
        title: this.active()?.title || 'Report',
        description: this.active()?.description || '',
        report_version_ids: [version.id],
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => this.router.navigate(['/planos-de-acao', p.id]),
        error: (e) => this.workspaceError.set(this.message(e)),
      });
  }
  private restoreExports(versionId: string): void {
    this.service
      .exportHistory(versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          for (const job of [...page.items].reverse()) {
            const key = `${versionId}:${job.format}`;
            this.setJob(key, job);
            if (job.status === 'QUEUED' || job.status === 'RUNNING') this.pollExport(key, job.id);
          }
        },
        error: (e) => this.workspaceError.set(this.message(e)),
      });
  }
  private pollExport(key: string, jobId: string): void {
    timer(0, 1500)
      .pipe(
        switchMap(() => this.service.exportStatus(jobId)),
        takeWhile((job) => job.status === 'QUEUED' || job.status === 'RUNNING', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (job) => this.setJob(key, job),
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  download(job: ExportJob): void {
    if (!job.artifact) return;
    this.service
      .download(job.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = job.artifact?.filename ?? 'report';
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (error) => this.workspaceError.set(this.message(error)),
      });
  }
  job(versionId: string, format: ExportFormat): ExportJob | undefined {
    return this.exportJobs()[`${versionId}:${format}`];
  }
  formatDate(value: string | null | undefined): string {
    return value
      ? new Intl.DateTimeFormat(this.locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(value),
        )
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
  private setJob(key: string, job: ExportJob): void {
    this.exportJobs.update((jobs) => ({ ...jobs, [key]: job }));
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
  formatTime(date: Date): string {
    return new Intl.DateTimeFormat(this.locale(), {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}
