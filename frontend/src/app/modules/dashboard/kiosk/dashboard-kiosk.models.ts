export type KioskSlideId = 'executive' | 'factory' | 'offenders' | 'priorities';

export interface KioskSettings {
  autoRotate: boolean;
  intervalSeconds: number;
  activeSlide: number;
  factoryPeriod: 'month' | 'year';
}

export const DEFAULT_KIOSK_SETTINGS: KioskSettings = {
  autoRotate: true,
  intervalSeconds: 15,
  activeSlide: 0,
  factoryPeriod: 'month',
};

export interface KioskLineRankingItem {
  rank: number;
  line: string;
  occurrences: number;
  amountUsd: number;
  percentage: number;
  variation?: number | null;
}

export interface KioskSectorItem {
  sector: string;
  occurrences: number;
  percentage: number;
}

export interface KioskOffenderItem {
  name: string;
  amountUsd: number;
  percentage: number;
}

export interface KioskLineCostItem {
  line: string;
  amountUsd: number;
  percentage: number;
}

export interface KioskPriorityOccurrence {
  id: string;
  partNumber: string;
  amountUsd: number;
  category: string;
  description: string;
  critical: boolean;
}

export interface KioskReviewStatusSummary {
  pending: number;
  inReview: number;
  justified: number;
}

export interface KioskPredominantCategory {
  name: string;
  percentage: number;
}

export interface KioskSummaryStats {
  scrapUnits: number;
  transactions: number;
  criticalAlerts: number;
}
