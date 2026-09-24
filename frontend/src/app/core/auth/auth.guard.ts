import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const authenticatedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth
    .ensureSessionChecked()
    .pipe(map((authenticated) => authenticated || router.createUrlTree(['/dashboard'])));
};

export const superuserGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .ensureSessionChecked()
    .pipe(map(() => auth.user()?.is_superuser === true || router.createUrlTree(['/dashboard'])));
};

/** Keeps developer administrators in their operational area: users and executions. */
export const adminScopeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // The session cookie belongs to the browser. SSR has no browser session to
  // evaluate, and the same route is evaluated again during hydration.
  if (!isPlatformBrowser(platformId)) return true;

  return auth
    .ensureSessionChecked()
    .pipe(
      map(() =>
        auth.user()?.role === 'admin' || auth.user()?.is_superuser === true
          ? router.createUrlTree(['/execucoes'])
          : true,
      ),
    );
};
