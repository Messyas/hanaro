import { computed, Injectable, signal } from '@angular/core';

export type ProductionField = 'productionValue' | 'productionQuantity' | 'note';

export interface ProductionMonthRow {
  month: number;
  revision: number;
  productionValue: number | null;
  productionQuantity: number | null;
  note: string;
}

function createProductionMonths(): ProductionMonthRow[] {
  return Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    revision: 0,
    productionValue: null,
    productionQuantity: null,
    note: '',
  }));
}

@Injectable()
export class ProductionStore {
  readonly selectedYear = signal(2026);
  readonly availableYears = signal<number[]>([2025, 2026, 2027]);
  readonly months = signal<ProductionMonthRow[]>(createProductionMonths());
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly feedback = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  readonly filledMonths = computed(
    () =>
      this.months().filter((row) => row.productionValue !== null || row.productionQuantity !== null)
        .length,
  );
  readonly hasErrors = computed(() =>
    this.months().some(
      (row) =>
        (row.productionValue !== null &&
          (!Number.isFinite(row.productionValue) || row.productionValue < 0)) ||
        (row.productionQuantity !== null &&
          (!Number.isFinite(row.productionQuantity) || row.productionQuantity < 0)),
    ),
  );

  createEmptyMonths(): ProductionMonthRow[] {
    return createProductionMonths();
  }
}
