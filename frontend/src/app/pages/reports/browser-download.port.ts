import { InjectionToken } from '@angular/core';

export interface BrowserDownloadPort {
  download(blob: Blob, filename: string): void;
}

export const BROWSER_DOWNLOAD = new InjectionToken<BrowserDownloadPort>('BROWSER_DOWNLOAD');
