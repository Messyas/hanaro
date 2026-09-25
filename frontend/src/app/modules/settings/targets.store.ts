import { computed, Injectable, signal } from '@angular/core';
import { createMonthlyTargets } from './settings.calculations';

@Injectable()
export class TargetsStore {
  readonly selectedYear = signal(2026);
  readonly availableYears = signal<number[]>([2025, 2026, 2027]);
  readonly monthlyTargets = signal(
    createMonthlyTargets([
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]),
  );
  readonly previousYearTargets = signal<Record<number, number>>({});
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly feedback = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  readonly prefillMode = signal<'linear' | 'curve'>('curve');
  readonly prefillAnnualTotal = signal(120000);
  readonly prefillJanuaryValue = signal(12000);
  readonly prefillDecemberValue = signal(6000);
  readonly currentYearTotal = computed(() =>
    this.monthlyTargets().reduce((total, target) => total + (Number(target.amount) || 0), 0),
  );
  readonly currentYearAverage = computed(() =>
    this.currentYearTotal() > 0 ? this.currentYearTotal() / 12 : 0,
  );
  readonly previousYearTotal = computed(() => {
    const total = Object.values(this.previousYearTargets()).reduce(
      (sum, amount) => sum + (Number(amount) || 0),
      0,
    );
    return total > 0 ? total : null;
  });
  readonly previousYearVariationPercent = computed(() => {
    const previousTotal = this.previousYearTotal();
    const currentTotal = this.currentYearTotal();
    if (previousTotal === null || previousTotal === 0 || currentTotal === 0) return null;
    return ((currentTotal - previousTotal) / previousTotal) * 100;
  });
}
