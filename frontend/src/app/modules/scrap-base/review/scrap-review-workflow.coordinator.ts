import { Injectable, inject } from '@angular/core';
import { Observable, catchError, concatMap, from, map, of, switchMap, toArray } from 'rxjs';
import { ScrapReview, ScrapReviewAttachment, ScrapReviewWrite } from './scrap-review.models';
import { ScrapReviewService } from './scrap-review.service';

export type ScrapReviewWorkflowResult =
  | { kind: 'saved'; review: ScrapReview }
  | { kind: 'attachments-failed'; review: ScrapReview; failedFiles: File[]; messages: string[] }
  | { kind: 'finalized'; review: ScrapReview }
  | {
      kind: 'failed';
      stage: 'save' | 'finalize' | 'upload';
      error: unknown;
      review?: ScrapReview;
    };
export type ScrapReviewSaveResult = Exclude<ScrapReviewWorkflowResult, { kind: 'finalized' }>;
export type ScrapReviewFinalizeResult = Exclude<ScrapReviewWorkflowResult, { kind: 'saved' }>;

interface AttachmentOutcome {
  file: File;
  attachment: ScrapReviewAttachment | null;
  error: unknown | null;
}

@Injectable()
export class ScrapReviewWorkflowCoordinator {
  private readonly reviewService = inject(ScrapReviewService);

  saveDraft(
    occurrenceId: string,
    payload: ScrapReviewWrite,
    files: readonly File[],
  ): Observable<ScrapReviewSaveResult> {
    return this.reviewService.saveDraft(occurrenceId, payload).pipe(
      switchMap((review) => this.uploadAttachments(review, files, 'saved')),
      catchError((error: unknown) =>
        of({ kind: 'failed', stage: 'save', error } as ScrapReviewSaveResult),
      ),
    ) as Observable<ScrapReviewSaveResult>;
  }

  finalizeReview(
    occurrenceId: string,
    payload: ScrapReviewWrite,
    files: readonly File[],
  ): Observable<ScrapReviewFinalizeResult> {
    return this.saveDraft(occurrenceId, payload, files).pipe(
      switchMap((result) => {
        if (result.kind !== 'saved') return of(result as ScrapReviewFinalizeResult);
        return this.reviewService.finalize(occurrenceId, result.review.version).pipe(
          map((review) => ({ kind: 'finalized', review }) as ScrapReviewFinalizeResult),
          catchError((error: unknown) =>
            of({
              kind: 'failed',
              stage: 'finalize',
              error,
              review: result.review,
            } as ScrapReviewFinalizeResult),
          ),
        );
      }),
    );
  }

  uploadToExistingReview(
    review: ScrapReview,
    files: readonly File[],
  ): Observable<ScrapReviewSaveResult> {
    return this.uploadAttachments(review, files, 'saved');
  }

  private uploadAttachments(
    initialReview: ScrapReview,
    files: readonly File[],
    successKind: 'saved',
  ): Observable<ScrapReviewSaveResult> {
    return (from([...files] as File[]) as Observable<File>).pipe(
      concatMap((file) =>
        this.reviewService.uploadAttachment(initialReview.id, file).pipe(
          map((attachment): AttachmentOutcome => ({ file, attachment, error: null })),
          catchError((error: unknown): Observable<AttachmentOutcome> =>
            of({ file, attachment: null, error }),
          ),
        ),
      ),
      toArray(),
      map((outcomes) => {
        const successful = outcomes.filter(
          (outcome): outcome is AttachmentOutcome & { attachment: ScrapReviewAttachment } =>
            outcome.attachment !== null,
        );
        const failed = outcomes.filter((outcome) => outcome.error !== null);
        const review = successful.reduce<ScrapReview>(
          (current, outcome) => ({
            ...current,
            attachments: [...current.attachments, outcome.attachment],
            version: current.version + 1,
          }),
          initialReview,
        );
        if (failed.length) {
          return {
            kind: 'attachments-failed',
            review,
            failedFiles: failed.map(({ file }) => file),
            messages: failed.map(({ file, error }) =>
              this.errorMessage(error, `Falha ao enviar ${file.name}.`),
            ),
          };
        }
        return { kind: successKind, review };
      }),
      catchError((error: unknown) =>
        of({ kind: 'failed', stage: 'upload', error } as ScrapReviewSaveResult),
      ),
    ) as Observable<ScrapReviewSaveResult>;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (typeof error !== 'object' || error === null) return fallback;
    const candidate = error as { error?: { detail?: string }; message?: string };
    return candidate.error?.detail || candidate.message || fallback;
  }
}
