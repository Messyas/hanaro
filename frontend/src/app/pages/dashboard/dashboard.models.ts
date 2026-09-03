export type DashboardMetric = 'usd' | 'qty';
export type DashboardAnalysis = 'absolute' | 'relative';
export type DashboardRankingLimit = 5 | 10;
export type DashboardDataState = 'api' | 'api-empty' | 'loading' | 'error';
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
  components: readonly DashboardDistributionItem[];
  lines: readonly DashboardDistributionItem[];
  models: readonly DashboardDistributionItem[];
  offenders: readonly DashboardDistributionItem[];
  lastUpdatedAt: string;
}

export interface DashboardKpis {
  actual: number;
  reference: number;
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

export const EMPTY_SNAPSHOT: DashboardSnapshot = {
  monthly: [],
  weekly: [],
  distribution: [],
  relativeDistribution: [],
  components: [],
  lines: [],
  models: [],
  offenders: [],
  lastUpdatedAt: '',
};

export const DEFAULT_FILTER_OPTIONS: DashboardFilterOptions = {
  years: ['2026', '2025', '2024'],
  periods: [
    { value: 'ytd', label: 'Acumulado no ano' },
    { value: '0', label: 'Jan' },
    { value: '1', label: 'Fev' },
    { value: '2', label: 'Mar' },
    { value: '3', label: 'Abr' },
    { value: '4', label: 'Mai' },
    { value: '5', label: 'Jun' },
    { value: '6', label: 'Jul' },
    { value: '7', label: 'Ago' },
    { value: '8', label: 'Set' },
    { value: '9', label: 'Out' },
    { value: '10', label: 'Nov' },
    { value: '11', label: 'Dez' },
  ],
  products: ['TV', 'AV', 'BM', 'MNT'],
  lines: ['BMCELL', 'Quale', 'G08', 'C02', 'Ventito', 'G05', 'A02', 'PCB01', 'Misp', 'G15', 'BM1'],
  divisions: ['HE', 'BM', 'MNT'],
  weeks: ['W31', 'W32', 'W33', 'W34', 'W35'],
  components: [
    'Module',
    'PCBA',
    'Cover Assembly',
    'Chassis',
    'Cover',
    'Base',
    'Tape',
    'Lens',
    'Box',
    'Packing',
    'Gasket',
    'Sheet',
  ],
};
