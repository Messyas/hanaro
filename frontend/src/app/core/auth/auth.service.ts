import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  email: string;
  notification_email: string | null;
  phone: string | null;
  job_title: string | null;
  role: 'gestor' | 'analista' | 'admin';
  profile_image_url: string | null;
  is_superuser: boolean;
}

interface AuthCheckResponse {
  authenticated: boolean;
  user?: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly currentUser = signal<AuthUser | null>(null);
  private readonly authenticationStatus = signal<'checking' | 'anonymous' | 'authenticated'>(
    'checking',
  );
  private checkRequest?: Observable<boolean>;

  readonly user = this.currentUser.asReadonly();
  readonly status = this.authenticationStatus.asReadonly();
  readonly isAuthenticated = computed(() => this.authenticationStatus() === 'authenticated');

  ensureSessionChecked(): Observable<boolean> {
    if (this.authenticationStatus() !== 'checking') return of(this.isAuthenticated());
    if (this.checkRequest) return this.checkRequest;

    this.checkRequest = this.fetchSession();
    return this.checkRequest;
  }

  refreshSession(): Observable<boolean> {
    this.authenticationStatus.set('checking');
    this.currentUser.set(null);
    this.checkRequest = undefined;
    this.checkRequest = this.fetchSession();
    return this.checkRequest;
  }

  login(username: string, password: string): Observable<boolean> {
    const body = new HttpParams().set('username', username.trim()).set('password', password);

    return this.http
      .post<{ csrf_token: string }>(`${environment.apiBaseUrl}/auth/login`, body)
      .pipe(switchMap(() => this.refreshSession()));
  }

  logout(): Observable<unknown> {
    return this.http
      .post(`${environment.apiBaseUrl}/auth/logout`, {})
      .pipe(tap(() => this.clearSession()));
  }

  clearSession(): void {
    this.currentUser.set(null);
    this.authenticationStatus.set('anonymous');
    this.checkRequest = undefined;
  }

  private fetchSession(): Observable<boolean> {
    return this.http.get<AuthCheckResponse>(`${environment.apiBaseUrl}/auth/check-auth`).pipe(
      map<AuthCheckResponse, boolean>((response) => {
        if (response.authenticated && response.user) {
          this.currentUser.set(response.user);
          this.authenticationStatus.set('authenticated');
          return true;
        }

        this.clearSession();
        return false;
      }),
      catchError<boolean, Observable<boolean>>(() => {
        this.clearSession();
        return of(false);
      }),
      finalize(() => (this.checkRequest = undefined)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }
}
