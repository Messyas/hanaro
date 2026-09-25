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
import { LanguageService } from '../../../core/i18n/language.service';
import { InlineAlert } from '../../../shared/components/list-view/inline-alert/inline-alert';
import { UiIcon } from '../../../shared/components/ui-icon/ui-icon';
import { ScrapReview, ScrapReviewBulkCreate, ScrapReviewBulkResult } from '../scrap-review.models';
import { ScrapReviewService } from '../scrap-review.service';
import { ScrapReviewTemplate } from '../scrap-template.models';

@Component({
  selector: 'app-scrap-bulk-review-dialog',
  imports: [InlineAlert, UiIcon],
  templateUrl: './scrap-bulk-review-dialog.html',
  styleUrl: './scrap-bulk-review-dialog.css',
})
export class ScrapBulkReviewDialog implements AfterViewInit {
  private readonly reviewService = inject(ScrapReviewService);
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
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly bulkResult = signal<ScrapReviewBulkResult | null>(null);

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
    const ids = this.selectedOccurrenceIds();
    const template = this.preselectedTemplate();
    const reference = this.preselectedReference();
    if (ids.length === 0 || (!template && !reference) || this.isSubmitting()) return;

    const payload: ScrapReviewBulkCreate = {
      occurrence_ids: ids,
      copy_attachments: this.canCopyAttachments() && this.copyAttachments(),
      ...(template ? { template_id: template.id } : { reference_review_id: reference!.id }),
    };

    this.isSubmitting.set(true);
    this.error.set(null);
    this.reviewService
      .bulkCreate(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          this.bulkResult.set(result);
          this.bulkCompleted.emit(result);
        },
        error: (error: { error?: { detail?: string }; message?: string }) => {
          this.isSubmitting.set(false);
          this.error.set(error.error?.detail || error.message || this.t().scrapTemplateUpdateError);
        },
      });
  }

  translateSkipReason(reason: 'NOT_ACTIVE' | 'ALREADY_REVIEWED'): string {
    return reason === 'NOT_ACTIVE'
      ? this.t().scrapBulkReasonNotActive
      : this.t().scrapBulkReasonAlreadyReviewed;
  }

  close(): void {
    this.closed.emit();
  }
}
