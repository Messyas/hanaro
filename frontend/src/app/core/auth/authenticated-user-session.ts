import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthenticatedUserSession {
  private readonly auth = inject(AuthService);

  refresh(): Observable<boolean> {
    return this.auth.refreshSession();
  }
}
