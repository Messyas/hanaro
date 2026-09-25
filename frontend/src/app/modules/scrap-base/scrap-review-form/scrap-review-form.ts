import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { disabled, form, FormField, maxLength, required } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../i18n/language.service';
import {
  ListFilterSelect,
  ListFilterSelectOption,
} from '../../../shared/list-filters/list-filter-select';
import { UiIcon } from '../../../ui-icon';
import { ScrapReviewAttachments } from '../scrap-review-attachments/scrap-review-attachments';
import { ScrapDefectType, ScrapReview, ScrapReviewFormModel } from '../scrap-review.models';

@Component({
  selector: 'app-scrap-review-form',
  imports: [FormField, ListFilterSelect, ScrapReviewAttachments, UiIcon],
  templateUrl: './scrap-review-form.html',
  styleUrl: './scrap-review-form.css',
})
export class ScrapReviewForm {
  private readonly authService = inject(AuthService);
  private readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());

  readonly review = input<ScrapReview | null>(null);
  readonly defectTypes = input<ScrapDefectType[]>([]);
  readonly readOnly = input<boolean>(false);
  readonly uploading = input<boolean>(false);

  readonly modelChange = output<ScrapReviewFormModel>();
  readonly filesSelected = output<File[]>();
  readonly attachmentDeleted = output<string>();

  readonly reviewModel = signal<ScrapReviewFormModel>({
    defectTypeId: '',
    title: '',
    description: '',
  });

  readonly reviewForm = form(this.reviewModel, (schema) => {
    required(schema.defectTypeId, { message: 'Selecione o tipo de scrap.' });
    required(schema.title, { message: 'Informe o título.' });
    maxLength(schema.title, 200, { message: 'Use no máximo 200 caracteres.' });
    required(schema.description, { message: 'Informe a descrição.' });
    maxLength(schema.description, 20000, { message: 'Use no máximo 20000 caracteres.' });
    disabled(schema.title, { when: () => this.readOnly() });
    disabled(schema.description, { when: () => this.readOnly() });
  });

  readonly responsibleName = computed(() => {
    return (
      this.review()?.responsible_name ||
      this.authService.user()?.name ||
      this.authService.user()?.username ||
      '—'
    );
  });

  readonly defectTypeOptions = computed<readonly ListFilterSelectOption[]>(() => {
    return this.defectTypes().map((type) => ({
      value: type.id,
      label: type.name,
    }));
  });

  readonly charCount = computed(() => this.reviewModel().description.length);

  readonly canFinalize = computed(() => {
    const m = this.reviewModel();
    return (
      !this.readOnly() &&
      Boolean(m.defectTypeId) &&
      Boolean(m.title.trim()) &&
      m.title.length <= 200 &&
      Boolean(m.description.trim()) &&
      m.description.length <= 20000
    );
  });

  constructor() {
    effect(() => {
      const r = this.review();
      if (r) {
        this.reviewModel.set({
          defectTypeId: r.defect_type?.id || '',
          title: r.title || '',
          description: r.description || '',
        });
      }
    });
  }

  onDefectTypeChanged(defectTypeId: string): void {
    this.reviewModel.update((m) => ({ ...m, defectTypeId }));
    this.modelChange.emit(this.reviewModel());
  }

  onTitleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.reviewModel.update((m) => ({ ...m, title: input.value }));
    this.modelChange.emit(this.reviewModel());
  }

  onDescriptionInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.reviewModel.update((m) => ({ ...m, description: textarea.value }));
    this.modelChange.emit(this.reviewModel());
  }
}
