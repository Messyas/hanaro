export type ReportStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ReportKind = 'DOSSIER' | 'PERIOD_CLOSE';
export type ExportFormat = 'CSV' | 'PDF' | 'PPTX' | 'MARKDOWN';

export interface ReportScopeFilters {
  organization_codes: string[];
  product_codes: string[];
  divisions: string[];
  lines: string[];
}

export interface ReportScope {
  period_from: string;
  period_to: string;
  cutoff_at: string | null;
  timezone: string;
  metric_code: 'MATERIAL_SCRAP_COST';
  metric_policy_version: 'scrap-cost-v1';
  currency: 'BRL' | 'USD';
  comparison_mode: 'NONE' | 'PREVIOUS_YEAR' | 'CUSTOM';
  comparison_from: string | null;
  comparison_to: string | null;
  is_provisional: boolean;
  scope_key?: string;
  filters: ReportScopeFilters;
}

export type ReportSectionKind =
  | 'CONTEXT'
  | 'EXECUTIVE_SUMMARY'
  | 'KPI'
  | 'TREND'
  | 'PARETO'
  | 'ACTIONS'
  | 'CASE'
  | 'EVIDENCE'
  | 'CONCLUSIONS'
  | 'APPENDIX';

export interface ReportSection {
  id?: string;
  section_key: string;
  kind: ReportSectionKind;
  position?: number;
  enabled: boolean;
  title: string;
  payload_schema_version: number;
  payload: Record<string, unknown>;
}

export interface CreateReportInput {
  title: string;
  description: string;
  report_kind?: ReportKind;
  content_schema_version?: number;
  scope?: ReportScope;
}
export interface ExportOptions {
  language: 'pt' | 'en' | 'ko';
  include_money: boolean;
  include_summary: boolean;
  include_occurrences: boolean;
  include_justifications: boolean;
  include_evidence: boolean;
  notify_on_completion: boolean;
}
export type ExportStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ReportCandidateQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface ReportListItem {
  id: string;
  factory_id: string;
  code: string;
  title: string;
  description: string;
  status: ReportStatus;
  report_kind: ReportKind;
  content_schema_version: number;
  created_by_user_id: number | null;
  author_name?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  latest_publication?: string | null;
  latest_revision?: number | null;
  occurrence_count?: number;
}

export interface ReportDetail extends ReportListItem {
  occurrence_source_ids: string[];
  report_source_ids: string[];
  latest_version: ReportVersion | null;
  scope: ReportScope | null;
  sections: ReportSection[];
  action_source_ids: string[];
  evidence_sources: ReportEvidenceSource[];
}

export interface ReportEvidenceSource {
  id: string;
  section_key: string;
  review_attachment_id: string | null;
  published_evidence_id: string | null;
  caption: string;
  role: 'CONTEXT' | 'BEFORE' | 'AFTER' | 'IMPLEMENTATION' | 'MEASUREMENT';
  captured_at: string | null;
  position: number;
}

export interface ReportCoverage {
  status: 'COMPLETE' | 'PARTIAL' | 'UNKNOWN';
  expected_days: number;
  complete_days: number;
  partial_days: number;
  unknown_days: number;
  missing_dates: string[];
  source_revisions: string[];
}

export interface ReportComparison {
  period_from: string;
  period_to: string;
  occurrence_count: number;
  total: string;
  monthly: Array<{ period: string; total: string }>;
  pareto_lines: Array<{ line: string | null; total: string }>;
}

export interface ReportAnalytics {
  metric: { code: 'MATERIAL_SCRAP_COST'; version: 'scrap-cost-v1'; currency: 'BRL' | 'USD' };
  occurrence_count: number;
  total: string;
  monthly: Array<{ period: string; total: string }>;
  pareto_lines: Array<{ line: string | null; total: string }>;
  target: string | null;
  target_revision: number | null;
  coverage: ReportCoverage;
  comparison: ReportComparison | null;
}

export interface ReportReadinessIssue {
  code: string;
  severity: 'BLOCKER' | 'WARNING';
  message: string;
  section_id: string | null;
  source_id: string | null;
  suggested_action: string;
}

export interface ReportDocumentHeader {
  id: string;
  code: string;
  title: string;
  description: string;
  kind: ReportKind;
}

export interface ReportDocumentScope {
  period_from: string;
  period_to: string;
  cutoff_at: string | null;
  timezone: string;
  currency: 'BRL' | 'USD';
  comparison_mode: ReportScope['comparison_mode'];
  comparison_from: string | null;
  comparison_to: string | null;
  is_provisional: boolean;
  filters: ReportScopeFilters;
}

export interface ReportDocumentAction {
  id: string;
  code: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  owner_id: number | null;
  due_at: string | null;
  blocked_reason: string | null;
  validated_at: string | null;
  version: number;
}

export interface ReportDocumentFile {
  id?: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256?: string;
  download_url?: string;
  requires_authentication?: boolean;
}

export interface ReportDocumentEvidence {
  source_id: string;
  section_key: string;
  caption: string;
  role: ReportEvidenceSource['role'];
  captured_at: string | null;
  source_attachment_id?: string;
  preview?: ReportDocumentFile;
  published?: ReportDocumentFile;
}

interface ReportDocumentSectionBase {
  id: string;
  key: string;
  kind: ReportSectionKind;
  title: string;
  payload_schema_version: number;
  payload: Record<string, unknown>;
  evidence: ReportDocumentEvidence[];
}

export interface ReportKpiDocumentSection extends ReportDocumentSectionBase {
  kind: 'KPI';
  data: Pick<
    ReportAnalytics,
    'metric' | 'occurrence_count' | 'total' | 'target' | 'target_revision' | 'coverage'
  >;
}

export interface ReportTrendDocumentSection extends ReportDocumentSectionBase {
  kind: 'TREND';
  data: Pick<ReportAnalytics, 'monthly' | 'comparison'>;
}

export interface ReportParetoDocumentSection extends ReportDocumentSectionBase {
  kind: 'PARETO';
  data: { lines: ReportAnalytics['pareto_lines'] };
}

export interface ReportActionsDocumentSection extends ReportDocumentSectionBase {
  kind: 'ACTIONS';
  data: { actions: ReportDocumentAction[] };
}

export interface ReportNarrativeDocumentSection extends ReportDocumentSectionBase {
  kind: 'CONTEXT' | 'EXECUTIVE_SUMMARY' | 'CASE' | 'EVIDENCE' | 'CONCLUSIONS' | 'APPENDIX';
}

export type ReportDocumentSection =
  | ReportKpiDocumentSection
  | ReportTrendDocumentSection
  | ReportParetoDocumentSection
  | ReportActionsDocumentSection
  | ReportNarrativeDocumentSection;

export interface ReportDocumentV2 {
  report: ReportDocumentHeader;
  scope: ReportDocumentScope;
  analytics: ReportAnalytics;
  sections: ReportDocumentSection[];
  actions: ReportDocumentAction[];
  evidence: ReportDocumentEvidence[];
}

export interface PeriodClosePreview {
  report: ReportListItem;
  content_schema_version: 2;
  document: ReportDocumentV2;
  readiness: { ready: boolean; issues: ReportReadinessIssue[] };
  fingerprint: string;
  generated_at: string;
}

export interface EligibleAction {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  owner_id: number | null;
  due_at: string | null;
  version: number;
}

export interface EligibleEvidence {
  id: string;
  occurrence_id: string;
  transaction_date: string;
  item_code: string | null;
  item_description: string | null;
  review_title: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
}

export interface EligibleOccurrence {
  id: string;
  organization_code: string;
  transaction_date: string;
  item_code: string | null;
  item_description: string | null;
  product: string | null;
  division: string | null;
  line: string | null;
  amount_usd: string;
  review_title: string;
  reviewed_by: string;
}

export interface PreviewItem extends EligibleOccurrence {
  occurrence_id: string;
  transaction_id: string;
  issue_quantity: string;
  issue_amount_brl: string;
  exchange_rate: string;
  review_description: string;
  reviewed_by_name: string;
}

export interface ReportMetrics {
  occurrence_count: number;
  issue_amount_brl: string;
  amount_usd: string;
}

export interface ReportPreview {
  conflicts?: { occurrence_id: string; source_version_id: string; alternative: PreviewItem }[];
  report: ReportDetail;
  items: PreviewItem[];
  metrics: ReportMetrics;
  lineage: Record<string, Array<Record<string, string>>>;
  source_versions: ReportVersion[];
  generated_at: string;
}

export interface ReportVersion {
  id: string;
  report_id: string;
  snapshot_id: string;
  revision: number;
  content: { metrics?: ReportMetrics; document?: ReportDocumentV2; [key: string]: unknown };
  template_version: string;
  content_schema_version: number;
  sha256: string;
  published_by_user_id: number | null;
  published_at: string;
  items?: PreviewItem[];
}

export interface ExportJob {
  options?: ExportOptions;
  id: string;
  report_version_id: string;
  format: ExportFormat;
  status: ExportStatus;
  attempts: number;
  error_message: string | null;
  artifact: {
    filename: string;
    content_type: string;
    size_bytes: number;
    sha256: string;
    download_url: string;
  } | null;
}
