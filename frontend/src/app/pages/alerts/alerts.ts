import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../i18n/language.service';
import { ListFilterDateRange } from '../../shared/list-filters/list-filter-date-range';
import { ListFilterPopover } from '../../shared/list-filters/list-filter-popover';
import { ListFilterSelect } from '../../shared/list-filters/list-filter-select';
import { DelayedProgressSpinner } from '../../shared/list-view/delayed-progress-spinner/delayed-progress-spinner';
import { InlineAlert } from '../../shared/list-view/inline-alert/inline-alert';
import { ListFeedback } from '../../shared/list-view/list-feedback/list-feedback';
import { ListPagination } from '../../shared/list-view/list-pagination/list-pagination';
import { StatusBadge, StatusBadgeTone } from '../../shared/list-view/status-badge/status-badge';
import { ListPanel } from '../../shared/list-view/list-panel/list-panel';
import { UiIcon } from '../../ui-icon';
import { workflowCopy } from '../governance-copy';
import { AlertItem, Person, Rule, WorkflowPage } from '../governance.models';
import { GovernanceService } from '../governance.service';

@Component({
  selector: 'app-alerts',
  imports: [
    FormsModule,
    RouterLink,
    UiIcon,
    ListPanel,
    ListPagination,
    StatusBadge,
    ListFeedback,
    InlineAlert,
    DelayedProgressSpinner,
    ListFilterDateRange,
    ListFilterPopover,
    ListFilterSelect,
  ],
  templateUrl: './alerts.html',
  styleUrls: ['./alerts.css'],
})
export class Alerts {
  private readonly api = inject(GovernanceService);
  private readonly destroy = inject(DestroyRef);
  readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  readonly c = computed(() => workflowCopy[this.language.currentLanguage()]);
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
  readonly emails = signal<
    { id: string; subject: string; body: string; recipient: string; status: string }[]
  >([]);
  readonly showEmails = signal(false);
  readonly filterOpen = signal(false);
  readonly types = [
    'SCRAP_RELEVANT',
    'COST_EXCEEDED',
    'GOAL_ACHIEVED',
    'INGESTION_FAILED',
    'UPDATE_LATE',
    'REPORT_EXPORT_FAILED',
    'TASK_ASSIGNED',
    'TASK_DUE',
    'TASK_OVERDUE',
    'TASK_VERIFICATION',
    'TASK_VALIDATED',
    'REPORT_EXPORT_COMPLETED',
  ];
  readonly pageSize = 25;
  readonly allowedPageSizes = [25] as const;
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil((this.page()?.total || 0) / this.pageSize)),
  );
  readonly typeOptions = computed(() => [
    { value: '', label: this.c().all },
    ...this.types.map((value) => ({ value, label: value })),
  ]);
  readonly severityOptions = computed(() => [
    { value: '', label: this.c().all },
    ...['INFO', 'WARNING', 'CRITICAL', 'POSITIVE'].map((value) => ({ value, label: value })),
  ]);
  readonly unreadOptions = computed(() => [
    { value: '', label: this.c().all },
    { value: 'true', label: this.c().unread },
  ]);

  pageNumber = 1;
  rulePage = 1;
  emailPage = 1;
  severity = '';
  type = '';
  unread = '';
  dateFrom = '';
  dateTo = '';
  peopleSearch = '';
  filterKey = 'organization';
  filterValue = '';
  rule: Rule = this.emptyRule();

  constructor() {
    this.load();
    this.api
      .capabilities()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (value) => this.available.set(value.notifications_available),
        error: (e) => this.fail(e),
      });
  }

  emptyRule(): Rule {
    return {
      name: '',
      event_type: 'SCRAP_RELEVANT',
      enabled: true,
      dimension: 'occurrence',
      filters: {},
      window_days: 30,
      threshold: '1000',
      currency: 'USD',
      severity: 'WARNING',
      user_ids: [],
      tier_ids: [],
      channels: ['FRONT', 'EMAIL'],
      cooldown_minutes: 1440,
      date_from: null,
      date_to: null,
    };
  }

  fail(e: { status?: number; error?: { detail?: string } }) {
    this.error.set(e.status === 409 ? this.c().conflict : e.error?.detail || this.c().error);
    this.busy.set(false);
    this.loading.set(false);
  }

  load() {
    this.loading.set(true);
    const params: Record<string, string | number | boolean> = { page: this.pageNumber };
    if (this.severity) params['severity'] = this.severity;
    if (this.type) params['event_type'] = this.type;
    if (this.unread) params['unread'] = this.unread === 'true';
    if (this.dateFrom) params['date_from'] = this.dateFrom + 'T00:00:00Z';
    if (this.dateTo) params['date_to'] = this.dateTo + 'T23:59:59Z';
    this.api
      .alerts(params)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loading.set(false);
        },
        error: (e) => this.fail(e),
      });
  }

  clearFilters(): void {
    this.type = '';
    this.severity = '';
    this.unread = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.pageNumber = 1;
    this.filterOpen.set(false);
    this.load();
  }

  activeFiltersCount(): number {
    return [this.type, this.severity, this.unread, this.dateFrom, this.dateTo].filter(Boolean)
      .length;
  }

  calendarLocale(): string {
    const language = this.language.currentLanguage();
    return language === 'pt' ? 'pt-BR' : language === 'ko' ? 'ko-KR' : 'en-US';
  }

  nextPage(): void {
    if (this.page()?.has_next) {
      this.pageNumber++;
      this.load();
    }
  }

  previousPage(): void {
    if (this.pageNumber > 1) {
      this.pageNumber--;
      this.load();
    }
  }

  getSeverityTone(severity: string): StatusBadgeTone {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'danger';
      case 'WARNING':
        return 'warning';
      case 'POSITIVE':
        return 'success';
      case 'INFO':
        return 'info';
      default:
        return 'neutral';
    }
  }

  read(alert: AlertItem) {
    this.api
      .read(alert.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }

  loadRules() {
    this.settings.set(true);
    this.api
      .rules(this.rulePage)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (r) => this.rules.set(r), error: (e) => this.fail(e) });
  }

  edit(rule?: Rule) {
    this.rule = rule ? structuredClone(rule) : this.emptyRule();
    const entry = Object.entries(this.rule.filters)[0];
    this.filterKey = entry?.[0] || 'organization';
    this.filterValue = entry?.[1] || '';
    this.editing.set(true);
    this.loadPeople();
    this.api
      .tiers()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (page) => this.tiers.set(page.data), error: (e) => this.fail(e) });
  }

  loadPeople() {
    this.api
      .people(this.peopleSearch)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (p) => this.people.set(p), error: (e) => this.fail(e) });
  }

  person(id: number, checked: boolean) {
    this.rule.user_ids = checked
      ? [...new Set([...this.rule.user_ids, id])]
      : this.rule.user_ids.filter((v) => v !== id);
  }

  setTier(id: number, checked: boolean) {
    this.rule.tier_ids = checked
      ? [...new Set([...this.rule.tier_ids, id])]
      : this.rule.tier_ids.filter((value) => value !== id);
  }

  channel(name: string, checked: boolean) {
    this.rule.channels = checked
      ? [...new Set([...this.rule.channels, name])]
      : this.rule.channels.filter((v) => v !== name);
  }

  changeType() {
    this.rule.channels = [
      'TASK_ASSIGNED',
      'TASK_DUE',
      'TASK_VERIFICATION',
      'TASK_VALIDATED',
      'REPORT_EXPORT_COMPLETED',
    ].includes(this.rule.event_type)
      ? ['EMAIL']
      : ['FRONT', 'EMAIL'];
    if (['COST_EXCEEDED', 'GOAL_ACHIEVED'].includes(this.rule.event_type))
      this.rule.dimension = 'organization';
    this.rule.severity = this.rule.event_type === 'GOAL_ACHIEVED' ? 'POSITIVE' : 'WARNING';
  }

  save() {
    if (this.busy() || !this.rule.name.trim()) return;
    this.rule.filters = this.filterValue ? { [this.filterKey]: this.filterValue } : {};
    this.rule.date_from = this.rule.date_from || null;
    this.rule.date_to = this.rule.date_to || null;
    this.busy.set(true);
    this.api
      .saveRule(this.rule)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.editing.set(false);
          this.loadRules();
        },
        error: (e) => this.fail(e),
      });
  }

  loadEmails() {
    this.showEmails.set(true);
    this.api
      .emails(this.emailPage)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (e) => this.emails.set(e), error: (e) => this.fail(e) });
  }

  safeLink(value?: string) {
    return value?.startsWith('/') && !value.startsWith('//') ? value : '/alertas';
  }
}
