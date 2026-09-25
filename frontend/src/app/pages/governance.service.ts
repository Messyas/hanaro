import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ActionTask,
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
  plans(
    page = 1,
    pageSize = 25,
    filters: {
      search?: string;
      status?: 'OPEN' | 'COMPLETED';
      sort?: 'newest' | 'oldest' | 'title';
    } = {},
  ) {
    return this.http.get<WorkflowPage<Plan>>(`${this.base}/action-plans`, {
      params: {
        page,
        page_size: pageSize,
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.sort ? { sort: filters.sort } : {}),
      },
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
  board(id: string, status: TaskState, page = 1, search = '', priority = '') {
    return this.http.get<WorkflowPage<ActionTask>>(`${this.base}/action-plans/${id}/tasks`, {
      params: { status, page, search, ...(priority ? { priority } : {}) },
    });
  }
  task(id: string) {
    return this.http.get<ActionTask>(`${this.base}/actions/${id}`);
  }
  saveTask(planId: string, data: object, taskId?: string) {
    return taskId
      ? this.http.put<ActionTask>(`${this.base}/action-plans/${planId}/tasks/${taskId}`, data)
      : this.http.post<ActionTask>(`${this.base}/action-plans/${planId}/tasks`, data);
  }
  uploadEvidence(taskId: string, version: number, file: File) {
    const data = new FormData();
    data.append('file', file, file.name);
    data.append('expected_version', String(version));
    return this.http.post<ActionTask>(`${this.base}/actions/${taskId}/evidence`, data);
  }
  removeEvidence(taskId: string, evidenceId: string, version: number) {
    return this.http.delete<ActionTask>(`${this.base}/actions/${taskId}/evidence/${evidenceId}`, {
      params: { expected_version: version },
    });
  }
  downloadEvidence(taskId: string, evidenceId: string) {
    return this.http.get(`${this.base}/actions/${taskId}/evidence/${evidenceId}/download`, {
      responseType: 'blob',
    });
  }
  command(task: ActionTask, command: string, extra: object = {}) {
    return this.http.post<ActionTask>(`${this.base}/actions/${task.id}/commands`, {
      expected_version: task.version,
      command,
      ...extra,
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
