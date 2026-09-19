import { Component, ElementRef, HostListener, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UiIcon } from '../../ui-icon';
import { UserRole, roleLabel } from './users.service';

const ROLES: readonly UserRole[] = ['analista', 'gestor', 'admin'];

@Component({
  selector: 'app-user-role-select',
  imports: [UiIcon],
  template: `
    <div class="role-select">
      <button
        type="button"
        class="role-select-trigger"
        aria-haspopup="listbox"
        [attr.aria-expanded]="expanded()"
        aria-controls="user-role-options"
        [attr.aria-label]="ariaLabel()"
        [disabled]="isDisabled()"
        (click)="toggle()"
        (keydown)="handleKeydown($event)"
      >
        <span>{{ roleLabel(value()) }}</span>
        <ui-icon name="chevron-down" />
      </button>
      @if (expanded()) {
        <ul id="user-role-options" class="role-select-options" role="listbox" [attr.aria-label]="ariaLabel()">
          @for (role of roles; track role) {
            <li
              role="option"
              tabindex="-1"
              [attr.aria-selected]="value() === role"
              [class.selected]="value() === role"
              (click)="select(role)"
              (keydown)="handleKeydown($event)"
            >
              {{ roleLabel(role) }}
            </li>
          }
        </ul>
      }
    </div>
  `,
  styleUrl: './user-role-select.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UserRoleSelect),
      multi: true,
    },
  ],
})
export class UserRoleSelect implements ControlValueAccessor {
  private readonly element = inject(ElementRef<HTMLElement>);
  readonly ariaLabel = input.required<string>();
  readonly locked = input(false);
  readonly roles = ROLES;
  readonly value = signal<UserRole>('analista');
  readonly expanded = signal(false);
  readonly disabled = signal(false);
  readonly roleLabel = roleLabel;
  private onChange: (value: UserRole) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: UserRole | null): void {
    if (value && ROLES.includes(value)) this.value.set(value);
  }

  registerOnChange(onChange: (value: UserRole) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
    if (disabled) this.expanded.set(false);
  }

  toggle(): void {
    if (this.isDisabled()) return;
    this.expanded.update((expanded) => !expanded);
    this.onTouched();
  }

  select(role: UserRole): void {
    if (this.isDisabled()) return;
    this.value.set(role);
    this.onChange(role);
    this.onTouched();
    this.expanded.set(false);
  }

  handleKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) return;

    if (event.key === 'Escape') {
      this.expanded.set(false);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle();
      return;
    }
    const currentIndex = ROLES.indexOf(this.value());
    const nextIndex =
      event.key === 'ArrowDown'
        ? Math.min(currentIndex + 1, ROLES.length - 1)
        : event.key === 'ArrowUp'
          ? Math.max(currentIndex - 1, 0)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? ROLES.length - 1
              : null;
    if (nextIndex === null) return;
    event.preventDefault();
    this.expanded.set(true);
    this.select(ROLES[nextIndex]);
  }

  @HostListener('document:click', ['$event'])
  closeWhenClickingOutside(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.expanded.set(false);
  }

  isDisabled(): boolean {
    return this.disabled() || this.locked();
  }
}
