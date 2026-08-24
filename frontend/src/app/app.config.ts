import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withFetch(),
      withXsrfConfiguration({
        cookieName: 'csrf_token',
        headerName: 'X-CSRF-Token',
      }),
    ),
    provideRouter(routes),
    provideClientHydration(),
  ],
};
