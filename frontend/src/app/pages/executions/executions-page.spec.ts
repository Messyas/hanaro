import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
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
    const event = { target: { value: 'FAILED' } } as unknown as Event;
    component.onStatusChange(event);

    expect(component.statusFilter()).toBe('FAILED');
    expect(component.page()).toBe(1);
    expect(mockExecutionsService.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', page: 1 })
    );
  });

  it('should open detail modal when a row is clicked and close on escape or close button', () => {
    component.openDetail('22222222-2222-2222-2222-222222222222');
    fixture.detectChanges();

    expect(component.selectedExecutionId()).toBe('22222222-2222-2222-2222-222222222222');
    expect(mockExecutionsService.getDetail).toHaveBeenCalledWith('22222222-2222-2222-2222-222222222222');
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

  it('should persist page size to localStorage and reload list', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const event = { target: { value: '50' } } as unknown as Event;

    component.onPageSizeChange(event);

    expect(component.pageSize()).toBe(50);
    expect(component.page()).toBe(1);
    expect(setItemSpy).toHaveBeenCalledWith('hanaro-executions-page-size', '50');
    expect(mockExecutionsService.list).toHaveBeenCalledWith(
      expect.objectContaining({ page_size: 50, page: 1 })
    );

    setItemSpy.mockRestore();
  });
});
