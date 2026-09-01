export type ScrapSortField =
  | 'transaction_date'
  | 'organization_code'
  | 'receipt_department'
  | 'item_code'
  | 'issue_quantity'
  | 'issue_amount_brl'
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
}
