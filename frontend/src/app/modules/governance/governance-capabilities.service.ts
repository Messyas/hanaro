import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface GovernanceCapabilities {
  exports_available: boolean;
  notifications_available: boolean;
}

@Injectable({ providedIn: 'root' })
export class GovernanceCapabilitiesService {
  private readonly http = inject(HttpClient);

  get() {
    return this.http.get<GovernanceCapabilities>(
      `${environment.apiBaseUrl}/governance/capabilities`,
    );
  }
}
