import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DashboardStatusService {
  readonly label = signal<string | null>(null);

  set(label: string): void {
    this.label.set(label);
  }

  clear(): void {
    this.label.set(null);
  }
}
