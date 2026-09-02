import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../i18n/language.service';
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

@Component({
  selector: 'app-scrap-review-drawer',
  imports: [InlineAlert, ScrapReviewForm, ScrapReviewPreview, StatusBadge, UiIcon],
  templateUrl: './scrap-review-drawer.html',
  styleUrl: './scrap-review-drawer.css',
})
export class ScrapReviewDrawer implements OnInit {
  private readonly reviewService = inject(ScrapReviewService);
  private readonly templateService = inject(ScrapTemplateService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly t = computed(() => this.language.translations());

  readonly occurrence = input<ScrapListItem | null>(null);
  readonly occurrenceId = input<string | null>(null);

  readonly closed = output<void>();
  readonly reviewSaved = output<ScrapReview>();
  readonly useAsReference = output<ScrapReview>();

  readonly drawerDialog = viewChild<ElementRef<HTMLElement>>('drawerDialog');
  readonly reviewFormCmp = viewChild<ScrapReviewForm>('reviewFormCmp');

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
  readonly showFinalizeConfirm = signal(false);
  readonly showTemplateNamePrompt = signal(false);
  readonly customTemplateName = signal('');

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

  readonly activeOccurrenceId = computed(() => {
    return this.occurrenceId() || this.occurrence()?.occurrence_id || null;
  });

  readonly isReadOnly = computed(() => {
    return this.review()?.status === 'REVIEWED';
  });

  readonly reviewStatusLabel = computed(() => {
    const status = this.review()?.status || this.occurrence()?.review_status;
    if (status === 'REVIEWED') return this.t().scrapReviewStatusReviewed;
    if (status === 'DRAFT') return this.t().scrapReviewStatusDraft;
    return this.t().scrapReviewStatusUnreviewed;
  });

  readonly reviewStatusTone = computed<'success' | 'warning' | 'neutral'>(() => {
    const status = this.review()?.status || this.occurrence()?.review_status;
    if (status === 'REVIEWED') return 'success';
    if (status === 'DRAFT') return 'warning';
    return 'neutral';
  });

  readonly canFinalize = computed(() => {
    if (this.isReadOnly() || this.saving() || this.finalizing()) return false;
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
    this.isDirty.set(true);
    // Se a revisão já existe no servidor, podemos fazer o upload imediatamente
    const currentRev = this.review();
    if (currentRev?.id) {
      this.uploadPendingFiles(currentRev.id);
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (savedReview) => {
          this.review.set(savedReview);
          this.saving.set(false);
          this.isDirty.set(false);
          this.reviewSaved.emit(savedReview);

          // Se existirem fotos na fila, envia agora com o id persistido
          if (this.pendingUploadFiles().length > 0) {
            this.uploadPendingFiles(savedReview.id);
          }
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

    // Primeiro salva rascunho se houver alterações
    const m = this.localFormModel();
    const payload: ScrapReviewWrite = {
      defect_type_id: m.defectTypeId,
      title: m.title.trim(),
      description: m.description.trim(),
      expected_version: this.review()?.version ?? null,
    };

    this.reviewService
      .saveDraft(occId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (savedReview) => {
          this.review.set(savedReview);

          // Agora chama finalize
          this.reviewService
            .finalize(occId, savedReview.version)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (finalReview) => {
                this.review.set(finalReview);
                this.finalizing.set(false);
                this.isDirty.set(false);
                this.isPreviewMode.set(true);
                this.reviewSaved.emit(finalReview);
              },
              error: (finalizeErr) => {
                this.finalizing.set(false);
                if (finalizeErr.status === 409) {
                  this.isConflict.set(true);
                  this.error.set(this.t().scrapConflictError);
                } else {
                  this.error.set(
                    finalizeErr.error?.detail ||
                      finalizeErr.message ||
                      'Erro ao finalizar relatório.',
                  );
                }
              },
            });
        },
        error: (draftErr) => {
          this.finalizing.set(false);
          if (draftErr.status === 409) {
            this.isConflict.set(true);
            this.error.set(this.t().scrapConflictError);
          } else {
            this.error.set(draftErr.error?.detail || draftErr.message || 'Erro ao salvar análise.');
          }
        },
      });
  }

  private uploadPendingFiles(reviewId: string): void {
    const files = [...this.pendingUploadFiles()];
    if (files.length === 0 || this.uploading()) return;

    this.uploading.set(true);
    this.pendingUploadFiles.set([]);

    // Upload sequencial de cada arquivo
    const uploadNext = (index: number) => {
      if (index >= files.length) {
        this.uploading.set(false);
        return;
      }

      this.reviewService
        .uploadAttachment(reviewId, files[index])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (attachment) => {
            this.review.update((r) => {
              if (!r) return null;
              return {
                ...r,
                attachments: [...r.attachments, attachment],
              };
            });
            if (this.review()) {
              this.reviewSaved.emit(this.review()!);
            }
            uploadNext(index + 1);
          },
          error: (err) => {
            this.error.set(
              `${this.t().scrapAttachmentUploadError} (${files[index].name}): ${err.error?.detail || err.message}`,
            );
            uploadNext(index + 1);
          },
        });
    };

    uploadNext(0);
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
