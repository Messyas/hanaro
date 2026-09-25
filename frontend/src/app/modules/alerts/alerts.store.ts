import { Injectable, signal } from '@angular/core';
import { Person, WorkflowPage } from '../../core/governance/governance.models';
import { AlertItem, NotificationEmail, Rule } from './alerts.models';

@Injectable()
export class AlertsStore {
  readonly page = signal<WorkflowPage<AlertItem> | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly available = signal(true);
  readonly loading = signal(false);
  readonly editing = signal(false);
  readonly settings = signal(false);
  readonly rules = signal<WorkflowPage<Rule> | null>(null);
  readonly people = signal<Person[]>([]);
  readonly tiers = signal<Person[]>([]);
  readonly emails = signal<NotificationEmail[]>([]);
  readonly showEmails = signal(false);
  readonly filterOpen = signal(false);
}
