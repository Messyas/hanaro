import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

@Injectable({ providedIn: 'root' })
export class PageSizePreference {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  read(key: string, fallback: PageSize = 25): PageSize {
    if (!this.isBrowser) return fallback;
    try {
      const storedValue = Number(localStorage.getItem(key));
      return PAGE_SIZE_OPTIONS.find((value) => value === storedValue) ?? fallback;
    } catch {
      return fallback;
    }
  }

  save(key: string, value: PageSize): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Keep pagination usable when browser storage is unavailable.
    }
  }
}
