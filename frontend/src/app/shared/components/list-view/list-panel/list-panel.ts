import { Component, input } from '@angular/core';

@Component({
  selector: 'app-list-panel',
  imports: [],
  templateUrl: './list-panel.html',
  styleUrl: './list-panel.css',
})
export class ListPanel {
  readonly title = input.required<string>();
  readonly meta = input('');
}
