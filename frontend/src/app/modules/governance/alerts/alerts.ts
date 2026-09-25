import { Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../../core/i18n/language.service';
import { GovernanceCapabilitiesService } from '../governance-capabilities.service';
import { ListFilterDateRange } from '../../../shared/components/list-filters/list-filter-date-range';
import { ListFilterPopover } from '../../../shared/components/list-filters/list-filter-popover';
import { ListFilterSelect } from '../../../shared/components/list-filters/list-filter-select';
import { DelayedProgressSpinner } from '../../../shared/components/list-view/delayed-progress-spinner/delayed-progress-spinner';
import { InlineAlert } from '../../../shared/components/list-view/inline-alert/inline-alert';
import { ListFeedback } from '../../../shared/components/list-view/list-feedback/list-feedback';
import { ListPagination } from '../../../shared/components/list-view/list-pagination/list-pagination';
import {
  StatusBadge,
  StatusBadgeTone,
} from '../../../shared/components/list-view/status-badge/status-badge';
import { ListPanel } from '../../../shared/components/list-view/list-panel/list-panel';
import { UiIcon } from '../../../shared/components/ui-icon/ui-icon';
import { workflowCopy } from '../governance-copy';
import { AlertItem, Rule } from './alerts.models';
import { AlertsService } from './alerts.service';
import { AlertsStore } from './alerts.store';
import { GovernanceDirectoryService } from '../governance-directory.service';

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
  providers: [AlertsStore],
})
export class Alerts {
  private readonly store = inject(AlertsStore);
  private readonly alertsApi = inject(AlertsService);
  private readonly directoryApi = inject(GovernanceDirectoryService);
  private readonly capabilitiesApi = inject(GovernanceCapabilitiesService);
  private readonly destroy = inject(DestroyRef);
  readonly language = inject(LanguageService);
  readonly c = computed(() => workflowCopy[this.language.currentLanguage()]);
  readonly page = this.store.page;
  readonly error = this.store.error;
  readonly busy = this.store.busy;
  readonly available = this.store.available;
  readonly loading = this.store.loading;
  readonly editing = this.store.editing;
  readonly settings = this.store.settings;
  readonly rules = this.store.rules;
  readonly people = this.store.people;
  readonly tiers = this.store.tiers;
  readonly emails = this.store.emails;
  readonly showEmails = this.store.showEmails;
  readonly filterOpen = this.store.filterOpen;
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
    ...this.types.map((value) => ({ value, label: this.formatEventType(value) })),
  ]);
  readonly severityOptions = computed(() => [
    { value: '', label: this.c().all },
    ...['INFO', 'WARNING', 'CRITICAL', 'POSITIVE'].map((value) => ({
      value,
      label: this.formatSeverity(value),
    })),
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
    this.capabilitiesApi
      .get()
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
    this.alertsApi
      .list({
        page: this.pageNumber,
        ...(this.severity ? { severity: this.severity } : {}),
        ...(this.type ? { eventType: this.type } : {}),
        ...(this.unread ? { unread: this.unread === 'true' } : {}),
        ...(this.dateFrom ? { dateFrom: `${this.dateFrom}T00:00:00Z` } : {}),
        ...(this.dateTo ? { dateTo: `${this.dateTo}T23:59:59Z` } : {}),
      })
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

  formatSeverity(severity: string): string {
    const labels: Record<string, string> = {
      INFO: this.c().severityInfo,
      WARNING: this.c().severityWarning,
      CRITICAL: this.c().severityCritical,
      POSITIVE: this.c().severityPositive,
    };
    return labels[severity.toUpperCase()] ?? severity;
  }

  formatEventType(eventType: string): string {
    const labels: Record<string, string> = {
      SCRAP_RELEVANT: this.c().alertTypeScrapRelevant,
      COST_EXCEEDED: this.c().alertTypeCostExceeded,
      GOAL_ACHIEVED: this.c().alertTypeGoalAchieved,
      INGESTION_FAILED: this.c().alertTypeIngestionFailed,
      UPDATE_LATE: this.c().alertTypeUpdateLate,
      REPORT_EXPORT_FAILED: this.c().alertTypeReportExportFailed,
      TASK_ASSIGNED: this.c().alertTypeTaskAssigned,
      TASK_DUE: this.c().alertTypeTaskDue,
      TASK_OVERDUE: this.c().alertTypeTaskOverdue,
      TASK_VERIFICATION: this.c().alertTypeTaskVerification,
      TASK_VALIDATED: this.c().alertTypeTaskValidated,
      REPORT_EXPORT_COMPLETED: this.c().alertTypeReportExportCompleted,
    };
    return labels[eventType] ?? eventType;
  }

  alertTitle(alert: AlertItem): string {
    if (!alert.body?.demo) return alert.title;
    const titles: Record<string, string> = {
      TASK_OVERDUE: this.c().demoAlertTaskOverdueTitle,
      COST_EXCEEDED: this.c().demoAlertCostExceededTitle,
      TASK_ASSIGNED: this.c().demoAlertTaskAssignedTitle,
      REPORT_EXPORT_COMPLETED: this.c().demoAlertExportCompletedTitle,
      SCRAP_RELEVANT: this.c().demoAlertScrapRelevantTitle,
    };
    return titles[alert.event_type] ?? alert.title;
  }

  alertDescription(alert: AlertItem): string | undefined {
    if (!alert.body?.demo) return alert.body?.description;
    const descriptions: Record<string, string> = {
      TASK_OVERDUE: this.c().demoAlertTaskOverdueDescription,
      COST_EXCEEDED: this.c().demoAlertCostExceededDescription,
      TASK_ASSIGNED: this.c().demoAlertTaskAssignedDescription,
      REPORT_EXPORT_COMPLETED: this.c().demoAlertExportCompletedDescription,
      SCRAP_RELEVANT: this.c().demoAlertScrapRelevantDescription,
    };
    return descriptions[alert.event_type] ?? alert.body?.description;
  }

  read(alert: AlertItem) {
    this.alertsApi
      .markAsRead(alert.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }

  loadRules() {
    this.settings.set(true);
    this.alertsApi
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
    this.directoryApi
      .tiers()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (page) => this.tiers.set(page.data), error: (e) => this.fail(e) });
  }

  loadPeople() {
    this.directoryApi
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
    this.alertsApi
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
    this.alertsApi
      .emails(this.emailPage)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (e) => this.emails.set(e), error: (e) => this.fail(e) });
  }

  safeLink(value?: string) {
    return value?.startsWith('/') && !value.startsWith('//') ? value : '/alertas';
  }
}
