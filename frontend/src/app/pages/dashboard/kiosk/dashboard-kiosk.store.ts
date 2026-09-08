import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_KIOSK_SETTINGS,
  KioskLineCostItem,
  KioskLineRankingItem,
  KioskOffenderItem,
  KioskPredominantCategory,
  KioskPriorityOccurrence,
  KioskReviewStatusSummary,
  KioskSectorItem,
  KioskSettings,
  KioskSummaryStats,
} from './dashboard-kiosk.models';
import { DashboardMonthlyPoint } from '../dashboard.models';

const STORAGE_KEY = 'hanaro_kiosk_settings_v1';

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

interface DashboardApiResponse {
  metadata?: { generated_at?: string };
  kpis?: {
    actual: string | number;
    target?: string | number | null;
    target_attainment_percent?: string | number | null;
    previous_year_actual?: string | number;
    previous_year_variation_percent?: string | number | null;
  };
  monthly?: Array<{
    period: string;
    actual: string | number | null;
    previous_year: string | number | null;
    target: string | number | null;
  }>;
  rankings?: {
    components?: Array<{ key: string | null; amount: string | number; record_count: number }>;
    lines?: Array<{ key: string | null; amount: string | number; record_count: number }>;
    models?: Array<{ key: string | null; amount: string | number; record_count: number }>;
    offenders?: Array<{ key: string | null; amount: string | number; record_count: number }>;
  };
  priority_occurrences?: Array<{
    key: string | null;
    amount: string | number;
    record_count: number;
  }>;
}

interface ScrapSummaryResponse {
  total_records: number;
  total_issue_quantity: string | number;
  total_amount_usd: string | number;
  counted_records: number;
  last_successful_ingestion_at?: string;
}

interface ScrapBreakdownItemResponse {
  key: string | null;
  metric: string | number;
  record_count: number;
}

@Injectable()
export class DashboardKioskStore {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Settings & state
  readonly settings = signal<KioskSettings>(this.loadStoredSettings());
  readonly dataState = signal<'loading' | 'api' | 'simulated'>('loading');
  readonly lastUpdated = signal<string>('15/08/2026 10:00');
  readonly progressPercent = signal<number>(0);
  readonly isPaused = signal<boolean>(false);

  // Core KPIs
  readonly ifCostActual = signal<number>(184260);
  readonly ifCostPreviousYear = signal<number>(367137);
  readonly ifCostVariation = signal<number>(-49.8);
  readonly ifCostTarget = signal<number>(290386);
  readonly targetAttainment = signal<number>(63.5);

  // Monthly points for chart
  readonly monthlyPoints = signal<DashboardMonthlyPoint[]>(this.defaultMonthlyPoints());

  // Top Components Pareto
  readonly topComponents = signal<Array<{ name: string; amountUsd: number; percentage: number }>>([
    { name: 'PCBA', amountUsd: 33700, percentage: 88 },
    { name: 'Tape', amountUsd: 29800, percentage: 78 },
    { name: 'Cover', amountUsd: 23700, percentage: 62 },
  ]);

  // Summary stats (unidades de scrap, transações, alertas)
  readonly summaryStats = signal<KioskSummaryStats>({
    scrapUnits: 1247,
    transactions: 96,
    criticalAlerts: 3,
  });

  // Slide 2: Factory Mode (Gamificação de linhas)
  readonly factoryOccurrencesTotal = signal<number>(12);
  readonly factoryLeaderLine = signal<{ name: string; occurrences: number }>({
    name: 'BM1',
    occurrences: 3,
  });
  readonly factoryMonitoredLinesCount = signal<number>(5);
  readonly factoryPriorPeriodOccurrences = signal<number>(12);

  readonly assemblyLinesRanking = signal<KioskLineRankingItem[]>([
    { rank: 1, line: 'BM1', occurrences: 3, amountUsd: 11100, percentage: 100, variation: 0 },
    { rank: 2, line: 'G12', occurrences: 3, amountUsd: 14300, percentage: 100, variation: 0 },
    { rank: 3, line: 'PCB01', occurrences: 2, amountUsd: 9200, percentage: 66, variation: -1 },
    { rank: 4, line: 'G02', occurrences: 2, amountUsd: 8700, percentage: 66, variation: 0 },
    { rank: 5, line: 'Ventin', occurrences: 2, amountUsd: 11500, percentage: 66, variation: 1 },
  ]);

  readonly sectorsRanking = signal<KioskSectorItem[]>([
    { sector: 'Packing', occurrences: 3, percentage: 90 },
    { sector: 'Insert Box', occurrences: 3, percentage: 90 },
    { sector: 'Inspection', occurrences: 2, percentage: 60 },
    { sector: 'Adjustment / Test', occurrences: 2, percentage: 60 },
    { sector: 'Final Assembly', occurrences: 2, percentage: 60 },
  ]);

  // Slide 3: Offenders
  readonly topDefectsByCost = signal<KioskOffenderItem[]>([
    { name: 'Trinca no ponto de fixação', amountUsd: 36000, percentage: 95 },
    { name: 'Risco profundo no painel', amountUsd: 33100, percentage: 88 },
    { name: 'Falha no teste funcional', amountUsd: 31900, percentage: 85 },
    { name: 'Painel trincado por impacto', amountUsd: 23200, percentage: 62 },
    { name: 'Conector danificado', amountUsd: 15800, percentage: 42 },
  ]);

  readonly topLinesByCost = signal<KioskLineCostItem[]>([
    { line: 'Misp', amountUsd: 17200, percentage: 95 },
    { line: 'C02', amountUsd: 14300, percentage: 79 },
    { line: 'Quale', amountUsd: 12400, percentage: 68 },
    { line: 'Ventito', amountUsd: 11500, percentage: 63 },
    { line: 'G08', amountUsd: 11300, percentage: 62 },
    { line: 'BMCELL', amountUsd: 11100, percentage: 61 },
    { line: 'G05', amountUsd: 8300, percentage: 46 },
    { line: 'G15', amountUsd: 7000, percentage: 38 },
  ]);

  readonly mostCriticalPartNumber = signal<{ code: string; amountUsd: number }>({
    code: 'EAY65769201',
    amountUsd: 18703.94,
  });

  readonly mostCriticalDefect = signal<{ name: string; percentage: number }>({
    name: 'Trinca no ponto de fixação',
    percentage: 19.5,
  });

  // Slide 4: Priority Occurrences
  readonly priorityOccurrences = signal<KioskPriorityOccurrence[]>([
    {
      id: '1',
      partNumber: 'EAJ65714501',
      amountUsd: 8420.0,
      category: 'Module',
      description: 'Aumento de telas riscadas associado a objeto metálico encontrado na esteira',
      critical: true,
    },
    {
      id: '2',
      partNumber: 'EAY65769201',
      amountUsd: 2093.0,
      category: 'Cover Assembly',
      description:
        'Trinca no ponto de fixação: ocorrência acima do limite configurado no posto de parafusamento',
      critical: true,
    },
    {
      id: '3',
      partNumber: 'EAJ66284201',
      amountUsd: 2886.0,
      category: 'Chassis',
      description:
        'Falha no teste funcional: ocorrência acima do limite configurado no posto de montagem eletrônica',
      critical: true,
    },
  ]);

  readonly reviewStatusSummary = signal<KioskReviewStatusSummary>({
    pending: 90,
    inReview: 0,
    justified: 6,
  });

  readonly predominantCategories = signal<KioskPredominantCategory[]>([
    { name: 'Material', percentage: 42 },
    { name: 'Processo', percentage: 27 },
    { name: 'Máquina', percentage: 19 },
    { name: 'Outros', percentage: 12 },
  ]);

  // Timers and auto-rotation
  private tickerTimer: ReturnType<typeof setInterval> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private elapsedSeconds = 0;

  constructor() {
    if (this.isBrowser) {
      this.initTimers();
      this.loadAllData();
    }
  }

  destroy(): void {
    if (this.tickerTimer) {
      clearInterval(this.tickerTimer);
      this.tickerTimer = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // Actions
  toggleAutoRotate(): void {
    this.updateSettings({ autoRotate: !this.settings().autoRotate });
    this.elapsedSeconds = 0;
    this.progressPercent.set(0);
  }

  togglePause(): void {
    this.isPaused.update((p) => !p);
  }

  setIntervalSeconds(intervalSeconds: number): void {
    this.updateSettings({ intervalSeconds });
    this.elapsedSeconds = 0;
    this.progressPercent.set(0);
  }

  setSlide(activeSlide: number): void {
    const validSlide = Math.max(0, Math.min(3, activeSlide));
    this.updateSettings({ activeSlide: validSlide });
    this.elapsedSeconds = 0;
    this.progressPercent.set(0);
  }

  nextSlide(): void {
    const next = (this.settings().activeSlide + 1) % 4;
    this.setSlide(next);
  }

  prevSlide(): void {
    const prev = (this.settings().activeSlide + 3) % 4;
    this.setSlide(prev);
  }

  setFactoryPeriod(factoryPeriod: 'month' | 'year'): void {
    this.updateSettings({ factoryPeriod });
    this.loadFactoryData(factoryPeriod);
  }

  private updateSettings(partial: Partial<KioskSettings>): void {
    const updated = { ...this.settings(), ...partial };
    this.settings.set(updated);
    if (this.isBrowser) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore localStorage errors (e.g. private mode)
      }
    }
  }

  private loadStoredSettings(): KioskSettings {
    if (!this.isBrowser) return DEFAULT_KIOSK_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          autoRotate: typeof parsed.autoRotate === 'boolean' ? parsed.autoRotate : true,
          intervalSeconds: typeof parsed.intervalSeconds === 'number' ? parsed.intervalSeconds : 15,
          activeSlide: typeof parsed.activeSlide === 'number' ? parsed.activeSlide : 0,
          factoryPeriod: parsed.factoryPeriod === 'year' ? 'year' : 'month',
        };
      }
    } catch {
      // ignore JSON parse error
    }
    return DEFAULT_KIOSK_SETTINGS;
  }

  private initTimers(): void {
    // 1-second interval loop for progress and slide changes
    this.tickerTimer = setInterval(() => {
      if (!this.settings().autoRotate || this.isPaused()) return;

      const interval = Math.max(5, this.settings().intervalSeconds);
      this.elapsedSeconds += 1;

      const pct = Math.min(100, Math.round((this.elapsedSeconds / interval) * 100));
      this.progressPercent.set(pct);

      if (this.elapsedSeconds >= interval) {
        this.elapsedSeconds = 0;
        this.progressPercent.set(0);
        this.nextSlide();
      }
    }, 1000);

    // 5-minute background refresh to keep TV data fresh without reload
    this.refreshTimer = setInterval(() => {
      this.loadAllData(true);
    }, 300000);
  }

  async loadAllData(silent = false): Promise<void> {
    if (!this.isBrowser || !this.http) {
      this.dataState.set('simulated');
      return;
    }

    if (!silent) {
      this.dataState.set('loading');
    }

    try {
      const year = new Date().getFullYear();
      const [dashRes, summaryRes] = await Promise.allSettled([
        firstValueFrom(
          this.http.get<DashboardApiResponse>('/api/v1/dashboard/scrap', {
            params: new HttpParams()
              .set('year', String(year))
              .set('currency', 'USD')
              .set('metric', 'if_cost')
              .set('impact_mode', 'absolute')
              .set('ranking_limit', '10'),
          }),
        ),
        firstValueFrom(this.http.get<ScrapSummaryResponse>('/api/v1/dashboard/scrap/summary')),
      ]);

      let hasApiData = false;

      if (dashRes.status === 'fulfilled' && dashRes.value) {
        const d = dashRes.value;
        if (d.kpis && Number(d.kpis.actual) > 0) {
          hasApiData = true;
          this.ifCostActual.set(Number(d.kpis.actual));
          this.ifCostPreviousYear.set(Number(d.kpis.previous_year_actual ?? 0));
          this.ifCostVariation.set(Number(d.kpis.previous_year_variation_percent ?? 0));
          this.ifCostTarget.set(Number(d.kpis.target ?? 0));
          this.targetAttainment.set(Number(d.kpis.target_attainment_percent ?? 0));

          if (d.monthly && d.monthly.length > 0) {
            const monthlyByIndex = new Map(
              d.monthly.map((point) => [Number(point.period.slice(5, 7)) - 1, point]),
            );
            const mappedMonthly: DashboardMonthlyPoint[] = Array.from({ length: 12 }, (_, idx) => {
              const apiPoint = monthlyByIndex.get(idx);
              return {
                month: MONTH_NAMES[idx],
                actualUsd: apiPoint?.actual != null ? Number(apiPoint.actual) : null,
                previousUsd:
                  apiPoint?.previous_year != null ? Number(apiPoint.previous_year) : null,
                targetUsd: apiPoint?.target != null ? Number(apiPoint.target) : 0,
                actualQty: null,
                previousQty: null,
                targetQty: 0,
                materialAmountUsd: 0,
                previousMaterialAmountUsd: 0,
                productionQty: 0,
                previousProductionQty: 0,
              };
            });
            this.monthlyPoints.set(mappedMonthly);
          }

          if (d.rankings?.components && d.rankings.components.length > 0) {
            const max = Math.max(...d.rankings.components.map((c) => Number(c.amount)));
            this.topComponents.set(
              d.rankings.components.slice(0, 3).map((c) => ({
                name: c.key ?? 'Outros',
                amountUsd: Number(c.amount),
                percentage: max > 0 ? Math.round((Number(c.amount) / max) * 100) : 0,
              })),
            );
          }

          if (d.rankings?.lines && d.rankings.lines.length > 0) {
            const maxCost = Math.max(...d.rankings.lines.map((l) => Number(l.amount)));
            this.topLinesByCost.set(
              d.rankings.lines.slice(0, 8).map((l) => ({
                line: l.key ?? 'Linha',
                amountUsd: Number(l.amount),
                percentage: maxCost > 0 ? Math.round((Number(l.amount) / maxCost) * 100) : 0,
              })),
            );
          }

          if (d.rankings?.offenders && d.rankings.offenders.length > 0) {
            const maxOffender = Math.max(...d.rankings.offenders.map((o) => Number(o.amount)));
            this.topDefectsByCost.set(
              d.rankings.offenders.slice(0, 5).map((o) => ({
                name: o.key ?? 'Defeito',
                amountUsd: Number(o.amount),
                percentage:
                  maxOffender > 0 ? Math.round((Number(o.amount) / maxOffender) * 100) : 0,
              })),
            );
            const totalActual = Number(d.kpis.actual);
            const topDefect = d.rankings.offenders[0];
            this.mostCriticalDefect.set({
              name: topDefect.key ?? 'Trinca no ponto de fixação',
              percentage:
                totalActual > 0
                  ? Number(((Number(topDefect.amount) / totalActual) * 100).toFixed(1))
                  : 19.5,
            });
          }

          if (d.rankings?.models && d.rankings.models.length > 0) {
            const topModel = d.rankings.models[0];
            this.mostCriticalPartNumber.set({
              code: topModel.key ?? 'EAY65769201',
              amountUsd: Number(topModel.amount),
            });
          }
        }
      }

      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        const s = summaryRes.value;
        this.summaryStats.set({
          scrapUnits: Math.round(Number(s.total_issue_quantity ?? 1247)),
          transactions: Number(s.total_records ?? 96),
          criticalAlerts: 3,
        });
        if (s.last_successful_ingestion_at) {
          const dateObj = new Date(s.last_successful_ingestion_at);
          this.lastUpdated.set(
            `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`,
          );
        }
      }

      this.dataState.set(hasApiData ? 'api' : 'simulated');
    } catch {
      this.dataState.set('simulated');
    }
  }

  async loadFactoryData(period: 'month' | 'year'): Promise<void> {
    if (!this.isBrowser || !this.http) return;
    try {
      const year = new Date().getFullYear();
      let params = new HttpParams()
        .set('year', String(year))
        .set('group_by', 'receipt_department')
        .set('metric', 'records');

      if (period === 'month') {
        const currentMonth = new Date().getMonth() + 1;
        params = params
          .set('date_from', `${year}-${String(currentMonth).padStart(2, '0')}-01`)
          .set(
            'date_to',
            `${year}-${String(currentMonth).padStart(2, '0')}-${new Date(year, currentMonth, 0).getDate()}`,
          );
      }

      const breakdown = await firstValueFrom(
        this.http.get<ScrapBreakdownItemResponse[]>('/api/v1/dashboard/scrap/breakdown', {
          params,
        }),
      );

      if (breakdown && breakdown.length > 0) {
        const total = breakdown.reduce((acc, curr) => acc + curr.record_count, 0);
        this.factoryOccurrencesTotal.set(total);
        this.factoryMonitoredLinesCount.set(breakdown.length);

        const maxCount = Math.max(...breakdown.map((b) => b.record_count));
        const ranked: KioskLineRankingItem[] = breakdown.slice(0, 5).map((item, idx) => ({
          rank: idx + 1,
          line: item.key ?? `L${idx + 1}`,
          occurrences: item.record_count,
          amountUsd: Number(item.metric),
          percentage: maxCount > 0 ? Math.round((item.record_count / maxCount) * 100) : 0,
          variation: idx === 0 ? 0 : idx % 2 === 0 ? -1 : 1,
        }));
        this.assemblyLinesRanking.set(ranked);

        if (ranked.length > 0) {
          this.factoryLeaderLine.set({
            name: ranked[0].line,
            occurrences: ranked[0].occurrences,
          });
        }
      }
    } catch {
      // Keep existing values gracefully
    }
  }

  private defaultMonthlyPoints(): DashboardMonthlyPoint[] {
    const actuals = [18000, 17000, 16500, 15000, 24000, 22000, 14000, 13500];
    const previous = [
      19000, 18500, 23000, 31000, 36000, 37500, 39147, 43000, 26000, 24000, 25000, 26000,
    ];
    const target = 23000;

    return Array.from({ length: 12 }, (_, index) => ({
      month: MONTH_NAMES[index],
      actualUsd: index < actuals.length ? actuals[index] : null,
      previousUsd: previous[index],
      targetUsd: target,
      actualQty: null,
      previousQty: null,
      targetQty: 0,
      materialAmountUsd: 0,
      previousMaterialAmountUsd: 0,
      productionQty: 0,
      previousProductionQty: 0,
    }));
  }
}
