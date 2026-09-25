import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { apiCacheInterceptor } from './core/http/api-cache.interceptor';
import { BROWSER_DOWNLOAD } from './modules/reports/browser-download.port';
import { BrowserDownloadAdapter } from './modules/reports/browser-download.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiCacheInterceptor]),
      withXsrfConfiguration({
        cookieName: 'csrf_token',
        headerName: 'X-CSRF-Token',
      }),
    ),
    provideRouter(routes),
    provideClientHydration(),
    { provide: BROWSER_DOWNLOAD, useExisting: BrowserDownloadAdapter },
  ],
};
