import {
  Component,
  HostListener,
  WritableSignal,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { UiIcon } from '../../ui-icon';
import { CalendarDay, buildCalendarDay, buildCalendarGrid } from './calendar-grid';

@Component({
  selector: 'app-list-filter-date-range',
  imports: [UiIcon],
  templateUrl: './list-filter-date-range.html',
  styleUrl: './list-filter-date-range.css',
  host: {
    '[class.single-date]': 'single()',
    '[class.calendar-up]': "popupPosition() === 'up'",
  },
})
export class ListFilterDateRange {
  readonly from = model('');
  readonly to = model('');
  readonly fromLabel = input.required<string>();
  readonly toLabel = input.required<string>();
  readonly locale = input('pt-BR');
  readonly clearLabel = input('Limpar');
  readonly todayLabel = input('Hoje');
  readonly single = input(false);
  readonly popupPosition = input<'down' | 'up'>('down');
  readonly changed = output<void>();

  readonly fromOpen = signal(false);
  readonly toOpen = signal(false);
  readonly fromView = signal(new Date());
  readonly toView = signal(new Date());
  readonly fromDays = computed(() =>
    buildCalendarGrid({
      viewDate: this.fromView(),
      selectedDate: this.from(),
      maxDate: this.to(),
    }),
  );
  readonly toDays = computed(() =>
    buildCalendarGrid({
      viewDate: this.toView(),
      selectedDate: this.to(),
      minDate: this.from(),
    }),
  );
  readonly rangeError = computed(() =>
    Boolean(this.from() && this.to() && this.to() < this.from()),
  );

  @HostListener('document:click', ['$event'])
  closeOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && !target.closest('app-list-filter-date-range')) {
      this.fromOpen.set(false);
      this.toOpen.set(false);
    }
  }

  toggleFrom(event: Event): void {
    event.stopPropagation();
    this.fromOpen.update((open) => !open);
    this.toOpen.set(false);
    this.syncView(this.from(), this.fromView);
  }

  toggleTo(event: Event): void {
    event.stopPropagation();
    this.toOpen.update((open) => !open);
    this.fromOpen.set(false);
    this.syncView(this.to(), this.toView);
  }

  updateFrom(event: Event): void {
    const value = this.normalize((event.target as HTMLInputElement).value);
    if (!value || this.valid(value)) {
      this.from.set(value);
      if (this.to() && this.to() < value) this.to.set('');
      this.emitChanged();
    }
  }

  updateTo(event: Event): void {
    const value = this.normalize((event.target as HTMLInputElement).value);
    if ((!value || this.valid(value)) && (!this.from() || value >= this.from())) {
      this.to.set(value);
      this.emitChanged();
    }
  }

  selectFrom(day: CalendarDay): void {
    if (day.disabled) return;
    this.from.set(day.iso);
    if (this.to() && this.to() < day.iso) this.to.set('');
    this.fromOpen.set(false);
    this.emitChanged();
  }

  selectTo(day: CalendarDay): void {
    if (day.disabled) return;
    this.to.set(day.iso);
    this.toOpen.set(false);
    this.emitChanged();
  }

  clearFrom(): void {
    this.from.set('');
    this.fromOpen.set(false);
    this.emitChanged();
  }
  clearTo(): void {
    this.to.set('');
    this.toOpen.set(false);
    this.emitChanged();
  }
  setTodayFrom(): void {
    this.selectFrom(
      buildCalendarDay(new Date(), {
        selectedDate: this.from(),
        maxDate: this.to(),
        currentMonth: this.fromView().getMonth(),
      }),
    );
  }
  setTodayTo(): void {
    this.selectTo(
      buildCalendarDay(new Date(), {
        selectedDate: this.to(),
        minDate: this.from(),
        currentMonth: this.toView().getMonth(),
      }),
    );
  }
  previousFrom(): void {
    this.fromView.update((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1));
  }
  nextFrom(): void {
    this.fromView.update((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1));
  }
  previousTo(): void {
    this.toView.update((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1));
  }
  nextTo(): void {
    this.toView.update((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1));
  }

  monthLabel(date: Date): string {
    return date.toLocaleDateString(this.locale(), { month: 'long', year: 'numeric' });
  }

  weekdays(): string[] {
    const sunday = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) => {
      const value = new Date(sunday);
      value.setDate(sunday.getDate() + index);
      return value.toLocaleDateString(this.locale(), { weekday: 'short' }).replace('.', '');
    });
  }

  format(value: string): string {
    return value ? value.replaceAll('-', '/') : '';
  }

  private syncView(value: string, target: WritableSignal<Date>): void {
    if (value && this.valid(value)) target.set(new Date(`${value}T00:00:00`));
  }
  private emitChanged(): void {
    this.changed.emit();
  }
  private normalize(value: string): string {
    return value.trim().replaceAll('/', '-');
  }
  private valid(value: string): boolean {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
    );
  }
}
