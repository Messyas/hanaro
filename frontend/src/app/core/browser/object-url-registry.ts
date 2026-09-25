import { Injectable } from '@angular/core';

/** Tracks blob URLs for the owner that created them and releases them on cleanup. */
@Injectable()
export class ObjectUrlRegistry {
  private readonly activeUrls = new Set<string>();

  create(file: File): string {
    const url = URL.createObjectURL(file);
    this.activeUrls.add(url);
    return url;
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
