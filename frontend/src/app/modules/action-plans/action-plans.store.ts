import { Injectable, signal } from '@angular/core';
import { Person, WorkflowPage } from '../../core/governance/governance.models';
import {
  ActionPlanReportOption,
  ActionPlanReportVersionOption,
} from '../reports/reports.public-api';
import { ActionTask, HistoryEntry, Plan } from './action-plans.models';

@Injectable()
export class ActionPlansStore {
  readonly list = signal<WorkflowPage<Plan> | null>(null);
  readonly plan = signal<Plan | null>(null);
  readonly columns = signal<Record<string, WorkflowPage<ActionTask>>>({});
  readonly error = signal('');
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly editingPlan = signal(false);
  readonly editingTask = signal(false);
  readonly task = signal<ActionTask | null>(null);
  readonly history = signal<WorkflowPage<HistoryEntry> | null>(null);
  readonly people = signal<Person[]>([]);
  readonly reports = signal<ActionPlanReportOption[]>([]);
  readonly boardFilterOpen = signal(false);
  readonly versions = signal<ActionPlanReportVersionOption[]>([]);
}
