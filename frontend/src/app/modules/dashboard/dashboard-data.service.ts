import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import {
  DashboardFilters,
  DashboardMetric,
  DashboardMonthlyPoint,
  DashboardRankingLimit,
  DashboardSnapshot,
  RelativeDenominatorStatus,
} from './dashboard.models';

export const DASHBOARD_ALL_COMPONENTS = 'Todos';

interface DashboardApiRankingItem {
  key: string | null;
  amount: string;
  record_count: number;
}

interface DashboardApiRelativeRankingItem {
  key: string | null;
  numerator: string;
  denominator: string | null;
  rate: string | null;
  record_count: number;
  denominator_status: 'AVAILABLE' | 'MISSING_DENOMINATOR' | 'ZERO_DENOMINATOR';
}

interface DashboardApiSeriesPoint {
  period: string;
  actual: string | null;
  previous_year: string | null;
  target: string | null;
  denominator: string | null;
  previous_year_denominator: string | null;
  relative_status: RelativeDenominatorStatus;
  previous_year_relative_status: RelativeDenominatorStatus;
}

interface DashboardApiResponse {
  metadata: {
    generated_at: string;
  };
  monthly: DashboardApiSeriesPoint[];
  weekly?: DashboardApiSeriesPoint[];
  rankings: {
    products: DashboardApiRankingItem[];
    components?: DashboardApiRankingItem[];
    lines?: DashboardApiRankingItem[];
    models?: DashboardApiRankingItem[];
    offenders?: DashboardApiRankingItem[];
  };
  relative_product_ranking?: DashboardApiRelativeRankingItem[];
}

export interface ScrapFiltersResponse {
  organizations: string[];
  receipt_departments?: string[];
  departments: string[];
  item_types: string[];
  items: string[];
  account_aliases: string[];
  periods: string[];
}

const MONTH_NAMES = [
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
] as const;

@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  private readonly http = inject(HttpClient);

  getFilters(): Promise<ScrapFiltersResponse> {
    return firstValueFrom(
      this.http.get<ScrapFiltersResponse>(`${environment.apiBaseUrl}/scrap/filters`),
    );
  }

  getSnapshot(
    filters: DashboardFilters,
    metric: DashboardMetric,
    rankingLimit: DashboardRankingLimit,
  ): Promise<DashboardSnapshot> {
    return firstValueFrom(
      this.http
        .get<DashboardApiResponse>(`${environment.apiBaseUrl}/dashboard/scrap`, {
          params: this.apiParams(filters, rankingLimit, metric),
        })
        .pipe(map((response) => this.mapApiResponse(response, metric))),
    );
  }

  private apiParams(
    filters: DashboardFilters,
    rankingLimit: DashboardRankingLimit,
    metric: DashboardMetric,
  ): HttpParams {
    let params = new HttpParams()
      .set('year', filters.year)
      .set('currency', 'USD')
      .set('metric', metric === 'usd' ? 'if_cost' : 'quantity')
      .set('impact_mode', 'absolute')
      .set('ranking_limit', String(rankingLimit));

    params = this.appendValues(params, 'products', filters.product);
    params = this.appendValues(params, 'receipt_departments', filters.line);
    params = this.appendValues(params, 'divisions', filters.division);
    if (filters.component !== DASHBOARD_ALL_COMPONENTS) {
      params = params.append('item_types', filters.component);
    }
    if (filters.week.length === 1) {
      const week = Number(filters.week[0].replace(/\D/g, ''));
      if (Number.isFinite(week) && week > 0) params = params.set('week', String(week));
    }
    if (filters.period !== 'ytd') {
      const month = Number(filters.period) + 1;
      params = params
        .set('date_from', `${filters.year}-${String(month).padStart(2, '0')}-01`)
        .set('date_to', this.monthEndDate(filters.year, month));
    }

    return params;
  }

  private appendValues(params: HttpParams, key: string, values: readonly string[]): HttpParams {
    return values.reduce((nextParams, value) => nextParams.append(key, value), params);
  }

  private mapApiResponse(
    response: DashboardApiResponse,
    metric: DashboardMetric,
  ): DashboardSnapshot {
    const quantityMetric = metric === 'qty';
    const monthlyByIndex = new Map(
      response.monthly.map((point) => [Number(point.period.slice(5, 7)) - 1, point]),
    );
    const monthly: DashboardMonthlyPoint[] = Array.from({ length: 12 }, (_, index) => {
      const apiPoint = monthlyByIndex.get(index);
      const previousYearValue = apiPoint ? this.toNullableNumber(apiPoint.previous_year) : null;

      let actualUsd: number | null;
      if (quantityMetric) {
        actualUsd = null;
      } else if (apiPoint) {
        actualUsd = this.toNullableNumber(apiPoint.actual);
      } else {
        actualUsd = null;
      }

      let actualQty: number | null;
      if (quantityMetric) {
        actualQty = apiPoint ? this.toNullableNumber(apiPoint.actual) : null;
      } else {
        actualQty = null;
      }

      let targetUsd: number;
      if (quantityMetric) {
        targetUsd = 0;
      } else if (apiPoint) {
        targetUsd = this.toNullableNumber(apiPoint.target) ?? 0;
      } else {
        targetUsd = 0;
      }

      let previousQty: number | null;
      if (quantityMetric) {
        previousQty = apiPoint ? this.toNullableNumber(apiPoint.previous_year) : null;
      } else {
        previousQty = null;
      }

      return {
        month: MONTH_NAMES[index],
        actualUsd,
        previousUsd: quantityMetric ? null : previousYearValue,
        targetUsd,
        actualQty,
        previousQty,
        targetQty: 0,
        materialAmountUsd: apiPoint ? this.toNullableNumber(apiPoint.denominator) : null,
        previousMaterialAmountUsd: apiPoint
          ? this.toNullableNumber(apiPoint.previous_year_denominator)
          : null,
        productionQty: apiPoint ? this.toNullableNumber(apiPoint.denominator) : null,
        previousProductionQty: apiPoint
          ? this.toNullableNumber(apiPoint.previous_year_denominator)
          : null,
        relativeStatus: apiPoint?.relative_status ?? 'MISSING_DENOMINATOR',
        previousRelativeStatus: apiPoint?.previous_year_relative_status ?? 'MISSING_DENOMINATOR',
      };
    });

    return {
      monthly,
      weekly: (response.weekly ?? []).map((point) => this.mapApiWeeklyPoint(point, metric)),
      distribution: response.rankings.products.map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: Number(item.amount),
        qty: quantityMetric ? Number(item.amount) : item.record_count,
      })),
      components: (response.rankings.components ?? []).map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: Number(item.amount),
        qty: quantityMetric ? Number(item.amount) : item.record_count,
      })),
      lines: (response.rankings.lines ?? []).map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: Number(item.amount),
        qty: quantityMetric ? Number(item.amount) : item.record_count,
      })),
      models: (response.rankings.models ?? []).map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: Number(item.amount),
        qty: quantityMetric ? Number(item.amount) : item.record_count,
      })),
      offenders: (response.rankings.offenders ?? []).map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: Number(item.amount),
        qty: quantityMetric ? Number(item.amount) : item.record_count,
      })),
      relativeProducts: (response.relative_product_ranking ?? []).map((item) => ({
        label: item.key ?? 'Não classificado',
        usd: Number(item.numerator),
        qty: item.record_count,
        rate: this.toNullableNumber(item.rate),
        numerator: Number(item.numerator),
        denominator: this.toNullableNumber(item.denominator),
        recordCount: item.record_count,
        denominatorStatus: item.denominator_status,
      })),
      // Keep the source timestamp; the page formats only the time according
      // to the currently selected language.
      lastUpdatedAt: response.metadata.generated_at,
    };
  }

  private mapApiWeeklyPoint(
    point: DashboardApiSeriesPoint,
    metric: DashboardMetric,
  ): DashboardMonthlyPoint {
    const quantityMetric = metric === 'qty';
    return {
      month: this.weekLabel(point.period),
      actualUsd: quantityMetric ? null : this.toNullableNumber(point.actual),
      previousUsd: quantityMetric ? null : this.toNullableNumber(point.previous_year),
      targetUsd: quantityMetric ? 0 : (this.toNullableNumber(point.target) ?? 0),
      actualQty: quantityMetric ? this.toNullableNumber(point.actual) : null,
      previousQty: quantityMetric ? this.toNullableNumber(point.previous_year) : null,
      targetQty: 0,
      materialAmountUsd: this.toNullableNumber(point.denominator),
      previousMaterialAmountUsd: this.toNullableNumber(point.previous_year_denominator),
      productionQty: this.toNullableNumber(point.denominator),
      previousProductionQty: this.toNullableNumber(point.previous_year_denominator),
      relativeStatus: point.relative_status,
      previousRelativeStatus: point.previous_year_relative_status,
    };
  }

  private weekLabel(period: string): string {
    const match = /W(\d{1,2})$/.exec(period);
    return match ? `W${match[1]}` : period;
  }

  private monthEndDate(year: string, month: number): string {
    const date = new Date(Number(year), month, 0);
    return `${year}-${String(month).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // toNumber removed; use Number(...) directly

  private toNullableNumber(value: string | null): number | null {
    return value === null ? null : Number(value);
  }
}
