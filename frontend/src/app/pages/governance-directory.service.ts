import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Person } from './governance.models';

@Injectable({ providedIn: 'root' })
export class GovernanceDirectoryService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

  people(search = '', page = 1) {
    return this.http.get<Person[]>(`${this.base}/governance/participants`, {
      params: { search, page },
    });
  }

  tiers() {
    return this.http.get<{ data: Person[] }>(`${this.base}/tiers/`, {
      params: { page: 1, items_per_page: 100 },
    });
  }
}
