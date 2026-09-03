import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { LanguageService } from '../../i18n/language.service';
import { ThemeService } from '../../theme/theme.service';
import { UiIcon } from '../../ui-icon';
import { ScrapDefectType } from '../scrap-base/scrap-review.models';
import { ScrapReviewService } from '../scrap-base/scrap-review.service';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, MatSlideToggle, UiIcon],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage implements OnInit {
  readonly theme = inject(ThemeService);
  readonly language = inject(LanguageService);
  readonly scrapReviewService = inject(ScrapReviewService);

  readonly activeTab = signal<'preferences' | 'system'>('preferences');

  // Defect types state
  readonly defectTypes = signal<ScrapDefectType[]>([]);
  readonly loadingDefectTypes = signal(false);
  readonly submitting = signal(false);
  readonly feedbackMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // New defect form
  readonly newName = signal('');
  readonly newCode = signal('');
  readonly newDesc = signal('');
  readonly codeManuallyEdited = signal(false);

  // Edit mode
  readonly editingId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editDesc = signal('');

  readonly activeCount = computed(() => this.defectTypes().filter((d) => d.is_active).length);
  readonly totalCount = computed(() => this.defectTypes().length);

  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Carrega os tipos de scrap em segundo plano para que contadores e dados fiquem prontos
    this.loadDefectTypes();
  }

  selectTab(tab: 'preferences' | 'system'): void {
    this.activeTab.set(tab);
    if (tab === 'system' && this.defectTypes().length === 0) {
      this.loadDefectTypes();
    }
  }

  private slugify(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
  }

  onNewNameInput(value: string): void {
    this.newName.set(value);
    if (!this.codeManuallyEdited()) {
      this.newCode.set(this.slugify(value));
    }
  }

  onNewCodeInput(value: string): void {
    const formatted = value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    this.newCode.set(formatted);
    this.codeManuallyEdited.set(true);
  }

  loadDefectTypes(): void {
    this.loadingDefectTypes.set(true);
    this.scrapReviewService.getDefectTypes(true).subscribe({
      next: (types) => {
        this.defectTypes.set(types);
        this.loadingDefectTypes.set(false);
      },
      error: () => {
        this.loadingDefectTypes.set(false);
      },
    });
  }

  createDefectType(): void {
    const name = this.newName().trim();
    let code = this.newCode().trim() || this.slugify(name);
    if (!name || !code || this.submitting()) return;

    this.submitting.set(true);
    this.feedbackMessage.set(null);

    this.scrapReviewService
      .createDefectType({
        name,
        code,
        description: this.newDesc().trim() || null,
      })
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.defectTypes.update((current) => [...current, created]);
          this.newName.set('');
          this.newCode.set('');
          this.newDesc.set('');
          this.codeManuallyEdited.set(false);
          this.setFeedback('success', this.language.translations().scrapDefectTypeSuccessCreate);
        },
        error: () => {
          this.submitting.set(false);
          this.setFeedback('error', this.language.translations().scrapDefectTypeErrorCreate);
        },
      });
  }

  toggleActive(type: ScrapDefectType, checked: boolean): void {
    this.scrapReviewService.updateDefectType(type.id, { is_active: checked }).subscribe({
      next: (updated) => {
        this.defectTypes.update((types) =>
          types.map((item) => (item.id === updated.id ? updated : item)),
        );
      },
      error: () => {
        this.setFeedback('error', this.language.translations().scrapDefectTypeErrorUpdate);
      },
    });
  }

  startEdit(type: ScrapDefectType): void {
    this.editingId.set(type.id);
    this.editName.set(type.name);
    this.editDesc.set(type.description || '');
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(type: ScrapDefectType): void {
    const name = this.editName().trim();
    if (!name || this.submitting()) return;

    this.submitting.set(true);
    this.scrapReviewService
      .updateDefectType(type.id, {
        name,
        description: this.editDesc().trim() || null,
      })
      .subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.editingId.set(null);
          this.defectTypes.update((types) =>
            types.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.setFeedback('success', this.language.translations().scrapDefectTypeSuccessUpdate);
        },
        error: () => {
          this.submitting.set(false);
          this.setFeedback('error', this.language.translations().scrapDefectTypeErrorUpdate);
        },
      });
  }

  readonly confirmingDeleteItem = signal<ScrapDefectType | null>(null);

  promptDelete(type: ScrapDefectType): void {
    this.confirmingDeleteItem.set(type);
  }

  cancelDelete(): void {
    this.confirmingDeleteItem.set(null);
  }

  confirmDelete(type: ScrapDefectType): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.confirmingDeleteItem.set(null);

    this.scrapReviewService.deleteDefectType(type.id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.defectTypes.update((types) => types.filter((item) => item.id !== type.id));
        this.setFeedback('success', this.language.translations().scrapDefectTypeSuccessDelete);
      },
      error: (err) => {
        this.submitting.set(false);
        const detail = err.error?.detail || this.language.translations().scrapDefectTypeErrorDelete;
        this.setFeedback('error', detail);
      },
    });
  }

  private setFeedback(type: 'success' | 'error', text: string): void {
    this.feedbackMessage.set({ type, text });
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
    this.feedbackTimeout = setTimeout(() => {
      this.feedbackMessage.set(null);
    }, 4500);
  }
}
