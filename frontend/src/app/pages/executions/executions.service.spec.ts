import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExecutionDetail, ExecutionPage } from './executions.models';
import { ExecutionsService } from './executions.service';

describe('ExecutionsService', () => {
  let service: ExecutionsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExecutionsService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ExecutionsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should request paginated executions with filter parameters', () => {
    const mockPage: ExecutionPage = {
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

    service
      .list({
        page: 1,
        page_size: 25,
        status: 'COMPLETED',
        date_from: '2026-08-01',
        date_to: '2026-08-30',
      })
      .subscribe((result) => {
        expect(result).toEqual(mockPage);
        expect(result.items.length).toBe(1);
      });

    const req = httpTesting.expectOne(
      '/api/v1/scrap/executions?page=1&page_size=25&status=COMPLETED&date_from=2026-08-01&date_to=2026-08-30',
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockPage);
  });

  it('should request execution detail by ID', () => {
    const executionId = '22222222-2222-2222-2222-222222222222';
    const mockDetail: ExecutionDetail = {
      id: '11111111-1111-1111-1111-111111111111',
      execution_id: executionId,
      correlation_id: 'corr-123',
      source_system: 'GERP',
      report_name: 'Other Account Transaction Text Download',
      trigger: 'SCHEDULED',
      mode: 'GERP_RPA',
      status: 'COMPLETED',
      current_step: 'SNAPSHOT_PUBLICATION',
      query_date_from: '2026-08-30',
      query_date_to: '2026-08-30',
      processing_date: '2026-08-30',
      timezone: 'America/Manaus',
      source_file_name: 'scrap_report.tsv',
      source_file_sha256: 'a'.repeat(64),
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
          message: null,
          error_code: null,
          metadata: {},
        },
      ],
    };

    service.getDetail(executionId).subscribe((result) => {
      expect(result).toEqual(mockDetail);
      expect(result.steps.length).toBe(1);
    });

    const req = httpTesting.expectOne(`/api/v1/scrap/executions/${executionId}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDetail);
  });

  it('should upload a manual GERP report as multipart data', () => {
    const file = new File(['report'], 'Other_Account_Transaction_Text_test', {
      type: 'text/plain',
    });

    service.uploadManualReport(file).subscribe();

    const req = httpTesting.expectOne('/api/v1/scrap/manual-ingestions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    const uploadedFile = (req.request.body as FormData).get('file') as File;
    expect(uploadedFile.name).toBe(file.name);
    expect(uploadedFile.size).toBe(file.size);
    req.flush({ task_id: 'task-1', execution_id: 'execution-1', status: 'QUEUED' });
  });
});
