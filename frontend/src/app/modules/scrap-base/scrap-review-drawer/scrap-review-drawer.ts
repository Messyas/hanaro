import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Observable,
  catchError,
  concatMap,
  finalize,
  from,
  map,
  of,
  switchMap,
  tap,
  toArray,
} from 'rxjs';
import { LanguageService } from '../../../i18n/language.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ObjectUrlRegistry } from '../../../core/browser/object-url-registry';
import { InlineAlert } from '../../../shared/list-view/inline-alert/inline-alert';
import { StatusBadge } from '../../../shared/list-view/status-badge/status-badge';
import { UiIcon } from '../../../ui-icon';
import { ScrapListItem } from '../scrap-base.models';
import { ScrapReviewForm } from '../scrap-review-form/scrap-review-form';
import {
  ScrapDefectType,
  ScrapReview,
  ScrapReviewFormModel,
  ScrapReviewWrite,
} from '../scrap-review.models';
import { ScrapReviewPreview } from '../scrap-review-preview/scrap-review-preview';
import { ScrapReviewService } from '../scrap-review.service';
import { ScrapTemplateService } from '../scrap-template.service';
import {
  ScrapAttachmentPreview,
  ScrapAttachmentPreviewService,
} from './scrap-attachment-preview.service';

@Component({
  selector: 'app-scrap-review-drawer',
  imports: [InlineAlert, ScrapReviewForm, ScrapReviewPreview, StatusBadge, UiIcon],
  providers: [ScrapAttachmentPreviewService, ObjectUrlRegistry],
  templateUrl: './scrap-review-drawer.html',
  styleUrl: './scrap-review-drawer.css',
})
export class ScrapReviewDrawer implements OnInit, OnDestroy {
  private readonly reviewService = inject(ScrapReviewService);
  private readonly templateService = inject(ScrapTemplateService);
  private readonly language = inject(LanguageService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly attachmentPreviewService = inject(ScrapAttachmentPreviewService);

  readonly t = computed(() => this.language.translations());

  readonly occurrence = input<ScrapListItem | null>(null);
  readonly occurrenceId = input<string | null>(null);
  readonly queueOccurrenceIds = input<string[]>([]);
  readonly queueOccurrences = input<ScrapListItem[]>([]);

  readonly closed = output<void>();
  readonly reviewSaved = output<ScrapReview>();
  readonly queueFinished = output<void>();

  readonly drawerDialog = viewChild<ElementRef<HTMLElement>>('drawerDialog');
  readonly reviewFormCmp = viewChild<ScrapReviewForm>('reviewFormCmp');

  readonly queueIndex = signal<number>(0);
  readonly review = signal<ScrapReview | null>(null);
  readonly defectTypes = signal<ScrapDefectType[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly finalizing = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isConflict = signal(false);
  readonly isDirty = signal(false);
  readonly isPreviewMode = signal(false);
  readonly isEditingFinalized = signal(false);
  readonly showFinalizeConfirm = signal(false);
  readonly showTemplateNamePrompt = signal(false);
  readonly customTemplateName = signal('');
  readonly lastSavedAt = signal<Date | null>(null);

  readonly isQueueMode = computed(() => this.queueOccurrenceIds().length > 1);
  readonly queueTotal = computed(() => this.queueOccurrenceIds().length);
  readonly queueCurrentDisplay = computed(() => this.queueIndex() + 1);
  readonly isQueueLast = computed(() => this.queueIndex() >= this.queueTotal() - 1);
  readonly isQueueFirst = computed(() => this.queueIndex() <= 0);

  readonly currentOccurrence = computed<ScrapListItem | null>(() => {
    if (this.isQueueMode()) {
      const q = this.queueOccurrences();
      const idx = this.queueIndex();
      if (q && q[idx]) return q[idx];
    }
    return this.occurrence();
  });

  readonly matchingTemplate = computed(() => {
    const revId = this.review()?.id;
    if (!revId) return null;
    return this.templateService.templates().find((t) => t.source_review_id === revId) || null;
  });

  readonly isFavoriteTemplate = computed(() => !!this.matchingTemplate());

  readonly localFormModel = signal<ScrapReviewFormModel>({
    defectTypeId: '',
    title: '',
    description: '',
  });

  readonly pendingUploadFiles = signal<File[]>([]);
  readonly draftAttachmentPreviews = signal<ScrapAttachmentPreview[]>([]);

  readonly selectedDefectTypeName = computed(() => {
    const id = this.localFormModel().defectTypeId;
    if (!id) return null;
    const found = this.defectTypes().find((d) => d.id === id);
    return found ? found.name : null;
  });

  readonly activeOccurrenceId = computed(() => {
    if (this.isQueueMode()) {
      const q = this.queueOccurrenceIds();
      return q[this.queueIndex()] || null;
    }
    return this.occurrenceId() || this.occurrence()?.occurrence_id || null;
  });

  readonly isReadOnly = computed(() => {
    return this.review()?.status === 'REVIEWED' && !this.isEditingFinalized();
  });

  readonly canEditFinalized = computed(() => {
    const review = this.review();
    const user = this.authService.user();
    return review?.status === 'REVIEWED' && !!user && review.responsible_user_id === user.id;
  });

  readonly saveStatusLabel = computed(() => {
    if (this.saving()) return this.t().scrapSaveStatusSaving;
    if (this.isDirty()) return this.t().scrapSaveStatusUnsaved;
    const savedAt = this.lastSavedAt();
    if (savedAt) {
      return `${this.t().scrapSaveStatusSaved} ${savedAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    return null;
  });

  readonly reviewStatusLabel = computed(() => {
    const status = this.review()?.status || this.currentOccurrence()?.review_status;
    if (status === 'REVIEWED') return this.t().scrapReviewStatusReviewed;
    if (status === 'DRAFT') return this.t().scrapReviewStatusDraft;
    return this.t().scrapReviewStatusUnreviewed;
  });

  readonly reviewStatusTone = computed<'success' | 'warning' | 'neutral'>(() => {
    const status = this.review()?.status || this.currentOccurrence()?.review_status;
    if (status === 'REVIEWED') return 'success';
    if (status === 'DRAFT') return 'warning';
    return 'neutral';
  });

  readonly canFinalize = computed(() => {
    if (this.isReadOnly() || this.saving() || this.finalizing() || this.uploading()) return false;
    const m = this.localFormModel();
    return (
      Boolean(m.defectTypeId) &&
      Boolean(m.title.trim()) &&
      m.title.length <= 200 &&
      Boolean(m.description.trim()) &&
      m.description.length <= 20000
    );
  });

  readonly canSaveFinalized = computed(() => {
    if (this.saving() || this.uploading()) return false;
    const m = this.localFormModel();
    return (
      Boolean(m.defectTypeId) &&
      Boolean(m.title.trim()) &&
      m.title.length <= 200 &&
      Boolean(m.description.trim()) &&
      m.description.length <= 20000
    );
  });

  constructor() {
    effect(() => {
      const occId = this.activeOccurrenceId();
      if (occId) {
        this.loadReview(occId);
      }
    });
  }

  ngOnInit(): void {
    this.loadDefectTypes();
    this.templateService.loadTemplates().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  ngOnDestroy(): void {
    this.attachmentPreviewService.revokeAll();
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.attemptClose();
  }

  loadDefectTypes(): void {
    this.reviewService
      .getDefectTypes(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types) => this.defectTypes.set(types),
        error: () => this.defectTypes.set([]),
      });
  }

  loadReview(occurrenceId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.isConflict.set(false);
    this.isDirty.set(false);
    this.pendingUploadFiles.set([]);
    this.clearDraftAttachmentPreviews();
    this.lastSavedAt.set(null);

    this.reviewService
      .getReview(occurrenceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rev) => {
          this.review.set(rev);
          this.localFormModel.set({
            defectTypeId: rev.defect_type?.id || '',
            title: rev.title || '',
            description: rev.description || '',
          });
          this.isEditingFinalized.set(false);
          if (rev.status === 'REVIEWED') {
            this.isPreviewMode.set(true);
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          // 404 significa que a análise ainda não foi criada
          if (err.status === 404) {
            this.review.set(null);
            this.localFormModel.set({ defectTypeId: '', title: '', description: '' });
            this.isPreviewMode.set(false);
          } else {
            this.error.set(err.error?.detail || err.message || 'Erro ao carregar análise.');
          }
        },
      });
  }

  onModelChange(model: ScrapReviewFormModel): void {
    this.localFormModel.set(model);
    this.isDirty.set(true);
  }

  onFilesSelected(files: File[]): void {
    this.pendingUploadFiles.update((current) => [...current, ...files]);
    this.draftAttachmentPreviews.update((current) => [
      ...current,
      ...files.map((file) => this.attachmentPreviewService.create(file)),
    ]);
    this.isDirty.set(true);
    // Se a revisão já existe no servidor, podemos fazer o upload imediatamente
    const currentRev = this.review();
    if (currentRev?.id) {
      this.uploadPendingFilesSequentially(currentRev.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            this.reviewSaved.emit(updated);
          },
        });
    }
  }

  onAttachmentDeleted(attachmentId: string): void {
    const currentRev = this.review();
    if (!currentRev?.id) return;

    this.reviewService
      .deleteAttachment(currentRev.id, attachmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.review.update((r) => {
            if (!r) return null;
            return {
              ...r,
              attachments: r.attachments.filter((a) => a.id !== attachmentId),
            };
          });
          if (this.review()) {
            this.reviewSaved.emit(this.review()!);
          }
        },
        error: (err) => {
          this.error.set(err.error?.detail || err.message || 'Erro ao remover foto.');
        },
      });
  }

  saveDraft(): void {
    const occId = this.activeOccurrenceId();
    if (!occId || this.saving() || this.isReadOnly()) return;

    this.saving.set(true);
    this.error.set(null);
    this.isConflict.set(false);

    const m = this.localFormModel();
    const payload: ScrapReviewWrite = {
      defect_type_id: m.defectTypeId || null,
      title: m.title.trim(),
      description: m.description.trim(),
      expected_version: this.review()?.version ?? null,
    };

    this.reviewService
      .saveDraft(occId, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((savedReview) => {
          this.review.set(savedReview);
          return this.uploadPendingFilesSequentially(savedReview.id);
        }),
      )
      .subscribe({
        next: (updatedReview) => {
          this.saving.set(false);
          this.isDirty.set(false);
          this.lastSavedAt.set(new Date());
          this.reviewSaved.emit(updatedReview);
        },
        error: (err) => {
          this.saving.set(false);
          if (err.status === 409) {
            this.isConflict.set(true);
            this.error.set(this.t().scrapConflictError);
          } else {
            this.error.set(err.error?.detail || err.message || 'Erro ao salvar rascunho.');
          }
        },
      });
  }

  saveDraftAndAdvance(): void {
    if (!this.isQueueMode() || this.isQueueLast()) {
      this.saveDraft();
      return;
    }
    const occId = this.activeOccurrenceId();
    if (!occId || this.saving() || this.finalizing()) return;

    this.saving.set(true);
    this.error.set(null);
    this.isConflict.set(false);

    const m = this.localFormModel();
    const payload: ScrapReviewWrite = {
      defect_type_id: m.defectTypeId || null,
      title: m.title.trim(),
      description: m.description.trim(),
      expected_version: this.review()?.version ?? null,
    };

    this.reviewService
      .saveDraft(occId, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((savedReview) => {
          this.review.set(savedReview);
          return this.uploadPendingFilesSequentially(savedReview.id);
        }),
      )
      .subscribe({
        next: (updatedReview) => {
          this.saving.set(false);
          this.isDirty.set(false);
          this.lastSavedAt.set(new Date());
          this.reviewSaved.emit(updatedReview);
          this.nextInQueue();
        },
        error: (err) => {
          this.saving.set(false);
          if (err.status === 409) {
            this.isConflict.set(true);
            this.error.set(this.t().scrapConflictError);
          } else {
            this.error.set(err.error?.detail || err.message || 'Erro ao salvar rascunho.');
          }
        },
      });
  }

  nextInQueue(): void {
    if (!this.isQueueLast()) {
      this.queueIndex.update((i) => i + 1);
      this.resetDrawerForNextOccurrence();
    }
  }

  previousInQueue(): void {
    if (!this.isQueueFirst()) {
      this.queueIndex.update((i) => i - 1);
      this.resetDrawerForNextOccurrence();
    }
  }

  private resetDrawerForNextOccurrence(): void {
    this.review.set(null);
    this.localFormModel.set({ defectTypeId: '', title: '', description: '' });
    this.isDirty.set(false);
    this.pendingUploadFiles.set([]);
    this.clearDraftAttachmentPreviews();
    this.error.set(null);
    this.isConflict.set(false);
    this.isPreviewMode.set(false);
    this.isEditingFinalized.set(false);
    this.showFinalizeConfirm.set(false);
  }

  promptFinalize(): void {
    if (!this.canFinalize()) return;
    this.showFinalizeConfirm.set(true);
  }

  cancelFinalize(): void {
    this.showFinalizeConfirm.set(false);
  }

  confirmFinalize(): void {
    const occId = this.activeOccurrenceId();
    if (!occId || !this.canFinalize()) return;

    this.showFinalizeConfirm.set(false);
    this.finalizing.set(true);
    this.error.set(null);
    this.isConflict.set(false);

    const m = this.localFormModel();
    const payload: ScrapReviewWrite = {
      defect_type_id: m.defectTypeId,
      title: m.title.trim(),
      description: m.description.trim(),
      expected_version: this.review()?.version ?? null,
    };

    this.reviewService
      .saveDraft(occId, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((savedReview) => {
          this.review.set(savedReview);
          return this.uploadPendingFilesSequentially(savedReview.id);
        }),
        switchMap((reviewWithAttachments) => {
          return this.reviewService.finalize(occId, reviewWithAttachments.version);
        }),
      )
      .subscribe({
        next: (finalReview) => {
          this.review.set(finalReview);
          this.finalizing.set(false);
          this.isDirty.set(false);
          this.reviewSaved.emit(finalReview);

          if (this.isQueueMode()) {
            if (!this.isQueueLast()) {
              this.nextInQueue();
            } else {
              this.queueFinished.emit();
              this.attemptClose();
            }
          } else {
            this.isPreviewMode.set(true);
          }
        },
        error: (err) => {
          this.finalizing.set(false);
          if (err.status === 409) {
            this.isConflict.set(true);
            this.error.set(this.t().scrapConflictError);
          } else {
            this.error.set(err.error?.detail || err.message || 'Erro ao finalizar relatório.');
          }
        },
      });
  }

  private uploadPendingFilesSequentially(reviewId: string): Observable<ScrapReview> {
    const files = [...this.pendingUploadFiles()];
    if (files.length === 0) {
      return of(this.review()!);
    }

    this.uploading.set(true);
    this.pendingUploadFiles.set([]);
    this.clearDraftAttachmentPreviews();

    return from(files).pipe(
      concatMap((file) =>
        this.reviewService.uploadAttachment(reviewId, file).pipe(
          tap((attachment) => {
            this.review.update((r) => {
              if (!r) return null;
              return {
                ...r,
                attachments: [...r.attachments, attachment],
                version: r.version + 1,
              };
            });
          }),
          catchError((err) => {
            this.error.set(
              `${this.t().scrapAttachmentUploadError} (${file.name}): ${err.error?.detail || err.message}`,
            );
            return of(null);
          }),
        ),
      ),
      toArray(),
      map(() => this.review()!),
      finalize(() => {
        this.uploading.set(false);
      }),
    );
  }

  private clearDraftAttachmentPreviews(): void {
    this.attachmentPreviewService.revokeAll();
    this.draftAttachmentPreviews.set([]);
  }

  toggleEditFinalized(): void {
    if (this.isEditingFinalized()) {
      this.cancelEditFinalized();
    } else {
      this.startEditFinalized();
    }
  }

  startEditFinalized(): void {
    const rev = this.review();
    if (!rev || !this.canEditFinalized()) return;
    this.localFormModel.set({
      defectTypeId: rev.defect_type?.id || '',
      title: rev.title || '',
      description: rev.description || '',
    });
    this.isEditingFinalized.set(true);
    this.isPreviewMode.set(false);
    this.isDirty.set(false);
  }

  cancelEditFinalized(): void {
    const rev = this.review();
    if (rev) {
      this.localFormModel.set({
        defectTypeId: rev.defect_type?.id || '',
        title: rev.title || '',
        description: rev.description || '',
      });
    }
    this.isEditingFinalized.set(false);
    this.isPreviewMode.set(true);
    this.isDirty.set(false);
  }

  saveFinalizedEdit(): void {
    const occId = this.activeOccurrenceId();
    if (!occId || this.saving() || !this.canSaveFinalized()) return;

    this.saving.set(true);
    this.error.set(null);
    this.isConflict.set(false);

    const m = this.localFormModel();
    const payload: ScrapReviewWrite = {
      defect_type_id: m.defectTypeId || null,
      title: m.title.trim(),
      description: m.description.trim(),
      expected_version: this.review()?.version ?? null,
    };

    this.reviewService
      .saveDraft(occId, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((savedReview) => {
          this.review.set(savedReview);
          return this.uploadPendingFilesSequentially(savedReview.id);
        }),
      )
      .subscribe({
        next: (updatedReview) => {
          this.saving.set(false);
          this.isDirty.set(false);
          this.lastSavedAt.set(new Date());
          this.isEditingFinalized.set(false);
          this.isPreviewMode.set(true);
          this.reviewSaved.emit(updatedReview);
        },
        error: (err) => {
          this.saving.set(false);
          if (err.status === 409) {
            this.isConflict.set(true);
            this.error.set(this.t().scrapConflictError);
          } else {
            this.error.set(err.error?.detail || err.message || 'Erro ao salvar alterações.');
          }
        },
      });
  }

  togglePreviewMode(): void {
    this.isPreviewMode.update((v) => !v);
  }

  attemptClose(): void {
    if (this.isDirty()) {
      if (!confirm(this.t().scrapDiscardChangesConfirm)) {
        return;
      }
    }
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.attemptClose();
  }

  formatTransactionDate(value: string | undefined): string {
    if (!value) return '—';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  formatCurrency(value: string | undefined): string {
    if (!value) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(
      Number(value),
    );
  }

  toggleFavoriteTemplate(): void {
    const currentTpl = this.matchingTemplate();
    if (currentTpl) {
      this.templateService
        .deleteTemplate(currentTpl.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: (err) => console.error('Erro ao remover modelo:', err),
        });
    } else {
      const defaultName = this.review()?.title || '';
      this.customTemplateName.set(defaultName);
      this.showTemplateNamePrompt.set(true);
    }
  }

  cancelTemplatePrompt(): void {
    this.showTemplateNamePrompt.set(false);
    this.customTemplateName.set('');
  }

  confirmSaveTemplate(): void {
    const rev = this.review();
    const name = this.customTemplateName().trim();
    if (!rev || !name) return;

    this.templateService
      .createTemplate({
        name,
        title: rev.title,
        description: rev.description,
        defect_type_id: rev.defect_type?.id || null,
        source_review_id: rev.id,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelTemplatePrompt();
        },
        error: (err) => {
          console.error('Erro ao salvar modelo:', err);
        },
      });
  }
}
