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

export interface AlertListQuery {
  page: number;
  severity?: string;
  eventType?: string;
  unread?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface NotificationEmail {
  id: string;
  subject: string;
  body: string;
  recipient: string;
  status: string;
}
