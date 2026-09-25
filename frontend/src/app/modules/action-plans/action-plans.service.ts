import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ActionTask,
  ActionTaskBoardQuery,
  ActionTaskCommand,
  HistoryEntry,
  Plan,
  SaveActionTaskCommand,
  SavePlanCommand,
} from './action-plans.models';
import { WorkflowPage } from '../../core/governance/governance.models';

@Injectable({ providedIn: 'root' })
export class ActionPlansService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

  plans(page = 1, pageSize = 25) {
    return this.http.get<WorkflowPage<Plan>>(`${this.base}/action-plans`, {
      params: { page, page_size: pageSize },
    });
  }

  plan(planId: string) {
    return this.http.get<Plan>(`${this.base}/action-plans/${planId}`);
  }

  savePlan(command: SavePlanCommand, planId?: string) {
    return planId
      ? this.http.put<Plan>(`${this.base}/action-plans/${planId}`, command)
      : this.http.post<Plan>(`${this.base}/action-plans`, command);
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

  task(taskId: string) {
    return this.http.get<ActionTask>(`${this.base}/actions/${taskId}`);
  }

  saveTask(planId: string, command: SaveActionTaskCommand, taskId?: string) {
    return taskId
      ? this.http.put<ActionTask>(`${this.base}/action-plans/${planId}/tasks/${taskId}`, command)
      : this.http.post<ActionTask>(`${this.base}/action-plans/${planId}/tasks`, command);
  }

  sendCommand(task: ActionTask, command: ActionTaskCommand) {
    return this.http.post<ActionTask>(`${this.base}/actions/${task.id}/commands`, {
      expected_version: task.version,
      ...command,
    });
  }

  history(taskId: string, page = 1) {
    return this.http.get<WorkflowPage<HistoryEntry>>(`${this.base}/actions/${taskId}/history`, {
      params: { page },
    });
  }
}
