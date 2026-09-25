import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AlertItem, AlertListQuery, NotificationEmail, Rule } from './alerts.models';
import { WorkflowPage } from '../governance.models';

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

  list(query: AlertListQuery) {
    let params = new HttpParams().set('page', query.page);
    if (query.severity) params = params.set('severity', query.severity);
    if (query.eventType) params = params.set('event_type', query.eventType);
    if (query.unread !== undefined) params = params.set('unread', query.unread);
    if (query.dateFrom) params = params.set('date_from', query.dateFrom);
    if (query.dateTo) params = params.set('date_to', query.dateTo);
    return this.http.get<WorkflowPage<AlertItem>>(`${this.base}/alerts`, { params });
  }

  markAsRead(alertId: string) {
    return this.http.post(`${this.base}/alerts/${alertId}/read`, {});
  }

  rules(page = 1) {
    return this.http.get<WorkflowPage<Rule>>(`${this.base}/notification-rules`, {
      params: { page },
    });
  }

  saveRule(rule: Rule) {
    const { id, version, ...data } = rule;
    return id
      ? this.http.put<Rule>(`${this.base}/notification-rules/${id}`, {
          ...data,
          expected_version: version,
        })
      : this.http.post<Rule>(`${this.base}/notification-rules`, data);
  }

  emails(page = 1) {
    return this.http.get<NotificationEmail[]>(`${this.base}/notification-emails`, {
      params: { page },
    });
  }
}
