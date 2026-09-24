import { Injectable } from '@angular/core';

export interface ScrapAttachmentPreview {
  readonly url: string;
  readonly name: string;
  readonly original_filename: string;
}

/** Owns browser blob URLs used only while a review draft is open. */
@Injectable()
export class ScrapAttachmentPreviewService {
  private readonly activeUrls = new Set<string>();

  create(file: File): ScrapAttachmentPreview {
    const url = URL.createObjectURL(file);
    this.activeUrls.add(url);
    return { url, name: file.name, original_filename: file.name };
  }

  revoke(url: string): void {
    if (!this.activeUrls.delete(url)) return;
    URL.revokeObjectURL(url);
  }

  revokeAll(): void {
    for (const url of this.activeUrls) URL.revokeObjectURL(url);
    this.activeUrls.clear();
  }
}
