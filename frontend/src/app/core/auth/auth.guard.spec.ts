import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { adminScopeGuard, authenticatedGuard } from './auth.guard';

describe('authenticatedGuard', () => {
  it('allows a route when the server session is valid', () => {
    const auth = { ensureSessionChecked: () => of(true) };
    const router = { createUrlTree: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });

    let result: unknown;
    TestBed.runInInjectionContext(() =>
      (authenticatedGuard(null as never, null as never) as Observable<boolean | object>).subscribe(
        (value) => (result = value),
      ),
    );
    expect(result).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('returns a dashboard UrlTree when the server session is absent', () => {
    const auth = { ensureSessionChecked: () => of(false) };
    const urlTree = { redirect: '/dashboard' };
    const router = { createUrlTree: vi.fn().mockReturnValue(urlTree) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });

    let result: unknown;
    TestBed.runInInjectionContext(() =>
      (authenticatedGuard(null as never, null as never) as Observable<boolean | object>).subscribe(
        (value) => (result = value),
      ),
    );
    expect(result).toBe(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });
});

describe('adminScopeGuard', () => {
  it('redirects a developer administrator to executions', () => {
    const auth = { ensureSessionChecked: () => of(true), user: () => ({ role: 'admin' }) };
    const urlTree = { redirect: '/execucoes' };
    const router = { createUrlTree: vi.fn().mockReturnValue(urlTree) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });

    let result: unknown;
    TestBed.runInInjectionContext(() =>
      (adminScopeGuard(null as never, null as never) as Observable<boolean | object>).subscribe(
        (value) => (result = value),
      ),
    );

    expect(result).toBe(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/execucoes']);
  });

  it('allows roles outside the developer administrator scope', () => {
    const auth = { ensureSessionChecked: () => of(true), user: () => ({ role: 'gestor' }) };
    const router = { createUrlTree: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });

    let result: unknown;
    TestBed.runInInjectionContext(() =>
      (adminScopeGuard(null as never, null as never) as Observable<boolean | object>).subscribe(
        (value) => (result = value),
      ),
    );

    expect(result).toBe(true);
  });
});
