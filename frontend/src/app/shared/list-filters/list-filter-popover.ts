import { Component, input, model, output } from '@angular/core';
import { UiIcon } from '../../ui-icon';

@Component({
  selector: 'app-list-filter-popover',
  imports: [UiIcon],
  templateUrl: './list-filter-popover.html',
  styleUrl: './list-filter-popover.css',
})
export class ListFilterPopover {
  readonly open = model(false);
  readonly activeCount = input(0);
  readonly triggerLabel = input.required<string>();
  readonly title = input.required<string>();
  readonly clearLabel = input.required<string>();
  readonly applyLabel = input.required<string>();
  readonly cleared = output<void>();
  readonly applied = output<void>();

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((value) => !value);
  }

  close(): void {
    this.open.set(false);
  }

  clear(): void {
    this.cleared.emit();
  }

  apply(): void {
    this.open.set(false);
    this.applied.emit();
  }
}
