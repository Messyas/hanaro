import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, defer, filter, finalize, of, shareReplay, tap } from 'rxjs';
import { ApiCacheService } from './api-cache.service';

export const apiCacheInterceptor: HttpInterceptorFn = (request, next) => {
  const cache = inject(ApiCacheService);

  if (request.method !== 'GET') {
    cache.clear();
    return next(request).pipe(
      tap((event) => {
        if (event instanceof HttpResponse && event.status >= 200 && event.status < 300)
          cache.clear();
      }),
    );
  }
  if (!cache.shouldCache(request)) return next(request);

  const cached = cache.get(request);
  if (cached) return of(cached);

  const key = cache.key(request);
  const existing = cache.getInFlight(key);
  if (existing) return existing;

  const generation = cache.currentGeneration();
  const events$ = defer(() => next(request)) as Observable<HttpEvent<unknown>>;
  const request$: Observable<HttpResponse<unknown>> = events$.pipe(
    filter((event): event is HttpResponse<unknown> => event instanceof HttpResponse),
    tap((response) => {
      if (response.status >= 200 && response.status < 300) cache.set(request, response, generation);
    }),
    finalize(() => cache.removeInFlight(key, request$)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );
  cache.setInFlight(key, request$);
  return request$;
};
