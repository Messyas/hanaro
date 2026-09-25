import { Component, computed, input } from '@angular/core';
import {
  ReportAnalytics,
  ReportDocumentEvidence,
  ReportDocumentSection,
  ReportDocumentV2,
} from '../../reports.models';

@Component({
  selector: 'app-report-preview',
  templateUrl: './report-preview.html',
  styleUrl: './report-preview.css',
})
export class ReportPreview {
  readonly document = input.required<ReportDocumentV2>();
  readonly stale = input(false);
  readonly generatedAt = input<string | null>(null);
  protected readonly currency = computed(() => this.document().analytics.metric.currency);
  protected readonly totalPareto = computed(() =>
    this.document().analytics.pareto_lines.reduce(
      (total, item) => total + this.number(item.total),
      0,
    ),
  );

  protected formatAmount(value: string | null | undefined): string {
    if (value === null || value === undefined) return 'Indisponível';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: this.currency(),
      maximumFractionDigits: 2,
    }).format(this.number(value));
  }

  protected formatDate(value: string | null): string {
    if (!value) return 'Não informado';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
      new Date(`${value}T00:00:00`),
    );
  }

  protected narrative(section: ReportDocumentSection): string | null {
    const value = section.payload['narrative'] ?? section.payload['text'];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  protected evidenceFile(evidence: ReportDocumentEvidence) {
    return evidence.published ?? evidence.preview ?? null;
  }

  protected comparisonTotal(analytics: ReportAnalytics): string | null {
    return analytics.comparison?.total ?? null;
  }

  protected difference(analytics: ReportAnalytics): string | null {
    if (!analytics.comparison) return null;
    return (this.number(analytics.total) - this.number(analytics.comparison.total)).toString();
  }

  protected paretoWidth(value: string): number {
    const total = this.totalPareto();
    return total > 0 ? Math.max(2, (this.number(value) / total) * 100) : 0;
  }
  protected trendHeight(value: string, monthly: Array<{ period: string; total: string }>): number {
    const max = Math.max(...monthly.map((item) => this.number(item.total)), 0);
    return max > 0 ? Math.max(8, (this.number(value) / max) * 100) : 8;
  }

  private number(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
