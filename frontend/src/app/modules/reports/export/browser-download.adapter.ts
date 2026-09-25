import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { BrowserDownloadPort } from './browser-download.port';

@Injectable({ providedIn: 'root' })
export class BrowserDownloadAdapter implements BrowserDownloadPort {
  private readonly document = inject(DOCUMENT);

  download(blob: Blob, filename: string): void {
    const browserUrl = this.document.defaultView?.URL;
    if (!browserUrl) return;

    const url = browserUrl.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    browserUrl.revokeObjectURL(url);
  }
}
