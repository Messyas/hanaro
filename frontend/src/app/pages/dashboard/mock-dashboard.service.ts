import { Injectable } from '@angular/core';
import {
  DashboardFilterOptions,
  DashboardFilters,
  DashboardMonthlyPoint,
  DashboardSnapshot,
} from './dashboard.models';

type MockMonthlyPoint = Omit<
  DashboardMonthlyPoint,
  'materialAmountUsd' | 'previousMaterialAmountUsd' | 'productionQty' | 'previousProductionQty'
>;

const MONTHLY_DATA: readonly MockMonthlyPoint[] = [
  {
    month: 'Jan',
    actualUsd: 27_400,
    previousUsd: 26_000,
    targetUsd: 27_091,
    actualQty: 171,
    previousQty: 184,
    targetQty: 161,
  },
  {
    month: 'Fev',
    actualUsd: 26_150,
    previousUsd: 25_000,
    targetUsd: 26_596,
    actualQty: 153,
    previousQty: 168,
    targetQty: 146,
  },
  {
    month: 'Mar',
    actualUsd: 23_600,
    previousUsd: 24_000,
    targetUsd: 26_100,
    actualQty: 126,
    previousQty: 201,
    targetQty: 139,
  },
  {
    month: 'Abr',
    actualUsd: 32_400,
    previousUsd: 31_000,
    targetUsd: 25_605,
    actualQty: 184,
    previousQty: 173,
    targetQty: 130,
  },
  {
    month: 'Mai',
    actualUsd: 24_800,
    previousUsd: 28_000,
    targetUsd: 25_410,
    actualQty: 151,
    previousQty: 219,
    targetQty: 168,
  },
  {
    month: 'Jun',
    actualUsd: 18_100,
    previousUsd: 36_000,
    targetUsd: 24_920,
    actualQty: 119,
    previousQty: 232,
    targetQty: 150,
  },
  {
    month: 'Jul',
    actualUsd: 12_700,
    previousUsd: 39_000,
    targetUsd: 23_813,
    actualQty: 84,
    previousQty: 226,
    targetQty: 135,
  },
  {
    month: 'Ago',
    actualUsd: 19_110,
    previousUsd: 41_347,
    targetUsd: 23_324,
    actualQty: 131,
    previousQty: 241,
    targetQty: 138,
  },
  {
    month: 'Set',
    actualUsd: null,
    previousUsd: null,
    targetUsd: 22_728,
    actualQty: null,
    previousQty: null,
    targetQty: 201,
  },
  {
    month: 'Out',
    actualUsd: null,
    previousUsd: null,
    targetUsd: 22_136,
    actualQty: null,
    previousQty: null,
    targetQty: 159,
  },
  {
    month: 'Nov',
    actualUsd: null,
    previousUsd: null,
    targetUsd: 21_538,
    actualQty: null,
    previousQty: null,
    targetQty: 82,
  },
  {
    month: 'Dez',
    actualUsd: null,
    previousUsd: null,
    targetUsd: 21_125,
    actualQty: null,
    previousQty: null,
    targetQty: 104,
  },
];

const BASE_DISTRIBUTION = [
  { label: 'BM', usd: 49_900, qty: 284 },
  { label: 'VS', usd: 46_800, qty: 261 },
  { label: 'AV', usd: 38_300, qty: 226 },
  { label: 'TV', usd: 31_200, qty: 191 },
  { label: 'MNT', usd: 18_060, qty: 157 },
] as const;

const MATERIAL_AMOUNT_USD = [
  24_100_000, 23_350_000, 24_870_000, 26_050_000, 27_160_000, 26_420_000, 25_130_000, 24_480_000,
  25_910_000, 26_680_000, 24_760_000, 25_210_000,
] as const;
const PREVIOUS_MATERIAL_AMOUNT_USD = [
  23_420_000, 22_810_000, 23_960_000, 25_380_000, 26_240_000, 25_710_000, 24_380_000, 23_920_000,
  25_100_000, 25_870_000, 24_010_000, 24_460_000,
] as const;
const PRODUCTION_QTY = [
  142_000, 137_500, 145_900, 151_300, 157_800, 153_900, 146_600, 143_200, 150_500, 154_700, 144_100,
  147_000,
] as const;
const PREVIOUS_PRODUCTION_QTY = [
  136_800, 133_100, 139_600, 147_200, 151_900, 149_100, 141_800, 138_900, 145_600, 149_900, 139_600,
  142_400,
] as const;

const RELATIVE_DISTRIBUTION = [
  { label: 'BMCELL', usd: 0, qty: 0, relativeUsd: 0.1294, relativeQty: 0.1682 },
  { label: 'Quale', usd: 0, qty: 0, relativeUsd: 0.1168, relativeQty: 0.1514 },
  { label: 'G08', usd: 0, qty: 0, relativeUsd: 0.0985, relativeQty: 0.1378 },
  { label: 'C02', usd: 0, qty: 0, relativeUsd: 0.0841, relativeQty: 0.1196 },
  { label: 'Ventito', usd: 0, qty: 0, relativeUsd: 0.0717, relativeQty: 0.1043 },
] as const;

const FILTER_FACTORS: Partial<Record<keyof DashboardFilters, Record<string, number>>> = {
  product: { BM: 0.27, VS: 0.25, AV: 0.21, TV: 0.17, MNT: 0.1 },
  line: { BMCELL: 0.31, Quale: 0.24, G08: 0.2, C02: 0.15, Ventito: 0.1 },
  division: { HE: 0.56, MS: 0.29, ES: 0.15 },
  component: { Module: 0.32, PCBA: 0.27, Tape: 0.18, Cover: 0.13, Chassis: 0.1 },
  week: { W31: 0.19, W32: 0.22, W33: 0.2, W34: 0.21, W35: 0.18 },
};

@Injectable({ providedIn: 'root' })
export class MockDashboardService {
  readonly options: DashboardFilterOptions = {
    years: ['2026', '2025'],
    periods: [
      { value: 'ytd', label: 'Acumulado no ano' },
      ...MONTHLY_DATA.slice(0, 8).map((item, index) => ({
        value: String(index),
        label: item.month,
      })),
    ],
    products: BASE_DISTRIBUTION.map((item) => item.label),
    lines: ['BMCELL', 'Quale', 'G08', 'C02', 'Ventito'],
    divisions: ['HE', 'MS', 'ES'],
    weeks: ['W31', 'W32', 'W33', 'W34', 'W35'],
    components: ['Module', 'PCBA', 'Tape', 'Cover', 'Chassis'],
  };

  getSnapshot(filters: DashboardFilters): DashboardSnapshot {
    const factor = this.filterFactor(filters);
    const yearFactor = filters.year === '2025' ? 1.08 : 1;
    const scale = factor * yearFactor;
    const selectedIndexes =
      filters.period === 'ytd'
        ? MONTHLY_DATA.slice(0, 8).map((_, index) => index)
        : [Number(filters.period)];
    const usdPeriodScale = this.periodScale(selectedIndexes, 'actualUsd');
    const qtyPeriodScale = this.periodScale(selectedIndexes, 'actualQty');

    return {
      monthly: MONTHLY_DATA.map((point, index) => ({
        ...point,
        actualUsd: this.scaleNullable(point.actualUsd, scale),
        previousUsd: this.scaleNullable(point.previousUsd, scale),
        targetUsd: Math.round(point.targetUsd * factor),
        actualQty: this.scaleNullable(point.actualQty, scale),
        previousQty: this.scaleNullable(point.previousQty, scale),
        targetQty: Math.round(point.targetQty * factor),
        materialAmountUsd: Math.round(MATERIAL_AMOUNT_USD[index] * factor),
        previousMaterialAmountUsd: Math.round(PREVIOUS_MATERIAL_AMOUNT_USD[index] * factor),
        productionQty: Math.round(PRODUCTION_QTY[index] * factor),
        previousProductionQty: Math.round(PREVIOUS_PRODUCTION_QTY[index] * factor),
      })),
      distribution: BASE_DISTRIBUTION.filter(
        (item) => !filters.product.length || filters.product.includes(item.label),
      ).map((item) => ({
        ...item,
        usd: Math.round(
          item.usd * this.filterFactor(filters, 'product') * yearFactor * usdPeriodScale,
        ),
        qty: Math.round(
          item.qty * this.filterFactor(filters, 'product') * yearFactor * qtyPeriodScale,
        ),
      })),
      relativeDistribution: RELATIVE_DISTRIBUTION.filter(
        (item) => !filters.line.length || filters.line.includes(item.label),
      ).map((item) => ({
        ...item,
        relativeUsd: item.relativeUsd * (filters.product.length ? 1.06 : 1),
        relativeQty: item.relativeQty * (filters.product.length ? 1.04 : 1),
      })),
      lastUpdatedAt: 'Hoje, 10:00',
    };
  }

  private filterFactor(filters: DashboardFilters, skippedKey?: keyof DashboardFilters): number {
    return (Object.keys(FILTER_FACTORS) as (keyof DashboardFilters)[]).reduce((factor, key) => {
      if (key === skippedKey) return factor;
      const value = filters[key];
      const dimensionFactor =
        typeof value === 'string'
          ? FILTER_FACTORS[key]?.[value]
          : value.reduce((sum, item) => sum + (FILTER_FACTORS[key]?.[item] ?? 0), 0) || 1;
      return factor * (dimensionFactor ?? 1);
    }, 1);
  }

  private scaleNullable(value: number | null, factor: number): number | null {
    return value === null ? null : Math.round(value * factor);
  }

  private periodScale(
    selectedIndexes: readonly number[],
    metric: 'actualUsd' | 'actualQty',
  ): number {
    const accumulated = MONTHLY_DATA.slice(0, 8).reduce(
      (sum, point) => sum + (point[metric] ?? 0),
      0,
    );
    const selected = selectedIndexes.reduce(
      (sum, index) => sum + (MONTHLY_DATA[index]?.[metric] ?? 0),
      0,
    );
    return accumulated > 0 ? selected / accumulated : 0;
  }
}
