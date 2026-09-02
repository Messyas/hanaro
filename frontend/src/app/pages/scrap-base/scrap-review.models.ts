export type ScrapReviewStatus = 'DRAFT' | 'REVIEWED';

export interface ScrapDefectType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScrapReviewAttachment {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  position: number;
  created_at: string;
  url: string;
}

export interface ScrapReview {
  id: string;
  occurrence_id: string;
  status: ScrapReviewStatus;
  defect_type: ScrapDefectType | null;
  responsible_user_id: number;
  responsible_name: string;
  title: string;
  description: string;
  version: number;
  source_review_id: string | null;
  bulk_operation_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  attachments: ScrapReviewAttachment[];
}

export interface ScrapReviewWrite {
  defect_type_id: string | null;
  title: string;
  description: string;
  expected_version?: number | null;
}

export interface ScrapReviewFormModel {
  defectTypeId: string;
  title: string;
  description: string;
}

export interface ScrapReviewBulkCreate {
  reference_review_id: string;
  occurrence_ids: string[];
  copy_attachments: boolean;
}

export interface ScrapReviewBulkSkippedItem {
  occurrence_id: string;
  reason: 'NOT_ACTIVE' | 'ALREADY_REVIEWED';
}

export interface ScrapReviewBulkResult {
  operation_id: string;
  status: string;
  requested_count: number;
  created_count: number;
  skipped_count: number;
  created_occurrence_ids: string[];
  skipped: ScrapReviewBulkSkippedItem[];
}
