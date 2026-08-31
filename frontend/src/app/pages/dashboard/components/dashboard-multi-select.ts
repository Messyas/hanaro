import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { UiIcon } from '../../../ui-icon';

@Component({
  selector: 'app-dashboard-multi-select',
  imports: [UiIcon],
  template: `
    <label>{{ label() }}</label>
    <details #details class="dashboard-multi" (toggle)="handleToggle()">
      <summary class="dashboard-multi-summary" [attr.aria-label]="label() + ': ' + summary()">
        <span>{{ summary() }}</span>
        <ui-icon name="chevron-down" />
      </summary>
      <div class="dashboard-multi-menu">
        <label class="dashboard-multi-search">
          <input
            type="search"
            [attr.aria-label]="searchPlaceholder()"
            [placeholder]="searchPlaceholder()"
            [value]="searchTerm()"
            (input)="updateSearch($event)"
          />
        </label>
        <div class="dashboard-multi-options">
          @for (option of filteredOptions(); track option) {
            <label class="dashboard-multi-option">
              <input
                type="checkbox"
                [checked]="draft().includes(option)"
                (change)="toggleOption(option)"
              />
              <span>{{ option }}</span>
            </label>
          } @empty {
            <span class="dashboard-multi-empty">{{ noOptionsLabel() }}</span>
          }
        </div>
        <footer>
          <button type="button" class="multi-clear" (click)="clear()">{{ allLabel() }}</button>
          <button type="button" class="multi-apply" (click)="apply()">{{ applyLabel() }}</button>
        </footer>
      </div>
    </details>
  `,
  styleUrl: './dashboard-multi-select.css',
})
export class DashboardMultiSelect {
  readonly label = input.required<string>();
  readonly options = input.required<readonly string[]>();
  readonly selected = input.required<readonly string[]>();
  readonly allLabel = input('Todos');
  readonly applyLabel = input('Aplicar');
  readonly selectedPlural = input('selecionados');
  readonly searchLabel = input('Buscar');
  readonly noOptionsLabel = input('Nenhuma opção encontrada');
  readonly selectionChange = output<readonly string[]>();
  readonly draft = signal<readonly string[]>([]);
  readonly searchTerm = signal('');
  readonly details = viewChild<ElementRef<HTMLDetailsElement>>('details');
  readonly searchPlaceholder = computed(
    () => `${this.searchLabel()} ${this.label().toLowerCase()}`,
  );
  readonly filteredOptions = computed(() => {
    const search = this.normalize(this.searchTerm());
    if (!search) return this.options();

    return this.options().filter((option) => this.normalize(option).includes(search));
  });

  summary(): string {
    const selected = this.selected();
    if (!selected.length) return this.allLabel();
    if (selected.length === 1) return selected[0];
    return `${selected.length} ${this.selectedPlural()}`;
  }

  handleToggle(): void {
    if (this.details()?.nativeElement.open) {
      this.draft.set([...this.selected()]);
      return;
    }
    this.searchTerm.set('');
  }

  updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  toggleOption(option: string): void {
    this.draft.update((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    );
  }

  clear(): void {
    this.selectionChange.emit([]);
    this.close();
  }

  apply(): void {
    this.selectionChange.emit(this.draft());
    this.close();
  }

  private close(): void {
    const details = this.details()?.nativeElement;
    if (details) details.open = false;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }
}
