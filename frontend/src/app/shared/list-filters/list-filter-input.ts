import { Component, input, model, output } from '@angular/core';
import { UiIcon } from '../../ui-icon';

@Component({
  selector: 'app-list-filter-input',
  imports: [UiIcon],
  templateUrl: './list-filter-input.html',
  styleUrl: './list-filter-input.css',
})
export class ListFilterInput {
  readonly value = model('');
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly type = input<'text' | 'search'>('text');
  readonly changed = output<string>();

  update(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.changed.emit(value);
  }

  clear(): void {
    this.value.set('');
    this.changed.emit('');
  }
}
