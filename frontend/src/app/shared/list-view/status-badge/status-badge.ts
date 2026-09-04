import { Component, input } from '@angular/core';

export type StatusBadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

@Component({
  selector: 'app-status-badge',
  imports: [],
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.css',
})
export class StatusBadge {
  readonly label = input.required<string>();
  readonly tone = input<StatusBadgeTone>('neutral');
}
