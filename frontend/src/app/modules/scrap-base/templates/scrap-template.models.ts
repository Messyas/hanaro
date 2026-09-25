import { ScrapDefectType } from '../review/scrap-review.models';

export interface ScrapReviewTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  defect_type_id: string | null;
  defect_type?: ScrapDefectType | null;
  created_by_user_id: number;
  source_review_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScrapReviewTemplateCreate {
  name: string;
  title?: string;
  description?: string;
  defect_type_id?: string | null;
  source_review_id?: string | null;
}

export interface ScrapReviewTemplateUpdate {
  name?: string;
  title?: string;
  description?: string;
  defect_type_id?: string | null;
}
