import { Component, HostListener, input, model, output, signal } from '@angular/core';
import { UiIcon } from '../../ui-icon';

export interface ListFilterSelectOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'app-list-filter-select',
  imports: [UiIcon],
  templateUrl: './list-filter-select.html',
  styleUrl: './list-filter-select.css',
  host: {
    '[class.select-inline]': "layout() === 'inline'",
    '[class.menu-up]': "menuPosition() === 'up'",
  },
})
export class ListFilterSelect {
  readonly value = model('');
  readonly options = input.required<readonly ListFilterSelectOption[]>();
  readonly label = input('');
  readonly ariaLabel = input('Selecionar opção');
  readonly layout = input<'stacked' | 'inline'>('stacked');
  readonly menuPosition = input<'down' | 'up'>('down');
  readonly changed = output<string>();
  readonly open = signal(false);

  selectedLabel(): string {
    return this.options().find((option) => option.value === this.value())?.label ?? '';
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((open) => !open);
  }

  select(value: string): void {
    this.value.set(value);
    this.open.set(false);
    this.changed.emit(value);
  }

  @HostListener('document:click', ['$event'])
  closeOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && !target.closest('app-list-filter-select')) this.open.set(false);
  }
}
