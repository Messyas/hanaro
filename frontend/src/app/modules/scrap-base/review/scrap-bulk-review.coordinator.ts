import { Injectable, inject, signal, computed } from '@angular/core';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, finalize, tap } from 'rxjs';
import { ScrapListItem } from '../list/scrap-base.models';
import { ScrapReviewBulkCreate, ScrapReview, ScrapReviewBulkResult } from './scrap-review.models';
import { ScrapReviewService } from './scrap-review.service';
import { ScrapReviewTemplate } from '../templates/scrap-template.models';

const MAX_BULK_SELECTION = 500;

export type ScrapSelectionChange = 'selected' | 'deselected' | 'ignored' | 'limit-reached';

@Injectable({ providedIn: 'root' })
export class ScrapBulkReviewCoordinator {
  private readonly reviewService = inject(ScrapReviewService);
  private readonly destroyRef = inject(DestroyRef);

  readonly selectionMode = signal(false);
  readonly selectedOccurrenceIds = signal<Set<string>>(new Set());
  readonly activeTemplate = signal<ScrapReviewTemplate | null>(null);
  readonly activeReferenceReview = signal<ScrapReview | null>(null);
  readonly showBulkDialog = signal(false);
  readonly isSubmitting = signal(false);
  readonly error = signal<unknown | null>(null);
  readonly bulkResult = signal<ScrapReviewBulkResult | null>(null);
  readonly selectedCount = computed(() => this.selectedOccurrenceIds().size);

  isItemSelectable(item: ScrapListItem | null | undefined): boolean {
    return Boolean(
      item?.occurrence_id &&
      item.occurrence_status === 'ACTIVE' &&
      item.review_status !== 'REVIEWED',
    );
  }

  toggleSelectionMode(): boolean {
    const enabled = !this.selectionMode();
    this.selectionMode.set(enabled);
    this.clearSelection();
    if (!enabled) this.clearSource();
    return enabled;
  }

  toggleItemSelection(
    target: ScrapListItem | string | null,
    pageItems: readonly ScrapListItem[],
  ): ScrapSelectionChange {
    if (!target) return 'ignored';

    const occurrenceId = typeof target === 'string' ? target : target.occurrence_id;
    if (!occurrenceId) return 'ignored';

    const item =
      typeof target === 'string'
        ? pageItems.find((candidate) => candidate.occurrence_id === target)
        : target;
    if (!this.isItemSelectable(item)) return 'ignored';

    const selected = new Set(this.selectedOccurrenceIds());
    if (selected.has(occurrenceId)) {
      selected.delete(occurrenceId);
      this.selectedOccurrenceIds.set(selected);
      return 'deselected';
    }
    if (selected.size >= MAX_BULK_SELECTION) return 'limit-reached';

    selected.add(occurrenceId);
    this.selectedOccurrenceIds.set(selected);
    return 'selected';
  }

  toggleSelectAllOnPage(items: readonly ScrapListItem[]): boolean {
    const eligible = items.filter((item) => this.isItemSelectable(item));
    const selected = new Set(this.selectedOccurrenceIds());
    const allSelected =
      eligible.length > 0 && eligible.every((item) => selected.has(item.occurrence_id!));

    if (allSelected) {
      for (const item of eligible) selected.delete(item.occurrence_id!);
    } else {
      for (const item of eligible) {
        if (selected.has(item.occurrence_id!)) continue;
        if (selected.size >= MAX_BULK_SELECTION) {
          this.selectedOccurrenceIds.set(selected);
          return true;
        }
        selected.add(item.occurrence_id!);
      }
    }
    this.selectedOccurrenceIds.set(selected);
    return false;
  }

  isAllPageSelected(items: readonly ScrapListItem[]): boolean {
    const eligible = items.filter((item) => this.isItemSelectable(item));
    if (eligible.length === 0) return false;
    const selected = this.selectedOccurrenceIds();
    return eligible.every((item) => selected.has(item.occurrence_id!));
  }

  clearSelection(): void {
    this.selectedOccurrenceIds.set(new Set());
  }

  clearSource(): void {
    this.activeTemplate.set(null);
    this.activeReferenceReview.set(null);
  }

  openBulkDialog(): boolean {
    if (this.selectedCount() === 0 || (!this.activeTemplate() && !this.activeReferenceReview())) {
      return false;
    }
    this.error.set(null);
    this.bulkResult.set(null);
    this.showBulkDialog.set(true);
    return true;
  }

  closeBulkDialog(): void {
    if (!this.isSubmitting()) this.showBulkDialog.set(false);
  }

  executeBulk(
    copyAttachments: boolean,
    selectedIds: readonly string[] = [...this.selectedOccurrenceIds()],
    template: ScrapReviewTemplate | null = this.activeTemplate(),
    reference: ScrapReview | null = this.activeReferenceReview(),
  ): Observable<ScrapReviewBulkResult> {
    const occurrenceIds = [...selectedIds];
    if (this.isSubmitting() || occurrenceIds.length === 0 || (!template && !reference))
      return EMPTY;

    const payload: ScrapReviewBulkCreate = {
      occurrence_ids: occurrenceIds,
      copy_attachments: !template && (reference?.attachments.length ?? 0) > 0 && copyAttachments,
      ...(template ? { template_id: template.id } : { reference_review_id: reference!.id }),
    };

    this.isSubmitting.set(true);
    this.error.set(null);
    return this.reviewService.bulkCreate(payload).pipe(
      tap((result) => {
        const remaining = new Set(this.selectedOccurrenceIds());
        for (const createdId of result.created_occurrence_ids) remaining.delete(createdId);
        this.selectedOccurrenceIds.set(remaining);
        this.clearSource();
        if (remaining.size === 0) this.selectionMode.set(false);
        this.bulkResult.set(result);
      }),
      catchError<ScrapReviewBulkResult, Observable<ScrapReviewBulkResult>>((error: unknown) => {
        this.error.set(error);
        return EMPTY;
      }),
      finalize(() => this.isSubmitting.set(false)),
      takeUntilDestroyed(this.destroyRef),
    );
  }
}
