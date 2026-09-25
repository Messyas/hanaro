import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ScrapPage } from './list/scrap-base.models';
import { ScrapBasePage } from './scrap-base-page';
import { ScrapBaseService } from './list/scrap-base.service';
import { ScrapReviewService } from './review/scrap-review.service';
import { DefectTypesService } from './review/defect-types.service';
import { ScrapTemplateStore } from './templates/scrap-template.store';

describe('ScrapBasePage', () => {
  let component: ScrapBasePage;
  let fixture: ComponentFixture<ScrapBasePage>;
  let scrapBaseServiceMock: { list: ReturnType<typeof vi.fn> };
  let scrapReviewServiceMock: {
    getDefectTypes: ReturnType<typeof vi.fn>;
    getReview: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  const mockPage: ScrapPage = {
    items: [
      {
        id: 'transaction-1',
        occurrence_id: 'occurrence-1',
        current_transaction_id: 'transaction-1',
        source_line: 4,
        organization_code: 'NWK',
        account_code: '5110',
        account_alias: 'SCRAP',
        receipt_department: 'RECEBIMENTO',
        item_code: 'ITEM-001',
        item_description: 'Peça descartada',
        transaction_date: '2026-08-30',
        issue_quantity: '-2.5',
        issue_amount_brl: '-100.5',
        work_order: 'WO-1',
        amount_usd: '-18.2',
        to_be_counted: true,
        occurrence_status: 'ACTIVE',
        review_id: null,
        review_status: null,
        defect_type_id: null,
        defect_type_name: null,
        responsible_user_id: null,
        responsible_name: null,
        reviewed_at: null,
        review_updated_at: null,
        attachment_count: 0,
      },
    ],
    page: 1,
    page_size: 50,
    total_items: 1,
    total_pages: 1,
  };

  beforeEach(async () => {
    scrapBaseServiceMock = {
      list: vi.fn().mockReturnValue(of(mockPage)),
    };
    scrapReviewServiceMock = {
      getDefectTypes: vi.fn().mockReturnValue(of([])),
      getReview: vi.fn().mockReturnValue(of(null)),
    };

    const authServiceMock = {
      user: () => ({ id: 1, name: 'Analista Teste', username: 'analista' }),
    };

    const scrapTemplateServiceMock = {
      templates: () => [],
      loading: () => false,
      activeTemplate: () => null,
      loadTemplates: vi.fn().mockReturnValue(of([])),
      createTemplate: vi.fn().mockReturnValue(of({})),
      updateTemplate: vi.fn().mockReturnValue(of({})),
      deleteTemplate: vi.fn().mockReturnValue(of(undefined)),
      setActiveTemplate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ScrapBasePage],
      providers: [
        provideRouter([]),
        LanguageService,
        { provide: ScrapBaseService, useValue: scrapBaseServiceMock },
        { provide: ScrapReviewService, useValue: scrapReviewServiceMock },
        { provide: DefectTypesService, useValue: scrapReviewServiceMock },
        { provide: ScrapTemplateStore, useValue: scrapTemplateServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    TestBed.inject(LanguageService).setLanguage('pt');
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ScrapBasePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads and renders the base with USD values and no BRL column', () => {
    expect(scrapBaseServiceMock.list).toHaveBeenCalledWith({
      page: 1,
      page_size: 50,
      sort_by: 'transaction_date',
      sort_order: 'desc',
    });

    const rendered = fixture.nativeElement.textContent;
    expect(rendered).toContain('ITEM-001');
    expect(rendered).toContain('VALOR USD');
    expect(rendered).not.toContain('VALOR BRL');
  });

  it('formats reviewed timestamps using the table date pattern', () => {
    expect(component.formatTransactionDate('2026-09-03T20:03:39.734227')).toBe('03/09/2026');
  });

  it('toggles selection mode and selects items by occurrence_id', () => {
    expect(component.selectionMode()).toBe(false);

    component.toggleSelectionMode();
    expect(component.selectionMode()).toBe(true);

    const event = new MouseEvent('click');
    component.toggleItemSelection('occurrence-1', event);
    expect(component.selectedCount()).toBe(1);
    expect(component.selectedOccurrenceIds().has('occurrence-1')).toBe(true);

    component.clearSelection();
    expect(component.selectedCount()).toBe(0);
  });

  it('toggles select all eligible items on current page', () => {
    component.toggleSelectionMode();
    component.toggleSelectAllOnPage();
    expect(component.selectedCount()).toBe(1);

    component.toggleSelectAllOnPage();
    expect(component.selectedCount()).toBe(0);
  });

  it('opens review drawer and navigates to review route', () => {
    const item = mockPage.items[0];
    component.openReview(item);

    expect(component.openedOccurrenceId()).toBe('occurrence-1');
    expect(router.navigate).toHaveBeenCalledWith(['/base-de-scrap/revisao', 'occurrence-1'], {
      queryParamsHandling: 'preserve',
    });
  });

  it('filters by review status and resets page to 1', () => {
    component.onReviewStatusFilterChange('REVIEWED');
    expect(component.reviewStatusFilter()).toBe('REVIEWED');
    expect(component.page()).toBe(1);
    expect(scrapBaseServiceMock.list).toHaveBeenCalledWith(
      expect.objectContaining({ review_status: 'REVIEWED' }),
    );
  });

  it('clears all filters including new review filters', () => {
    component.reviewStatusFilter.set('DRAFT');
    component.defectTypeFilter.set('def-1');
    component.responsibleFilter.set('mine');
    component.clearFilters();

    expect(component.reviewStatusFilter()).toBe('');
    expect(component.defectTypeFilter()).toBe('');
    expect(component.responsibleFilter()).toBe('');
    expect(component.dateFrom()).toBe('');
    expect(component.dateTo()).toBe('');
    expect(component.organization()).toBe('');
    expect(component.searchQuery()).toBe('');
  });

  it('starts review queue when multiple items are selected', () => {
    component.toggleSelectionMode();
    const event = new MouseEvent('click');
    component.toggleItemSelection('occurrence-1', event);

    expect(component.selectedCount()).toBe(1);

    component.startReviewQueue();
    expect(component.activeQueueIds()).toEqual(['occurrence-1']);
    expect(component.openedOccurrenceId()).toBe('occurrence-1');
    expect(router.navigate).toHaveBeenCalledWith(['/base-de-scrap/revisao', 'occurrence-1'], {
      queryParamsHandling: 'preserve',
    });
  });

  it('selects a template and activates selection in the main table', () => {
    const mockTemplate = {
      id: 'tpl-1',
      name: 'Modelo Oxidação',
      title: 'Título Oxidação',
      description: 'Desc',
      defect_type_id: null,
      created_by_user_id: 1,
      source_review_id: 'rev-1',
      defect_type: null,
      is_active: true,
      created_at: '',
      updated_at: '',
    };

    expect(component.selectionMode()).toBe(false);
    expect(component.showBulkDialog()).toBe(false);

    component.onUseTemplate(mockTemplate);

    expect(component.activeTemplate()).toBe(mockTemplate);
    expect(component.showBulkDialog()).toBe(false);
    expect(component.selectionMode()).toBe(true);
  });

  it('excludes reviewed occurrences from listing and prevents selection in selection mode', () => {
    const reviewedItem = {
      ...mockPage.items[0],
      id: 'transaction-2',
      occurrence_id: 'occurrence-2',
      review_status: 'REVIEWED' as const,
    };
    const unreviewedItem = mockPage.items[0];

    component.data.set({
      ...mockPage,
      items: [unreviewedItem, reviewedItem],
    });

    // In normal mode, both items are displayed
    expect(component.selectionMode()).toBe(false);
    expect(component.displayedItems()).toHaveLength(2);

    // Enter selection mode
    component.toggleSelectionMode();
    expect(component.selectionMode()).toBe(true);

    // In selection mode, reviewed items must NOT appear in the listing
    expect(component.displayedItems()).toHaveLength(1);
    expect(component.displayedItems()[0].occurrence_id).toBe('occurrence-1');

    // Reviewed item is not selectable
    expect(component.isItemSelectable(reviewedItem)).toBe(false);
    expect(component.isItemSelectable(unreviewedItem)).toBe(true);

    // Attempting to select reviewed item does nothing
    component.toggleItemSelection(reviewedItem);
    expect(component.selectedCount()).toBe(0);

    // Clicking row of reviewed item does nothing in selection mode
    component.onRowClick(reviewedItem);
    expect(component.selectedCount()).toBe(0);

    // Clicking row of unreviewed item selects it in selection mode
    component.onRowClick(unreviewedItem);
    expect(component.selectedCount()).toBe(1);
    expect(component.selectedOccurrenceIds().has('occurrence-1')).toBe(true);
  });
});
