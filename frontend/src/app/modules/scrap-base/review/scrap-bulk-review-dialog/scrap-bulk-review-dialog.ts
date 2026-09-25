import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../../core/i18n/language.service';
import { InlineAlert } from '../../../../shared/components/list-view/inline-alert/inline-alert';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { ScrapReview, ScrapReviewBulkResult } from '../scrap-review.models';
import { ScrapBulkReviewCoordinator } from '../scrap-bulk-review.coordinator';
import { ScrapReviewTemplate } from '../../templates/scrap-template.models';

@Component({
  selector: 'app-scrap-bulk-review-dialog',
  imports: [InlineAlert, UiIcon],
  templateUrl: './scrap-bulk-review-dialog.html',
  styleUrl: './scrap-bulk-review-dialog.css',
})
export class ScrapBulkReviewDialog implements AfterViewInit {
  private readonly workflow = inject(ScrapBulkReviewCoordinator);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('dialogTitle') private readonly dialogTitle?: ElementRef<HTMLElement>;

  readonly t = computed(() => this.language.translations());
  readonly selectedOccurrenceIds = input<string[]>([]);
  readonly preselectedReference = input<ScrapReview | null>(null);
  readonly preselectedTemplate = input<ScrapReviewTemplate | null>(null);

  readonly closed = output<void>();
  readonly bulkCompleted = output<ScrapReviewBulkResult>();

  readonly copyAttachments = signal(false);
  readonly isSubmitting = this.workflow.isSubmitting.asReadonly();
  readonly error = computed(() => {
    const error = this.workflow.error();
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return null;
    const candidate = error as { error?: { detail?: string }; message?: string };
    return candidate.error?.detail || candidate.message || this.t().scrapTemplateUpdateError;
  });
  readonly bulkResult = this.workflow.bulkResult.asReadonly();

  readonly sourceName = computed(
    () => this.preselectedTemplate()?.name || this.preselectedReference()?.title || '',
  );
  readonly sourceType = computed(
    () =>
      this.preselectedTemplate()?.defect_type?.name ||
      this.preselectedReference()?.defect_type?.name ||
      this.t().scrapTemplateNoType,
  );
  readonly sourceDescription = computed(
    () => this.preselectedTemplate()?.description || this.preselectedReference()?.description || '',
  );
  readonly canCopyAttachments = computed(
    () => !this.preselectedTemplate() && (this.preselectedReference()?.attachments.length ?? 0) > 0,
  );

  ngAfterViewInit(): void {
    queueMicrotask(() => this.dialogTitle?.nativeElement.focus());
  }

  @HostListener('window:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.isSubmitting()) {
      event.stopPropagation();
      this.close();
    }
  }

  toggleCopyAttachments(): void {
    this.copyAttachments.update((value) => !value);
  }

  executeBulk(): void {
    this.workflow
      .executeBulk(
        this.copyAttachments(),
        this.selectedOccurrenceIds(),
        this.preselectedTemplate(),
        this.preselectedReference(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.bulkCompleted.emit(result));
  }

  translateSkipReason(reason: 'NOT_ACTIVE' | 'ALREADY_REVIEWED'): string {
    return reason === 'NOT_ACTIVE'
      ? this.t().scrapBulkReasonNotActive
      : this.t().scrapBulkReasonAlreadyReviewed;
  }

  close(): void {
    this.workflow.closeBulkDialog();
    this.closed.emit();
  }
}
