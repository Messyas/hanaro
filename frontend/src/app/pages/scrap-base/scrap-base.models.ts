export type ScrapReviewStatus = 'DRAFT' | 'REVIEWED';
export type ScrapReviewFilterStatus = 'UNREVIEWED' | ScrapReviewStatus;

export type ScrapSortField =
  | 'transaction_date'
  | 'organization_code'
  | 'receipt_department'
  | 'item_code'
  | 'issue_quantity'
  | 'amount_usd';

export type SortOrder = 'asc' | 'desc';

export interface ScrapListItem {
  id: string;
  occurrence_id: string | null;
  current_transaction_id: string | null;
  source_line: number;
  organization_code: string;
  account_code: string;
  account_alias: string;
  receipt_department: string | null;
  item_code: string;
  item_description: string | null;
  transaction_date: string;
  issue_quantity: string;
  issue_amount_brl: string;
  work_order: string | null;
  amount_usd: string;
  to_be_counted: boolean | null;
  occurrence_status: string;

  review_id: string | null;
  review_status: ScrapReviewStatus | null;
  defect_type_id: string | null;
  defect_type_name: string | null;
  responsible_user_id: number | null;
  responsible_name: string | null;
  reviewed_at: string | null;
  review_updated_at: string | null;
  attachment_count: number;
}

export interface ScrapPage {
  items: ScrapListItem[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ScrapFilterParams {
  date_from?: string;
  date_to?: string;
  organizations?: string[];
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: ScrapSortField;
  sort_order?: SortOrder;
  review_status?: 'UNREVIEWED' | 'DRAFT' | 'REVIEWED';
  defect_type_ids?: string[];
  responsible_user_ids?: number[];
  exclude_reviewed?: boolean;
}
