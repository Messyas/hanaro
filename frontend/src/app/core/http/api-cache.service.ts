import { environment } from '../../../environments/environment';
import { isPlatformBrowser } from '@angular/common';
import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable } from 'rxjs';

interface CacheEntry {
  response: HttpResponse<unknown>;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class ApiCacheService {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Observable<HttpResponse<unknown>>>();
  readonly enabled: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.enabled = isPlatformBrowser(platformId);
  }

  key(request: HttpRequest<unknown>): string {
    return request.urlWithParams;
  }

  shouldCache(request: HttpRequest<unknown>): boolean {
    return (
      this.enabled &&
      request.method === 'GET' &&
      request.urlWithParams.includes(`${environment.apiBaseUrl}/`) &&
      request.responseType !== 'blob' &&
      !request.urlWithParams.includes('/download')
    );
  }

  get(request: HttpRequest<unknown>): HttpResponse<unknown> | null {
    const key = this.key(request);
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.response.clone();
  }

  set(request: HttpRequest<unknown>, response: HttpResponse<unknown>): void {
    this.entries.set(this.key(request), {
      response: response.clone(),
      expiresAt: Date.now() + this.ttlFor(request.urlWithParams),
    });
  }

  getInFlight(key: string): Observable<HttpResponse<unknown>> | undefined {
    return this.inFlight.get(key);
  }

  setInFlight(key: string, request$: Observable<HttpResponse<unknown>>): void {
    this.inFlight.set(key, request$);
  }

  removeInFlight(key: string): void {
    this.inFlight.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  private ttlFor(url: string): number {
    if (url.includes('/notifications') || url.includes('/executions')) return 15_000;
    if (url.includes('/dashboard/')) return 30_000;
    if (url.includes('/users/me')) return 60_000;
    if (
      url.includes('/filters') ||
      url.includes('/capabilities') ||
      url.includes('/templates') ||
      url.includes('/classifications') ||
      url.includes('/targets') ||
      url.includes('/production')
    )
      return 300_000;
    return 30_000;
  }
}
