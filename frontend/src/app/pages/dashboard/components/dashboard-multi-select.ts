import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
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
        <div class="dashboard-multi-options">
          @for (option of options(); track option) {
            <label class="dashboard-multi-option">
              <input
                type="checkbox"
                [checked]="draft().includes(option)"
                (change)="toggleOption(option)"
              />
              <span>{{ option }}</span>
            </label>
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
  readonly selectionChange = output<readonly string[]>();
  readonly draft = signal<readonly string[]>([]);
  readonly details = viewChild<ElementRef<HTMLDetailsElement>>('details');

  summary(): string {
    const selected = this.selected();
    if (!selected.length) return this.allLabel();
    if (selected.length === 1) return selected[0];
    return `${selected.length} ${this.selectedPlural()}`;
  }

  handleToggle(): void {
    if (this.details()?.nativeElement.open) this.draft.set([...this.selected()]);
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
}
