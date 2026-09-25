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
import { LanguageService } from '../../../core/i18n/language.service';
import { UiIcon } from '../../../shared/components/ui-icon/ui-icon';
import { ObjectUrlRegistry } from '../../../core/browser/object-url-registry';
import { ScrapReviewAttachment } from '../scrap-review.models';

const MAX_ATTACHMENTS = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpeg', 'jpg', 'png', 'webp'];

export interface LocalAttachmentItem {
  id: string;
  name: string;
  sizeBytes: number;
  url: string;
  isLocalPreview: boolean;
  file?: File;
}

export interface DisplayAttachmentItem {
  id: string;
  name: string;
  sizeBytes: number;
  url: string;
  isPersisted: boolean;
  persistedAttachment?: ScrapReviewAttachment;
  localItem?: LocalAttachmentItem;
}

@Component({
  selector: 'app-scrap-review-attachments',
  imports: [UiIcon],
  templateUrl: './scrap-review-attachments.html',
  styleUrl: './scrap-review-attachments.css',
  providers: [ObjectUrlRegistry],
})
export class ScrapReviewAttachments implements OnDestroy {
  private readonly language = inject(LanguageService);
  private readonly objectUrls = inject(ObjectUrlRegistry);
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

  readonly displayItems = computed<DisplayAttachmentItem[]>(() => {
    const list: DisplayAttachmentItem[] = [];

    for (const att of this.attachments()) {
      list.push({
        id: att.id,
        name: att.original_filename,
        sizeBytes: att.size_bytes,
        url: att.url,
        isPersisted: true,
        persistedAttachment: att,
      });
    }

    for (const item of this.localItems()) {
      if (!list.some((existing) => existing.name === item.name)) {
        list.push({
          id: item.id,
          name: item.name,
          sizeBytes: item.sizeBytes,
          url: item.url,
          isPersisted: false,
          localItem: item,
        });
      }
    }

    return list;
  });

  readonly totalCount = computed(() => this.displayItems().length);
  readonly canAddMore = computed(() => !this.readOnly() && this.totalCount() < MAX_ATTACHMENTS);

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.lightboxItem()) {
      this.closeLightbox();
    }
  }

  ngOnDestroy(): void {
    this.objectUrls.revokeAll();
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
      const type = (file.type || '').toLowerCase();
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isAllowed = ALLOWED_MIME_TYPES.includes(type) || ALLOWED_EXTENSIONS.includes(ext);

      if (!isAllowed) {
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
        url: this.objectUrls.create(file),
        isLocalPreview: true,
        file,
      }));

      this.localItems.update((items) => [...items, ...newItems]);
      this.filesSelected.emit(validFiles);
    }
  }

  removeItem(item: DisplayAttachmentItem): void {
    if (this.readOnly()) return;
    if (item.isPersisted && item.persistedAttachment) {
      if (confirm(this.t().scrapAttachmentDeleteConfirm)) {
        this.attachmentDeleted.emit(item.persistedAttachment.id);
      }
    } else if (item.localItem) {
      this.removeLocalItem(item.localItem);
    }
  }

  removeLocalItem(item: LocalAttachmentItem): void {
    if (this.readOnly()) return;
    if (item.isLocalPreview) this.objectUrls.revoke(item.url);
    this.localItems.update((items) => items.filter((i) => i.id !== item.id));
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
