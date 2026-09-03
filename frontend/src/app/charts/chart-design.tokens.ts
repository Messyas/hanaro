export const CHART_DESIGN = {
  fontFamily: "'Fustat Variable', Fustat, sans-serif",
  primary: 'var(--brand-primary)',
  primaryHover: 'var(--brand-primary-hover)',
  grid: 'var(--app-chart-grid)',
  text: 'var(--app-text)',
  mutedText: 'var(--app-text-muted)',
  surface: 'var(--app-surface)',
  borderRadius: 8,

  /* Paleta de gráficos — acompanha light/dark automaticamente */
  barMain: 'var(--chart-bar-main)',
  barSec: 'var(--chart-bar-sec)',
  donut1: 'var(--chart-donut-1)',
  donut2: 'var(--chart-donut-2)',
  donut3: 'var(--chart-donut-3)',
  donut4: 'var(--chart-donut-4)',
} as const;

export interface ChartThemeTokens {
  fontFamily: string;
  primary: string;
  primaryHover: string;
  grid: string;
  text: string;
  mutedText: string;
  surface: string;
  reference: string;
  target: string;
  barMain: string;
  barSec: string;
}

export function getChartTheme(isDark: boolean): ChartThemeTokens {
  return {
    fontFamily: "'Fustat Variable', Fustat, sans-serif",
    primary: isDark ? '#e7194a' : '#a50034',
    primaryHover: isDark ? '#ff3366' : '#850029',
    grid: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e5e0db',
    text: isDark ? '#f5f5f5' : '#1a1a1a',
    mutedText: isDark ? '#8a8a8a' : '#888888',
    surface: isDark ? '#171717' : '#ffffff',
    reference: isDark ? '#66728d' : '#4b5563',
    target: '#5ad6b3',
    barMain: isDark ? '#e7194a' : '#a50034',
    barSec: isDark ? '#ff4d79' : '#f06584',
  };
}
