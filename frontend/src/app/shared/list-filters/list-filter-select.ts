import { Component, ElementRef, OnDestroy, OnInit, inject, input, model, output, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
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
export class ListFilterSelect implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly closeListener = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target && !this.elementRef.nativeElement.contains(target)) this.open.set(false);
  };

  readonly value = model('');
  readonly options = input.required<readonly ListFilterSelectOption[]>();
  readonly label = input('');
  readonly ariaLabel = input('Selecionar opção');
  readonly layout = input<'stacked' | 'inline'>('stacked');
  readonly menuPosition = input<'down' | 'up'>('down');
  readonly changed = output<string>();
  readonly open = signal(false);

  ngOnInit(): void {
    this.document.addEventListener('click', this.closeListener, true);
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('click', this.closeListener, true);
  }

  selectedLabel(): string {
    return this.options().find((option) => option.value === this.value())?.label ?? '';
  }

  toggle(event: Event): void {
    this.open.update((open) => !open);
  }

  select(value: string): void {
    this.value.set(value);
    this.open.set(false);
    this.changed.emit(value);
  }
}