export interface CalendarGridOptions {
  viewDate: Date;
  selectedDate: string;
  minDate?: string;
  maxDate?: string;
}

export interface CalendarGridContext {
  selectedDate: string;
  minDate?: string;
  maxDate?: string;
  currentMonth: number;
}

export interface CalendarDay {
  readonly iso: string;
  readonly day: number;
  readonly currentMonth: boolean;
  readonly today: boolean;
  readonly selected: boolean;
  readonly disabled: boolean;
}

export function buildCalendarGrid(options: CalendarGridOptions): CalendarDay[] {
  const { viewDate, selectedDate, minDate, maxDate } = options;
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const gridStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - firstDay.getDay());
  const context: CalendarGridContext = {
    selectedDate,
    minDate,
    maxDate,
    currentMonth: viewDate.getMonth(),
  };

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return buildCalendarDay(date, context);
  });
}

export function buildCalendarDay(date: Date, context: CalendarGridContext): CalendarDay {
  const iso = formatIsoDate(date);
  return {
    iso,
    day: date.getDate(),
    currentMonth: date.getMonth() === context.currentMonth,
    today: iso === formatIsoDate(new Date()),
    selected: iso === context.selectedDate,
    disabled: Boolean(
      (context.minDate && iso < context.minDate) || (context.maxDate && iso > context.maxDate),
    ),
  };
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
