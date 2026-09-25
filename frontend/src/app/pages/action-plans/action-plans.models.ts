import { Person } from '../governance.models';

export type TaskState = 'PLANNED' | 'IN_PROGRESS' | 'UNDER_VERIFICATION' | 'COMPLETED';
export type MovableTaskState = Exclude<TaskState, 'COMPLETED'>;

export type ActionTaskCommand =
  | { command: 'move'; status: MovableTaskState; position: number }
  | { command: 'validate' }
  | { command: 'reopen' }
  | { command: 'comment'; comment: string };

export interface ActionTaskBoardQuery {
  planId: string;
  status: TaskState;
  page: number;
  search?: string;
  priority?: string;
}

export interface SavePlanCommand {
  title: string;
  description: string;
  report_version_ids: string[];
  expected_version?: number;
  status: 'OPEN' | 'COMPLETED';
}

export interface SaveActionTaskCommand {
  title: string;
  description: string;
  priority: string;
  due_at: string | null;
  blocked_reason: string | null;
  participant_ids: number[];
  occurrence_ids: string[];
  expected_version?: number;
}

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
  due_at: string | null;
  blocked_reason: string | null;
  version: number;
  status: TaskState;
  position: number;
  participants: Person[];
  occurrence_ids?: string[];
}

export interface HistoryEntry {
  id: string;
  event_type: string;
  actor_id: number;
  created_at: string;
  payload: { comment?: string; status?: string; previous?: string };
}
