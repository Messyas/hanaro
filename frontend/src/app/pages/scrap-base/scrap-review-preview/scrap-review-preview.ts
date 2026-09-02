import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { LanguageService } from '../../../i18n/language.service';
import { StatusBadge } from '../../../shared/list-view/status-badge/status-badge';
import { UiIcon } from '../../../ui-icon';
import { ScrapListItem } from '../scrap-base.models';
import { ScrapReview, ScrapReviewAttachment, ScrapReviewFormModel } from '../scrap-review.models';

@Component({
  selector: 'app-scrap-review-preview',
  imports: [StatusBadge, UiIcon],
  templateUrl: './scrap-review-preview.html',
  styleUrl: './scrap-review-preview.css',
})
export class ScrapReviewPreview {
  private readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());

  readonly review = input<ScrapReview | null>(null);
  readonly occurrence = input<ScrapListItem | null>(null);
  readonly draftForm = input<ScrapReviewFormModel | null>(null);
  readonly draftAttachments = input<
    Array<{ url: string; name?: string; original_filename?: string }>
  >([]);
  readonly isDraft = input<boolean>(false);
  readonly defectTypeName = input<string | null>(null);

  readonly useAsReference = output<ScrapReview>();

  readonly lightboxItem = signal<{ url: string; name: string } | null>(null);

  readonly displayTitle = computed(() => {
    return this.review()?.title || this.draftForm()?.title || '—';
  });

  readonly displayDescription = computed(() => {
    return this.review()?.description || this.draftForm()?.description || '';
  });

  readonly displayDefectType = computed(() => {
    return (
      this.review()?.defect_type?.name ||
      this.defectTypeName() ||
      this.occurrence()?.defect_type_name ||
      '—'
    );
  });

  readonly displayResponsible = computed(() => {
    return this.review()?.responsible_name || this.occurrence()?.responsible_name || '—';
  });

  readonly displayDate = computed(() => {
    const d = this.review()?.reviewed_at || this.occurrence()?.reviewed_at;
    if (!d) return null;
    return new Date(d).toLocaleDateString(this.calendarLocale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  readonly isReviewed = computed(() => this.review()?.status === 'REVIEWED');

  readonly allImages = computed(() => {
    if (this.review()?.attachments?.length) {
      return this.review()!.attachments.map((a) => ({
        url: a.url,
        name: a.original_filename,
      }));
    }
    return this.draftAttachments().map((a) => ({
      url: a.url,
      name: a.original_filename || a.name || 'Foto de evidência',
    }));
  });

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.lightboxItem()) {
      this.closeLightbox();
    }
  }

  openLightbox(url: string, name: string): void {
    this.lightboxItem.set({ url, name });
  }

  closeLightbox(): void {
    this.lightboxItem.set(null);
  }

  onUseAsReference(): void {
    const rev = this.review();
    if (rev) {
      this.useAsReference.emit(rev);
    }
  }

  formatCurrency(value: string | undefined): string {
    if (!value) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(
      Number(value),
    );
  }

  formatTransactionDate(value: string | undefined): string {
    if (!value) return '—';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  private calendarLocale(): string {
    const language = this.language.currentLanguage();
    return language === 'pt' ? 'pt-BR' : language === 'ko' ? 'ko-KR' : 'en-US';
  }
}
