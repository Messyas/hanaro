import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LanguageService } from '../../core/i18n/language.service';
import { ListFilterDateRange } from '../../shared/components/list-filters/list-filter-date-range';
import { ListFilterInput } from '../../shared/components/list-filters/list-filter-input';
import { ListFilterPopover } from '../../shared/components/list-filters/list-filter-popover';
import {
  ListFilterSelect,
  ListFilterSelectOption,
} from '../../shared/components/list-filters/list-filter-select';
import { DelayedProgressSpinner } from '../../shared/components/list-view/delayed-progress-spinner/delayed-progress-spinner';
import { InlineAlert } from '../../shared/components/list-view/inline-alert/inline-alert';
import { ListFeedback } from '../../shared/components/list-view/list-feedback/list-feedback';
import { ListPagination } from '../../shared/components/list-view/list-pagination/list-pagination';
import { ListPanel } from '../../shared/components/list-view/list-panel/list-panel';
import { ListTableSkeleton } from '../../shared/components/list-view/list-table-skeleton/list-table-skeleton';
import { StatusBadge } from '../../shared/components/list-view/status-badge/status-badge';
import { UiIcon } from '../../shared/components/ui-icon/ui-icon';
import { ScrapListItem, ScrapReviewFilterStatus, ScrapSortField } from './scrap-base.models';
import { ScrapBulkReviewCoordinator } from './scrap-bulk-review.coordinator';
import { ScrapBulkReviewDialog } from './scrap-bulk-review-dialog/scrap-bulk-review-dialog';
import { ScrapReviewDrawer } from './scrap-review-drawer/scrap-review-drawer';
import { ScrapDefectType, ScrapReview, ScrapReviewBulkResult } from './scrap-review.models';
import { ScrapReviewService } from './scrap-review.service';
import { DefectTypesService } from './defect-types.service';
import { ScrapReviewTemplate } from './scrap-template.models';
import {
  ScrapTemplatePopover,
  TemplateUpdateRequest,
} from './scrap-template-popover/scrap-template-popover';
import { ScrapTemplateStore } from './scrap-template.store';
import { ScrapListStore } from './scrap-list.store';

@Component({
  selector: 'app-scrap-base-page',
  imports: [
    DelayedProgressSpinner,
    InlineAlert,
    ListFeedback,
    ListFilterDateRange,
    ListFilterInput,
    ListFilterPopover,
    ListFilterSelect,
    ListPagination,
    ListPanel,
    ListTableSkeleton,
    ScrapBulkReviewDialog,
    ScrapReviewDrawer,
    ScrapTemplatePopover,
    StatusBadge,
    UiIcon,
  ],
  templateUrl: './scrap-base-page.html',
  styleUrl: './scrap-base-page.css',
  providers: [ScrapBulkReviewCoordinator],
})
export class ScrapBasePage implements OnInit {
  private readonly reviewService = inject(ScrapReviewService);
  private readonly defectTypesService = inject(DefectTypesService);
  private readonly templateStore = inject(ScrapTemplateStore);
  private readonly listStore = inject(ScrapListStore);
  private readonly bulkReview = inject(ScrapBulkReviewCoordinator);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());
  readonly pageSizes = this.listStore.pageSizes;

  // Filtros existentes
  readonly dateFrom = this.listStore.dateFrom;
  readonly dateTo = this.listStore.dateTo;
  readonly organization = this.listStore.organization;
  readonly searchText = this.listStore.searchText;
  readonly searchQuery = this.listStore.searchQuery;
  readonly page = this.listStore.page;
  readonly pageSize = this.listStore.pageSize;
  readonly sortBy = this.listStore.sortBy;
  readonly sortOrder = this.listStore.sortOrder;
  readonly filterOpen = signal(false);

  // Novos filtros de análise
  readonly reviewStatusFilter = this.listStore.reviewStatusFilter;
  readonly defectTypeFilter = this.listStore.defectTypeFilter;
  readonly responsibleFilter = this.listStore.responsibleFilter;
  readonly defectTypes = signal<ScrapDefectType[]>([]);

  // Estado da listagem
  readonly data = this.listStore.data;
  readonly loading = this.listStore.loading;
  readonly error = this.listStore.error;

  // Modo de seleção e IDs selecionados
  readonly selectionMode = this.bulkReview.selectionMode;
  readonly selectedOccurrenceIds = this.bulkReview.selectedOccurrenceIds;
  readonly selectedCount = this.bulkReview.selectedCount;

  // Drawer de análise e referência em massa
  readonly openedOccurrenceId = signal<string | null>(null);
  readonly selectedOccurrenceForDrawer = signal<ScrapListItem | null>(null);
  readonly activeQueueIds = signal<string[]>([]);
  readonly activeQueueOccurrences = signal<ScrapListItem[]>([]);
  readonly activeReferenceReview = this.bulkReview.activeReferenceReview;
  readonly showBulkDialog = this.bulkReview.showBulkDialog;

  // Modelos de revisão salvos (Templates)
  readonly templates = this.templateStore.templates;
  readonly templatesLoading = this.templateStore.loading;
  readonly isTemplatePopoverOpen = signal(false);
  readonly activeTemplate = this.bulkReview.activeTemplate;
  readonly templateMutationId = signal<string | null>(null);
  readonly templateFeedback = signal<string | null>(null);
  readonly templateFeedbackKind = signal<'success' | 'error'>('success');

  readonly displayedItems = computed(() => {
    const items = this.data()?.items || [];
    if (!this.selectionMode()) {
      return items;
    }
    return items.filter((item) => item.review_status !== 'REVIEWED');
  });

  isItemSelectable(item: ScrapListItem | null | undefined): boolean {
    return this.bulkReview.isItemSelectable(item);
  }

  readonly isAllPageSelected = computed(() => {
    return this.bulkReview.isAllPageSelected(this.displayedItems());
  });

  readonly tableColumns = computed(() => {
    const cols = [];
    if (this.selectionMode()) {
      cols.push('');
    }
    cols.push(
      this.t().scrapColDate,
      this.t().scrapColOrganization,
      this.t().scrapColItem,
      this.t().scrapColDescription,
      this.t().scrapColOrder,
      this.t().scrapColQuantity,
      this.t().scrapColAmountUsd,
      this.t().scrapColDefectType,
      this.t().scrapColReviewStatus,
      this.t().scrapColResponsible,
      this.t().scrapColAction,
    );
    return cols;
  });

  readonly sortOptions = computed<readonly ListFilterSelectOption[]>(() => [
    { value: 'transaction_date', label: this.t().scrapSortTransactionDate },
    { value: 'organization_code', label: this.t().scrapSortOrganization },
    { value: 'item_code', label: this.t().scrapSortItemCode },
    { value: 'issue_quantity', label: this.t().scrapSortQuantity },
    { value: 'amount_usd', label: this.t().scrapSortAmountUsd },
  ]);

  readonly reviewStatusOptions = computed<readonly ListFilterSelectOption[]>(() => [
    { value: '', label: this.t().scrapReviewStatusAll },
    { value: 'UNREVIEWED', label: this.t().scrapReviewStatusUnreviewed },
    { value: 'DRAFT', label: this.t().scrapReviewStatusDraft },
    { value: 'REVIEWED', label: this.t().scrapReviewStatusReviewed },
  ]);

  readonly defectTypeOptions = computed<readonly ListFilterSelectOption[]>(() => {
    const list: ListFilterSelectOption[] = [
      { value: '', label: this.t().scrapFilterDefectTypeAll },
    ];
    for (const dt of this.defectTypes()) {
      list.push({ value: dt.id, label: dt.name });
    }
    return list;
  });

  readonly responsibleOptions = computed<readonly ListFilterSelectOption[]>(() => [
    { value: '', label: this.t().scrapFilterResponsibleAll },
    { value: 'mine', label: this.t().scrapFilterResponsibleMine },
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
      this.reviewStatusFilter(),
      this.defectTypeFilter(),
      this.responsibleFilter(),
    ].filter(Boolean).length;
  });

  ngOnInit(): void {
    // Carregar catálogo de tipos
    this.defectTypesService
      .getDefectTypes(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types) => this.defectTypes.set(types),
        error: () => this.defectTypes.set([]),
      });

    // Carregar templates favoritos
    this.templateStore.loadTemplates().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    // Se navegou trazendo uma referência selecionada (ex: vindo de /relatorios)
    const navState = history.state?.referenceReview as ScrapReview | undefined;
    if (navState) {
      this.activeReferenceReview.set(navState);
      this.selectionMode.set(true);
    }

    // Monitorar parâmetro da rota de revisão /base-de-scrap/revisao/:occurrenceId
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const occurrenceId = params.get('occurrenceId');
      if (occurrenceId) {
        this.openedOccurrenceId.set(occurrenceId);
      } else {
        this.openedOccurrenceId.set(null);
      }
    });

    this.loadScrap();
  }

  loadScrap(): void {
    if (this.dateRangeError()) return;
    this.listStore.load(this.selectionMode(), (page) => {
      const currentOccurrenceId = this.openedOccurrenceId();
      if (!currentOccurrenceId) return;
      const found = page.items.find((item) => item.occurrence_id === currentOccurrenceId);
      if (found) this.selectedOccurrenceForDrawer.set(found);
    });
  }

  toggleSelectionMode(): void {
    this.bulkReview.toggleSelectionMode();
    this.page.set(1);
    this.loadScrap();
  }

  toggleSelectAllOnPage(): void {
    if (this.bulkReview.toggleSelectAllOnPage(this.displayedItems())) {
      alert('O limite máximo de seleção para operação em lote é de 500 itens.');
    }
  }

  toggleItemSelection(target: ScrapListItem | string | null, event?: Event): void {
    event?.stopPropagation();
    const change = this.bulkReview.toggleItemSelection(target, this.data()?.items ?? []);
    if (change === 'limit-reached') {
      alert('O limite máximo de seleção para operação em lote é de 500 itens.');
    }
  }

  onRowClick(item: ScrapListItem): void {
    if (this.selectionMode()) {
      if (this.isItemSelectable(item)) {
        this.toggleItemSelection(item);
      }
      return;
    }
    if (item.occurrence_id) {
      this.openReview(item);
    }
  }

  clearSelection(): void {
    this.bulkReview.clearSelection();
  }

  openReview(item: ScrapListItem): void {
    if (!item.occurrence_id) return;
    this.selectedOccurrenceForDrawer.set(item);
    this.openedOccurrenceId.set(item.occurrence_id);
    this.router.navigate(['/base-de-scrap/revisao', item.occurrence_id], {
      queryParamsHandling: 'preserve',
    });
  }

  openReviewForFirstSelected(): void {
    const firstId = Array.from(this.selectedOccurrenceIds())[0];
    if (!firstId) return;
    const found = this.data()?.items.find((i) => i.occurrence_id === firstId);
    if (found) {
      this.openReview(found);
    } else {
      this.openedOccurrenceId.set(firstId);
      this.router.navigate(['/base-de-scrap/revisao', firstId], {
        queryParamsHandling: 'preserve',
      });
    }
  }

  openBulkDialog(): void {
    this.bulkReview.openBulkDialog();
  }

  closeBulkDialog(): void {
    this.bulkReview.closeBulkDialog();
  }

  onBulkCompleted(_result: ScrapReviewBulkResult): void {
    this.loadScrap();
  }

  removeActiveReference(): void {
    this.activeReferenceReview.set(null);
  }

  toggleTemplatePopover(event: Event): void {
    event.stopPropagation();
    this.isTemplatePopoverOpen.update((v) => !v);
  }

  onUseTemplate(template: ScrapReviewTemplate): void {
    this.isTemplatePopoverOpen.set(false);
    this.activeTemplate.set(template);
    this.activeReferenceReview.set(null);
    this.clearSelection();
    this.selectionMode.set(true);
    this.page.set(1);
    this.loadScrap();
  }

  onDeleteTemplate(templateId: string): void {
    this.templateMutationId.set(templateId);
    this.templateFeedback.set(null);
    this.templateStore
      .deleteTemplate(templateId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.templateMutationId.set(null);
          this.templateFeedbackKind.set('success');
          this.templateFeedback.set(this.t().scrapTemplateRemovedSuccess);
          if (this.activeTemplate()?.id === templateId) this.cancelSelectionFlow();
        },
        error: () => {
          this.templateMutationId.set(null);
          this.templateFeedbackKind.set('error');
          this.templateFeedback.set(this.t().scrapTemplateDeleteError);
        },
      });
  }

  onUpdateTemplate(request: TemplateUpdateRequest): void {
    this.templateMutationId.set(request.id);
    this.templateFeedback.set(null);
    this.templateStore
      .updateTemplate(request.id, request.payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.templateMutationId.set(null);
          this.templateFeedbackKind.set('success');
          this.templateFeedback.set(this.t().scrapTemplateUpdatedSuccess);
          if (this.activeTemplate()?.id === updated.id) this.activeTemplate.set(updated);
        },
        error: () => {
          this.templateMutationId.set(null);
          this.templateFeedbackKind.set('error');
          this.templateFeedback.set(this.t().scrapTemplateUpdateError);
        },
      });
  }

  removeActiveTemplate(): void {
    this.activeTemplate.set(null);
  }

  cancelSelectionFlow(): void {
    this.clearSelection();
    this.selectionMode.set(false);
    this.activeTemplate.set(null);
    this.activeReferenceReview.set(null);
    this.page.set(1);
    this.loadScrap();
  }

  startReviewQueue(): void {
    const ids = Array.from(this.selectedOccurrenceIds());
    if (ids.length === 0) return;
    const items = this.data()?.items || [];
    const occurrences = ids
      .map((id) => items.find((i) => i.occurrence_id === id))
      .filter((i): i is ScrapListItem => !!i);

    this.activeQueueIds.set(ids);
    this.activeQueueOccurrences.set(occurrences);
    this.openedOccurrenceId.set(ids[0]);
    this.selectedOccurrenceForDrawer.set(occurrences[0] || null);
    this.router.navigate(['/base-de-scrap/revisao', ids[0]], {
      queryParamsHandling: 'preserve',
    });
  }

  onQueueFinished(): void {
    this.activeQueueIds.set([]);
    this.activeQueueOccurrences.set([]);
    this.clearSelection();
    this.selectionMode.set(false);
    this.closeDrawer();
    this.loadScrap();
  }

  closeDrawer(): void {
    this.openedOccurrenceId.set(null);
    this.selectedOccurrenceForDrawer.set(null);
    this.activeQueueIds.set([]);
    this.activeQueueOccurrences.set([]);
    this.router.navigate(['/base-de-scrap'], {
      queryParamsHandling: 'preserve',
    });
  }

  onReviewSaved(review: ScrapReview): void {
    // Atualiza a ocorrência na lista localmente sem reload
    const currentData = this.data();
    if (currentData) {
      const updatedItems = currentData.items.map((item) => {
        if (item.occurrence_id === review.occurrence_id) {
          return {
            ...item,
            review_id: review.id,
            review_status: review.status,
            defect_type_id: review.defect_type?.id || null,
            defect_type_name: review.defect_type?.name || null,
            responsible_user_id: review.responsible_user_id,
            responsible_name: review.responsible_name,
            reviewed_at: review.reviewed_at,
            review_updated_at: review.updated_at,
            attachment_count: review.attachments.length,
          };
        }
        return item;
      });
      this.data.set({ ...currentData, items: updatedItems });
    }
  }

  onSearchInput(value: string): void {
    this.listStore.onSearchInput(value);
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
    this.pageSize.set(value as (typeof this.pageSizes)[number]);
    this.page.set(1);
    this.loadScrap();
  }

  onReviewStatusFilterChange(value: string): void {
    this.reviewStatusFilter.set(value as ScrapReviewFilterStatus | '');
    this.page.set(1);
    this.loadScrap();
  }

  onDefectTypeFilterChange(value: string): void {
    this.defectTypeFilter.set(value);
    this.page.set(1);
    this.loadScrap();
  }

  onResponsibleFilterChange(value: string): void {
    this.responsibleFilter.set(value as 'mine' | '');
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
    this.reviewStatusFilter.set('');
    this.defectTypeFilter.set('');
    this.responsibleFilter.set('');
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

  formatCurrency(value: string): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(
      Number(value),
    );
  }

  formatTransactionDate(value: string): string {
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!dateParts) return value;

    const [, year, month, day] = dateParts;
    return `${day}/${month}/${year}`;
  }

  formatReviewStatus(status: ScrapListItem['review_status']): string {
    if (status === 'REVIEWED') return this.t().scrapReviewStatusReviewed;
    if (status === 'DRAFT') return this.t().scrapReviewStatusDraft;
    return this.t().scrapReviewStatusUnreviewed;
  }

  reviewStatusTone(status: ScrapListItem['review_status']): 'success' | 'warning' | 'neutral' {
    if (status === 'REVIEWED') return 'success';
    if (status === 'DRAFT') return 'warning';
    return 'neutral';
  }

  calendarLocale(): string {
    const language = this.language.currentLanguage();
    return language === 'pt' ? 'pt-BR' : language === 'ko' ? 'ko-KR' : 'en-US';
  }
}
