import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ActionTask,
  ActionTaskBoardQuery,
  ActionTaskCommand,
  AlertItem,
  HistoryEntry,
  Person,
  Plan,
  Rule,
  TaskState,
  WorkflowPage,
} from './governance.models';

@Injectable({ providedIn: 'root' })
export class GovernanceService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';
  plans(page = 1, pageSize = 25) {
    return this.http.get<WorkflowPage<Plan>>(`${this.base}/action-plans`, {
      params: { page, page_size: pageSize },
    });
  }
  plan(id: string) {
    return this.http.get<Plan>(`${this.base}/action-plans/${id}`);
  }
  savePlan(data: object, id?: string) {
    return id
      ? this.http.put<Plan>(`${this.base}/action-plans/${id}`, data)
      : this.http.post<Plan>(`${this.base}/action-plans`, data);
  }
  getBoard(query: ActionTaskBoardQuery) {
    return this.http.get<WorkflowPage<ActionTask>>(
      `${this.base}/action-plans/${query.planId}/tasks`,
      {
        params: {
          status: query.status,
          page: query.page,
          search: query.search ?? '',
          ...(query.priority ? { priority: query.priority } : {}),
        },
      },
    );
  }
  task(id: string) {
    return this.http.get<ActionTask>(`${this.base}/actions/${id}`);
  }
  saveTask(planId: string, data: object, taskId?: string) {
    return taskId
      ? this.http.put<ActionTask>(`${this.base}/action-plans/${planId}/tasks/${taskId}`, data)
      : this.http.post<ActionTask>(`${this.base}/action-plans/${planId}/tasks`, data);
  }
  command(task: ActionTask, action: ActionTaskCommand) {
    return this.http.post<ActionTask>(`${this.base}/actions/${task.id}/commands`, {
      expected_version: task.version,
      ...action,
    });
  }
  history(id: string, page = 1) {
    return this.http.get<WorkflowPage<HistoryEntry>>(`${this.base}/actions/${id}/history`, {
      params: { page },
    });
  }
  people(search = '', page = 1) {
    return this.http.get<Person[]>(`${this.base}/governance/participants`, {
      params: { search, page },
    });
  }
  tiers() {
    return this.http.get<{ data: Person[] }>(`${this.base}/tiers/`, {
      params: { page: 1, items_per_page: 100 },
    });
  }
  alerts(params: Record<string, string | number | boolean>) {
    return this.http.get<WorkflowPage<AlertItem>>(`${this.base}/alerts`, { params });
  }
  read(id: string) {
    return this.http.post(`${this.base}/alerts/${id}/read`, {});
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
    return this.http.get<
      { id: string; subject: string; body: string; recipient: string; status: string }[]
    >(`${this.base}/notification-emails`, { params: { page } });
  }
  capabilities() {
    return this.http.get<{ exports_available: boolean; notifications_available: boolean }>(
      `${this.base}/governance/capabilities`,
    );
  }
}
