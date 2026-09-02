import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { LanguageService } from '../../../i18n/language.service';
import { InlineAlert } from '../../../shared/list-view/inline-alert/inline-alert';
import { UiIcon } from '../../../ui-icon';
import { ScrapListItem, ScrapPage } from '../scrap-base.models';
import { ScrapBaseService } from '../scrap-base.service';
import { ScrapReview, ScrapReviewBulkCreate, ScrapReviewBulkResult } from '../scrap-review.models';
import { ScrapReviewService } from '../scrap-review.service';
import { ScrapReviewTemplate } from '../scrap-template.models';
import { ScrapTemplateService } from '../scrap-template.service';

@Component({
  selector: 'app-scrap-bulk-review-dialog',
  imports: [InlineAlert, UiIcon],
  templateUrl: './scrap-bulk-review-dialog.html',
  styleUrl: './scrap-bulk-review-dialog.css',
})
export class ScrapBulkReviewDialog implements OnInit {
  private readonly scrapBaseService = inject(ScrapBaseService);
  private readonly reviewService = inject(ScrapReviewService);
  private readonly templateService = inject(ScrapTemplateService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly t = computed(() => this.language.translations());

  readonly selectedOccurrenceIds = input<string[]>([]);
  readonly preselectedReference = input<ScrapReview | null>(null);
  readonly preselectedTemplate = input<ScrapReviewTemplate | null>(null);

  readonly closed = output<void>();
  readonly bulkCompleted = output<ScrapReviewBulkResult>();

  readonly templates = computed(() => this.templateService.templates());
  readonly templatesLoading = computed(() => this.templateService.loading());

  readonly searchSubject = new Subject<string>();
  readonly searchFilter = signal('');
  readonly searching = signal(false);
  readonly candidateOccurrences = signal<ScrapListItem[]>([]);

  readonly selectedReferenceReview = signal<ScrapReview | null>(null);
  readonly copyAttachments = signal(false);
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly bulkResult = signal<ScrapReviewBulkResult | null>(null);

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (!this.isSubmitting()) {
      this.close();
    }
  }

  ngOnInit(): void {
    this.templateService.loadTemplates().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    const tpl = this.preselectedTemplate();
    if (tpl) {
      this.selectTemplate(tpl);
    } else {
      const pre = this.preselectedReference();
      if (pre) {
        this.selectedReferenceReview.set(pre);
      }
    }

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => {
        this.searchFilter.set(query.trim());
        this.searchReferenceReports();
      });

    this.searchReferenceReports();
  }

  selectTemplate(tpl: ScrapReviewTemplate): void {
    this.error.set(null);
    if (tpl.source_review_id) {
      this.searching.set(true);
      this.reviewService
        .getReview(tpl.source_review_id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (rev) => {
            this.selectedReferenceReview.set(rev);
            this.searching.set(false);
          },
          error: () => {
            this.searching.set(false);
            this.selectedReferenceReview.set({
              id: tpl.source_review_id!,
              occurrence_id: '',
              status: 'REVIEWED',
              defect_type: tpl.defect_type || null,
              responsible_user_id: tpl.created_by_user_id,
              responsible_name: '',
              title: tpl.title || tpl.name,
              description: tpl.description,
              version: 1,
              source_review_id: null,
              bulk_operation_id: null,
              reviewed_at: tpl.created_at,
              created_at: tpl.created_at,
              updated_at: tpl.updated_at,
              attachments: [],
            });
          },
        });
    } else {
      this.selectedReferenceReview.set({
        id: tpl.id,
        occurrence_id: '',
        status: 'REVIEWED',
        defect_type: tpl.defect_type || null,
        responsible_user_id: tpl.created_by_user_id,
        responsible_name: '',
        title: tpl.title || tpl.name,
        description: tpl.description,
        version: 1,
        source_review_id: null,
        bulk_operation_id: null,
        reviewed_at: tpl.created_at,
        created_at: tpl.created_at,
        updated_at: tpl.updated_at,
        attachments: [],
      });
    }
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  searchReferenceReports(): void {
    this.searching.set(true);
    this.scrapBaseService
      .list({
        review_status: 'REVIEWED',
        search: this.searchFilter() || undefined,
        page: 1,
        page_size: 15,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page: ScrapPage) => {
          this.candidateOccurrences.set(page.items);
          this.searching.set(false);
        },
        error: () => {
          this.candidateOccurrences.set([]);
          this.searching.set(false);
        },
      });
  }

  selectReferenceOccurrence(item: ScrapListItem): void {
    if (!item.occurrence_id) return;
    this.error.set(null);
    this.searching.set(true);

    this.reviewService
      .getReview(item.occurrence_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rev) => {
          this.selectedReferenceReview.set(rev);
          this.searching.set(false);
        },
        error: (err) => {
          this.searching.set(false);
          this.error.set(
            err.error?.detail || err.message || 'Erro ao carregar relatório selecionado.',
          );
        },
      });
  }

  clearReference(): void {
    this.selectedReferenceReview.set(null);
  }

  toggleCopyAttachments(): void {
    this.copyAttachments.update((v) => !v);
  }

  executeBulk(): void {
    const ref = this.selectedReferenceReview();
    const ids = this.selectedOccurrenceIds();
    if (!ref || ids.length === 0 || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.error.set(null);

    const payload: ScrapReviewBulkCreate = {
      reference_review_id: ref.id,
      occurrence_ids: ids,
      copy_attachments: this.copyAttachments(),
    };

    this.reviewService
      .bulkCreate(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          this.bulkResult.set(result);
          this.bulkCompleted.emit(result);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.error.set(
            err.error?.detail || err.message || 'Erro ao processar operação em massa.',
          );
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
