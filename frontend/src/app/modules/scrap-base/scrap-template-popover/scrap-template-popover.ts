import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { LanguageService } from '../../../core/i18n/language.service';
import { UiIcon } from '../../../shared/components/ui-icon/ui-icon';
import { ScrapDefectType } from '../scrap-review.models';
import { ScrapReviewTemplate, ScrapReviewTemplateUpdate } from '../scrap-template.models';

interface TemplateEditorModel {
  name: string;
  title: string;
  description: string;
  defectTypeId: string;
}

export interface TemplateUpdateRequest {
  id: string;
  payload: ScrapReviewTemplateUpdate;
}

@Component({
  selector: 'app-scrap-template-popover',
  imports: [DatePipe, FormField, UiIcon],
  templateUrl: './scrap-template-popover.html',
  styleUrl: './scrap-template-popover.css',
})
export class ScrapTemplatePopover {
  private readonly language = inject(LanguageService);

  readonly t = computed(() => this.language.translations());
  readonly open = input(false);
  readonly templates = input<ScrapReviewTemplate[]>([]);
  readonly defectTypes = input<ScrapDefectType[]>([]);
  readonly loading = input(false);
  readonly activeTemplateId = input<string | null>(null);
  readonly mutationId = input<string | null>(null);
  readonly feedback = input<string | null>(null);
  readonly feedbackKind = input<'success' | 'error'>('success');

  readonly openChange = output<boolean>();
  readonly useTemplate = output<ScrapReviewTemplate>();
  readonly updateTemplate = output<TemplateUpdateRequest>();
  readonly deleteTemplate = output<string>();

  readonly editingTemplateId = signal<string | null>(null);
  readonly deletingTemplateId = signal<string | null>(null);
  readonly editorModel = signal<TemplateEditorModel>({
    name: '',
    title: '',
    description: '',
    defectTypeId: '',
  });
  readonly editorForm = form(this.editorModel, (schema) => {
    required(schema.name, { message: this.t().scrapTemplateValidationName });
    maxLength(schema.name, 150, { message: this.t().scrapTemplateValidationMaxLength });
    required(schema.title, { message: this.t().scrapTemplateValidationTitle });
    maxLength(schema.title, 200, { message: this.t().scrapTemplateValidationMaxLength });
    required(schema.description, { message: this.t().scrapTemplateValidationDescription });
    maxLength(schema.description, 20_000, { message: this.t().scrapTemplateValidationMaxLength });
    required(schema.defectTypeId, { message: this.t().scrapTemplateTypeRequired });
  });

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.editingTemplateId()) {
      this.cancelEdit();
    } else if (this.deletingTemplateId()) {
      this.deletingTemplateId.set(null);
    } else if (this.open()) {
      this.close();
    }
  }

  close(): void {
    this.cancelEdit();
    this.deletingTemplateId.set(null);
    this.openChange.emit(false);
  }

  onSelect(template: ScrapReviewTemplate): void {
    this.useTemplate.emit(template);
  }

  startEdit(template: ScrapReviewTemplate): void {
    this.deletingTemplateId.set(null);
    this.editingTemplateId.set(template.id);
    this.editorModel.set({
      name: template.name,
      title: template.title,
      description: template.description,
      defectTypeId: template.defect_type_id ?? '',
    });
    this.editorForm().reset();
  }

  cancelEdit(): void {
    this.editingTemplateId.set(null);
    this.editorModel.set({ name: '', title: '', description: '', defectTypeId: '' });
    this.editorForm().reset();
  }

  onDefectTypeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.editorModel.update((current) => ({ ...current, defectTypeId: select.value }));
  }

  saveEdit(): void {
    const id = this.editingTemplateId();
    if (!id || this.editorForm().invalid() || this.mutationId()) return;
    const model = this.editorModel();
    this.updateTemplate.emit({
      id,
      payload: {
        name: model.name.trim(),
        title: model.title.trim(),
        description: model.description.trim(),
        defect_type_id: model.defectTypeId,
      },
    });
    this.cancelEdit();
  }

  requestDelete(templateId: string): void {
    this.cancelEdit();
    this.deletingTemplateId.set(templateId);
  }

  confirmDelete(templateId: string): void {
    if (this.mutationId()) return;
    this.deleteTemplate.emit(templateId);
    this.deletingTemplateId.set(null);
  }
}
