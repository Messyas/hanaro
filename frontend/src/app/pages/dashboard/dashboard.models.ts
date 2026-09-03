export type DashboardMetric = 'usd' | 'qty';
export type DashboardAnalysis = 'absolute' | 'relative';
export type DashboardRankingLimit = 5 | 10;
export type DashboardDataState = 'api' | 'api-empty' | 'loading' | 'mock';
export type DashboardEvolutionView = 'monthly' | 'weekly';
export type DashboardComparison = 'ytd' | 'yoy' | 'mom';

export interface DashboardFilters {
  year: string;
  period: string;
  product: readonly string[];
  line: readonly string[];
  division: readonly string[];
  week: readonly string[];
  component: string;
}

export type DashboardFilterKey = keyof DashboardFilters;
export type DashboardMultiFilterKey = 'product' | 'line' | 'division' | 'week';
export type DashboardSingleFilterKey = Exclude<DashboardFilterKey, DashboardMultiFilterKey>;

export interface DashboardFilterChip {
  key: DashboardFilterKey;
  label: string;
  values: readonly string[];
}

export interface DashboardFilterOptions {
  years: readonly string[];
  periods: readonly { value: string; label: string }[];
  products: readonly string[];
  lines: readonly string[];
  divisions: readonly string[];
  weeks: readonly string[];
  components: readonly string[];
}

export interface DashboardMonthlyPoint {
  month: string;
  actualUsd: number | null;
  previousUsd: number | null;
  targetUsd: number;
  actualQty: number | null;
  previousQty: number | null;
  targetQty: number;
  materialAmountUsd: number;
  previousMaterialAmountUsd: number;
  productionQty: number;
  previousProductionQty: number;
}

export interface DashboardDistributionItem {
  label: string;
  usd: number;
  qty: number;
  relativeUsd?: number;
  relativeQty?: number;
}

export interface DashboardSnapshot {
  monthly: readonly DashboardMonthlyPoint[];
  weekly: readonly DashboardMonthlyPoint[];
  distribution: readonly DashboardDistributionItem[];
  relativeDistribution: readonly DashboardDistributionItem[];
  lastUpdatedAt: string;
}

export interface DashboardKpis {
  actual: number;
  target: number;
  achievement: number;
  variation: number;
}

export interface RelativeDashboardKpis {
  rate: number;
  numerator: number;
  denominator: number;
  variation: number;
}
