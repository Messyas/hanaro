export interface Person {
  id: number;
  name: string;
  profile_image_url: string | null;
}
export interface WorkflowPage<T> {
  items: T[];
  total: number;
  has_next: boolean;
}
export type TaskState = 'PLANNED' | 'IN_PROGRESS' | 'UNDER_VERIFICATION' | 'COMPLETED';
export interface Plan {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'COMPLETED';
  version: number;
  reports: { id: string; report_id: string; revision: number; title: string }[];
}
export interface ActionTask {
  id: string;
  plan_id: string;
  title: string;
  description: string;
  priority: string;
  tags?: string[];
  due_at: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  version: number;
  status: TaskState;
  position: number;
  participants: Person[];
  occurrence_ids?: string[];
  occurrences?: TaskOccurrence[];
  evidence?: ActionEvidenceItem[];
}
export interface ActionEvidenceItem {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_by_user_id: number;
  created_at: string;
}
export interface TaskOccurrence {
  id: string;
  organization_code: string;
  transaction_date: string;
  item_code: string | null;
  item_description: string | null;
}
export interface HistoryEntry {
  id: string;
  event_type: string;
  actor_id: number;
  actor_name?: string | null;
  created_at: string;
  payload: { comment?: string; status?: string; previous?: string };
}
export interface AlertItem {
  id: string;
  title: string;
  severity: string;
  event_type: string;
  created_at: string;
  read_at: string | null;
  body: {
    demo?: boolean;
    description?: string;
    observed?: string;
    threshold?: string;
    currency?: string;
    period?: string;
    link?: string;
    provisional?: boolean;
    component?: string;
  };
}
export interface Rule {
  id?: string;
  version?: number;
  name: string;
  event_type: string;
  enabled: boolean;
  dimension: string;
  filters: Record<string, string>;
  window_days: number;
  threshold: string;
  currency: string;
  severity: string;
  user_ids: number[];
  tier_ids: number[];
  channels: string[];
  cooldown_minutes: number;
  date_from: string | null;
  date_to: string | null;
}
