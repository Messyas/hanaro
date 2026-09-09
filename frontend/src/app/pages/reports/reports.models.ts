export type ReportStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ExportFormat = 'CSV' | 'PDF' | 'PPTX';
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

export interface ReportListItem {
  id: string;
  factory_id: string;
  code: string;
  title: string;
  description: string;
  status: ReportStatus;
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
  content: { metrics: ReportMetrics; [key: string]: unknown };
  template_version: string;
  sha256: string;
  published_by_user_id: number | null;
  published_at: string;
  items?: PreviewItem[];
}

export interface ExportJob {
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
