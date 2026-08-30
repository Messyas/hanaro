export type AutomationExecutionStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type AutomationSnapshotStatus =
  'NOT_PUBLISHED' | 'PUBLISHED' | 'UNCHANGED_REPLAY' | 'PRESERVED_PREVIOUS';

export type AutomationTrigger = 'SCHEDULED';

export type AutomationMode = 'LOCAL_FILE_SIMULATION' | 'GERP_RPA';

export type ExecutionStepCode =
  | 'GERP_REQUEST'
  | 'GERP_REPORT_GENERATION'
  | 'FILE_DOWNLOAD'
  | 'FILE_VALIDATION'
  | 'DATA_NORMALIZATION'
  | 'EXCHANGE_RATE'
  | 'JSON_VALIDATION'
  | 'SNAPSHOT_PUBLICATION';

export type ExecutionStepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export type ExecutionSortField = 'started_at' | 'finished_at' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface ExecutionListItem {
  id: string;
  execution_id: string;
  correlation_id: string;
  source_system: string;
  report_name: string;
  trigger: AutomationTrigger;
  mode: AutomationMode;
  status: AutomationExecutionStatus;
  current_step: ExecutionStepCode | null;
  query_date_from: string;
  query_date_to: string;
  organization_parameter: string;
  organizations_found: string[];
  gerp_request_id: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  records_received: number;
  records_accepted: number;
  records_rejected: number;
  snapshot_status: AutomationSnapshotStatus;
  failure_category: string | null;
}

export interface ExecutionPage {
  items: ExecutionListItem[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ExecutionStepRead {
  step_code: ExecutionStepCode;
  sequence: number;
  attempt: number;
  status: ExecutionStepStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  message: string | null;
  error_code: string | null;
  metadata: Record<string, unknown>;
}

export interface ExecutionDetail extends ExecutionListItem {
  processing_date: string;
  timezone: string;
  source_file_name: string | null;
  source_file_sha256: string | null;
  failure_code: string | null;
  failure_message: string | null;
  retry_count: number;
  ingestion_run_id: string | null;
  steps: ExecutionStepRead[];
}

export interface ExecutionsFilterParams {
  date_from?: string;
  date_to?: string;
  status?: AutomationExecutionStatus;
  mode?: AutomationMode;
  trigger?: AutomationTrigger;
  snapshot_status?: AutomationSnapshotStatus;
  failure_category?: string;
  execution_id?: string;
  gerp_request_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: ExecutionSortField;
  sort_order?: SortOrder;
}
