import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LanguageService } from '../../../i18n/language.service';
import { UiIcon } from '../../../ui-icon';
import { ScrapReviewAttachment } from '../scrap-review.models';

const MAX_ATTACHMENTS = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface LocalAttachmentItem {
  id: string; // generated client ID or attachment ID
  name: string;
  sizeBytes: number;
  url: string;
  isLocalPreview: boolean;
  persistedId?: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
  file?: File;
}

@Component({
  selector: 'app-scrap-review-attachments',
  imports: [UiIcon],
  templateUrl: './scrap-review-attachments.html',
  styleUrl: './scrap-review-attachments.css',
})
export class ScrapReviewAttachments implements OnDestroy {
  private readonly language = inject(LanguageService);
  readonly t = computed(() => this.language.translations());

  readonly attachments = input<ScrapReviewAttachment[]>([]);
  readonly readOnly = input<boolean>(false);
  readonly uploading = input<boolean>(false);

  readonly filesSelected = output<File[]>();
  readonly attachmentDeleted = output<string>();

  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  readonly localItems = signal<LocalAttachmentItem[]>([]);
  readonly activeError = signal<string | null>(null);
  readonly lightboxItem = signal<{ url: string; name: string } | null>(null);
  readonly isDragOver = signal(false);

  readonly totalCount = computed(
    () => this.attachments().length + this.localItems().filter((item) => !item.persistedId).length,
  );
  readonly canAddMore = computed(() => !this.readOnly() && this.totalCount() < MAX_ATTACHMENTS);

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.lightboxItem()) {
      this.closeLightbox();
    }
  }

  ngOnDestroy(): void {
    for (const item of this.localItems()) {
      if (item.isLocalPreview && item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    }
  }

  triggerFileInput(): void {
    if (!this.canAddMore()) return;
    this.activeError.set(null);
    const input = this.fileInput()?.nativeElement;
    if (input) {
      input.value = '';
      input.click();
    }
  }

  onFilesChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleSelectedFiles(Array.from(input.files));
    }
  }

  onDragOver(event: DragEvent): void {
    if (this.readOnly() || !this.canAddMore()) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    if (this.readOnly() || !this.canAddMore()) return;

    if (event.dataTransfer?.files?.length) {
      this.handleSelectedFiles(Array.from(event.dataTransfer.files));
    }
  }

  private handleSelectedFiles(files: File[]): void {
    this.activeError.set(null);
    const validFiles: File[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        this.activeError.set(this.t().scrapAttachmentTypeError);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        this.activeError.set(this.t().scrapAttachmentSizeError);
        return;
      }
      if (this.totalCount() + validFiles.length >= MAX_ATTACHMENTS) {
        this.activeError.set(this.t().scrapAttachmentMaxError);
        break;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      const newItems: LocalAttachmentItem[] = validFiles.map((file) => ({
        id: `local-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        sizeBytes: file.size,
        url: URL.createObjectURL(file),
        isLocalPreview: true,
        status: 'pending',
        file,
      }));

      this.localItems.update((items) => [...items, ...newItems]);
      this.filesSelected.emit(validFiles);
    }
  }

  removeLocalItem(item: LocalAttachmentItem): void {
    if (this.readOnly()) return;
    if (item.isLocalPreview && item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
    this.localItems.update((items) => items.filter((i) => i.id !== item.id));
  }

  removePersistedAttachment(att: ScrapReviewAttachment): void {
    if (this.readOnly()) return;
    if (confirm(this.t().scrapAttachmentDeleteConfirm)) {
      this.attachmentDeleted.emit(att.id);
    }
  }

  openLightbox(url: string, name: string): void {
    this.lightboxItem.set({ url, name });
  }

  closeLightbox(): void {
    this.lightboxItem.set(null);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
