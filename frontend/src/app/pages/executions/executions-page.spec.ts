import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ExecutionDetail, ExecutionPage } from './executions.models';
import { ExecutionsPage } from './executions-page';
import { ExecutionsService } from './executions.service';

describe('ExecutionsPage', () => {
  let component: ExecutionsPage;
  let fixture: ComponentFixture<ExecutionsPage>;
  let mockExecutionsService: {
    list: ReturnType<typeof vi.fn>;
    getDetail: ReturnType<typeof vi.fn>;
    uploadManualReport: ReturnType<typeof vi.fn>;
  };

  const mockPageData: ExecutionPage = {
    items: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        execution_id: '22222222-2222-2222-2222-222222222222',
        correlation_id: 'corr-123',
        source_system: 'GERP',
        report_name: 'Other Account Transaction Text Download',
        trigger: 'SCHEDULED',
        mode: 'GERP_RPA',
        status: 'COMPLETED',
        current_step: 'SNAPSHOT_PUBLICATION',
        query_date_from: '2026-08-30',
        query_date_to: '2026-08-30',
        organization_parameter: 'ALL',
        organizations_found: ['NW1', 'NW4', 'NWK'],
        gerp_request_id: '463753931',
        started_at: '2026-08-30T05:00:00Z',
        finished_at: '2026-08-30T05:07:15Z',
        duration_ms: 435000,
        records_received: 1177,
        records_accepted: 1177,
        records_rejected: 0,
        snapshot_status: 'PUBLISHED',
        failure_category: null,
      },
    ],
    page: 1,
    page_size: 25,
    total_items: 1,
    total_pages: 1,
  };

  const mockDetailData: ExecutionDetail = {
    ...mockPageData.items[0],
    processing_date: '2026-08-30',
    timezone: 'America/Manaus',
    source_file_name: 'scrap_report.tsv',
    source_file_sha256: 'a'.repeat(64),
    failure_code: null,
    failure_message: null,
    retry_count: 0,
    ingestion_run_id: null,
    steps: [
      {
        step_code: 'GERP_REQUEST',
        sequence: 1,
        attempt: 1,
        status: 'COMPLETED',
        started_at: '2026-08-30T05:00:00Z',
        finished_at: '2026-08-30T05:00:30Z',
        duration_ms: 30000,
        message: 'Request submitted successfully',
        error_code: null,
        metadata: {},
      },
    ],
  };

  beforeEach(async () => {
    mockExecutionsService = {
      list: vi.fn().mockReturnValue(of(mockPageData)),
      getDetail: vi.fn().mockReturnValue(of(mockDetailData)),
      uploadManualReport: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ExecutionsPage],
      providers: [{ provide: ExecutionsService, useValue: mockExecutionsService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ExecutionsPage);
    component = fixture.componentInstance;
    component.language.setLanguage('pt');
    fixture.detectChanges();
  });

  it('should create the executions page and load table on init', () => {
    expect(component).toBeTruthy();
    expect(mockExecutionsService.list).toHaveBeenCalledWith({
      page: 1,
      page_size: 25,
      sort_by: 'started_at',
      sort_order: 'desc',
    });
    expect(component.data()?.items.length).toBe(1);
  });

  it('should render the table and format data correctly', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Execuções e atualização');
    expect(compiled.querySelector('h2')?.textContent).toContain('Histórico de rotinas');

    const tableRows = compiled.querySelectorAll('.executions-table tbody tr');
    expect(tableRows.length).toBe(1);

    expect(tableRows[0].textContent).toContain('EXE-22222222');
    expect(tableRows[0].textContent).toContain('GERP');
    expect(tableRows[0].textContent).toContain('Agendado');
    expect(tableRows[0].textContent).toContain('Concluído');
  });

  it('should reload data when status filter changes', () => {
    component.selectStatus('FAILED');

    expect(component.statusFilter()).toBe('FAILED');
    expect(component.page()).toBe(1);
    expect(mockExecutionsService.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', page: 1 }),
    );
  });

  it('should preserve table rows while filtered data refreshes', async () => {
    const refreshRequest = new Subject<ExecutionPage>();
    mockExecutionsService.list.mockReturnValueOnce(refreshRequest);

    component.selectStatus('FAILED');
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.executions-table tbody tr')).toHaveLength(1);
    expect(compiled.querySelector('.list-table-frame')?.getAttribute('aria-busy')).toBe('true');
    expect(compiled.querySelector('app-list-table-skeleton')).toBeNull();

    refreshRequest.next(mockPageData);
    refreshRequest.complete();
    await fixture.whenStable();

    expect(compiled.querySelector('.list-table-frame')?.getAttribute('aria-busy')).toBe('false');
  });

  it('should open detail modal when a row is clicked and close on escape or close button', () => {
    component.openDetail('22222222-2222-2222-2222-222222222222');
    fixture.detectChanges();

    expect(component.selectedExecutionId()).toBe('22222222-2222-2222-2222-222222222222');
    expect(mockExecutionsService.getDetail).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
    );
    expect(component.selectedDetail()).toEqual(mockDetailData);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.detail-drawer')).toBeTruthy();

    component.closeDetail();
    fixture.detectChanges();
    expect(component.selectedExecutionId()).toBeNull();
    expect(compiled.querySelector('.detail-drawer')).toBeFalsy();
  });

  it('should update texts dynamically when system language changes to en and ko', () => {
    component.language.setLanguage('en');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Executions and Sync');
    expect(compiled.querySelector('h2')?.textContent).toContain('Routine history');
    expect(component.formatStatus('COMPLETED')).toBe('Completed');
    expect(component.formatSnapshotStatus('NOT_PUBLISHED')).toBe('Not published');
    expect(component.formatTrigger('SCHEDULED')).toBe('Scheduled');

    component.language.setLanguage('ko');
    fixture.detectChanges();

    expect(compiled.querySelector('h1')?.textContent).toContain('실행 및 동기화');
    expect(compiled.querySelector('h2')?.textContent).toContain('작업 이력');
    expect(component.formatStatus('COMPLETED')).toBe('완료됨');
    expect(component.formatSnapshotStatus('NOT_PUBLISHED')).toBe('미게시');
    expect(component.formatTrigger('SCHEDULED')).toBe('예약됨');
  });

  it('should toggle filter popover, compute active filters count and clear filters', () => {
    expect(component.filterOpen()).toBe(false);
    expect(component.activeFiltersCount()).toBe(0);

    component.toggleFilterPopover();
    fixture.detectChanges();
    expect(component.filterOpen()).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.filter-popover-panel')).toBeTruthy();

    // Set search query and status filter
    component.searchQuery.set('EXE-1234');
    component.statusFilter.set('FAILED');
    expect(component.activeFiltersCount()).toBe(2);

    fixture.detectChanges();
    const pills = compiled.querySelectorAll('.filter-pill');
    expect(pills.length).toBe(2);

    // Clear search pill
    component.clearSearch();
    expect(component.searchQuery()).toBe('');
    expect(component.activeFiltersCount()).toBe(1);

    // Clear all filters
    component.clearFilters();
    expect(component.statusFilter()).toBe('');
    expect(component.activeFiltersCount()).toBe(0);

    // Close popover
    component.closeFilterPopover();
    fixture.detectChanges();
    expect(component.filterOpen()).toBe(false);
    expect(compiled.querySelector('.filter-popover-panel')).toBeFalsy();
  });

  it('should persist page size to localStorage and reload list', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    component.selectPageSize(50);

    expect(component.pageSize()).toBe(50);
    expect(component.page()).toBe(1);
    expect(setItemSpy).toHaveBeenCalledWith('hanaro-executions-page-size', '50');
    expect(mockExecutionsService.list).toHaveBeenCalledWith(
      expect.objectContaining({ page_size: 50, page: 1 }),
    );

    setItemSpy.mockRestore();
  });

  it('should accept a matching manual report regardless of file size', () => {
    const file = {
      name: 'Other_Account_Transaction_Text_large',
      size: 2_000_000_000,
    } as File;
    const event = { target: { files: { item: () => file } } } as unknown as Event;

    component.selectManualUploadFile(event);

    expect(component.manualUploadFile()).toBe(file);
    expect(component.manualUploadError()).toBeNull();
  });

  it('should toggle custom datepicker, select date and set today', () => {
    expect(component.dateFromPickerOpen()).toBe(false);
    component.toggleDateFromPicker();
    expect(component.dateFromPickerOpen()).toBe(true);

    component.selectDayFrom('2026-08-15');
    expect(component.dateFrom()).toBe('2026-08-15');
    expect(component.dateFromPickerOpen()).toBe(false);

    component.setTodayTo();
    expect(component.dateTo()).toBeTruthy();
    expect(component.dateToPickerOpen()).toBe(false);

    component.clearDateFromInput();
    expect(component.dateFrom()).toBe('');
  });

  it('should validate date range consistency and block invalid queries', () => {
    component.dateFrom.set('2026-08-20');
    component.dateTo.set('2026-08-10');

    expect(component.dateRangeError()).toBe(true);

    mockExecutionsService.list.mockClear();
    component.loadExecutions();
    expect(mockExecutionsService.list).not.toHaveBeenCalled();

    // Selecting day from clears dateTo if dateTo is before new dateFrom
    component.selectDayFrom('2026-08-25');
    expect(component.dateTo()).toBe('');
    expect(component.dateRangeError()).toBe(false);

    // Days before dateFrom should be marked as disabled in dateTo calendar
    const days = component.getCalendarDays(new Date(2026, 7, 1), '', '2026-08-25');
    const dayBefore = days.find((d) => d.dateStr === '2026-08-20');
    const dayAfter = days.find((d) => d.dateStr === '2026-08-26');
    expect(dayBefore?.isDisabled).toBe(true);
    expect(dayAfter?.isDisabled).toBe(false);
  });

  it('should format date strings with / and normalize typed slash inputs', () => {
    expect(component.formatDateSlash('2026-08-30')).toBe('2026/08/30');
    expect(component.formatDateSlash('')).toBe('');

    const eventFrom = { target: { value: '2026/08/01' } } as unknown as Event;
    component.onDateFromChange(eventFrom);
    expect(component.dateFrom()).toBe('2026-08-01');

    const eventTo = { target: { value: '2026/08/31' } } as unknown as Event;
    component.onDateToChange(eventTo);
    expect(component.dateTo()).toBe('2026-08-31');
  });

  it('should debounce search input before triggering executions list reload', () => {
    vi.useFakeTimers();
    mockExecutionsService.list.mockClear();

    const inputEvent1 = { target: { value: 'EXE' } } as unknown as Event;
    component.onSearchInput(inputEvent1);
    vi.advanceTimersByTime(100);
    expect(mockExecutionsService.list).not.toHaveBeenCalled();

    const inputEvent2 = { target: { value: 'EXE-1234' } } as unknown as Event;
    component.onSearchInput(inputEvent2);
    vi.advanceTimersByTime(200);
    expect(mockExecutionsService.list).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150); // total 350ms since second keystroke
    expect(mockExecutionsService.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'EXE-1234', page: 1 }),
    );

    vi.useRealTimers();
  });

  it('should ignore incomplete manual date input and only load when valid or cleared', () => {
    mockExecutionsService.list.mockClear();

    // Partial date string should NOT trigger load
    const partialEvent = { target: { value: '2026/08' } } as unknown as Event;
    component.onDateFromChange(partialEvent);
    expect(component.dateFrom()).toBe('2026-08');
    expect(mockExecutionsService.list).not.toHaveBeenCalled();

    // Full valid date string SHOULD trigger load
    const completeEvent = { target: { value: '2026/08/15' } } as unknown as Event;
    component.onDateFromChange(completeEvent);
    expect(component.dateFrom()).toBe('2026-08-15');
    expect(mockExecutionsService.list).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-08-15', page: 1 }),
    );

    // Empty date string (cleared) SHOULD trigger load
    mockExecutionsService.list.mockClear();
    const emptyEvent = { target: { value: '' } } as unknown as Event;
    component.onDateFromChange(emptyEvent);
    expect(component.dateFrom()).toBe('');
    expect(mockExecutionsService.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });
});
