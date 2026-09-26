import { Injectable, inject } from '@angular/core';
import { ObjectUrlRegistry } from '../object-url-registry';

export interface ScrapAttachmentPreview {
  readonly url: string;
  readonly name: string;
  readonly original_filename: string;
}

/** Owns browser blob URLs used only while a review draft is open. */
@Injectable()
export class ScrapAttachmentPreviewService {
  private readonly objectUrls = inject(ObjectUrlRegistry);

  create(file: File): ScrapAttachmentPreview {
    const url = this.objectUrls.create(file);
    return { url, name: file.name, original_filename: file.name };
  }

  revoke(url: string): void {
    this.objectUrls.revoke(url);
  }

  revokeAll(): void {
    this.objectUrls.revokeAll();
  }
}
