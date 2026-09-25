import { Component, computed, input, output, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { LanguageService } from '../../core/i18n/language.service';
import {
  AutomationExecutionStatus,
  AutomationSnapshotStatus,
  ExecutionDetail,
  ExecutionStepCode,
  ExecutionStepStatus,
} from './executions.models';
import { UiIcon } from '../../shared/components/ui-icon/ui-icon';

export interface ExecutionDetailFormatters {
  formatDateTime(value: string | null): string;
  formatDateSlash(value: string | null | undefined): string;
  formatDuration(value: number | null): string;
  formatTrigger(value: string): string;
  formatStatus(value: AutomationExecutionStatus | string): string;
  getStatusBadgeClass(value: AutomationExecutionStatus): string;
  formatSnapshotStatus(value: AutomationSnapshotStatus): string;
  getSnapshotBadgeClass(value: AutomationSnapshotStatus): string;
  formatStepName(value: ExecutionStepCode): string;
  formatStepStatus(value: ExecutionStepStatus): string;
  getStepStatusBadgeClass(value: ExecutionStepStatus): string;
}

@Component({
  selector: 'app-execution-detail-drawer',
  imports: [A11yModule, DecimalPipe, UiIcon],
  templateUrl: './execution-detail-drawer.html',
  styleUrl: './execution-detail-drawer.css',
})
export class ExecutionDetailDrawer {
  private readonly language = inject(LanguageService);

  readonly translations = computed(() => this.language.translations());
  readonly executionId = input.required<string>();
  readonly detail = input<ExecutionDetail | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly retrying = input(false);
  readonly formatters = input.required<ExecutionDetailFormatters>();
  readonly closed = output<void>();
  readonly retryRequested = output<void>();

  handleEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.closed.emit();
  }
}
