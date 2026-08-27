import { LanguageCode } from '../../i18n/language.service';

export interface DashboardTranslations {
  filtersAria: string;
  year: string;
  period: string;
  product: string;
  line: string;
  division: string;
  week: string;
  component: string;
  allMasculine: string;
  allFeminine: string;
  unavailableRelative: string;
  activeFilters: string;
  removeFilter: string;
  selectedPlural: string;
  apply: string;
  simulatedData: string;
  updated: string;
  clearSelection: string;
  analysisControlsAria: string;
  toggleAnalysisAria: string;
  absoluteImpact: string;
  relativeEfficiency: string;
  metricGroupAria: string;
  showValues: string;
  hideValues: string;
  absoluteSummaryAria: string;
  relativeSummaryAria: string;
  ifCostActual: string;
  qtyActual: string;
  ifCostTarget: string;
  qtyTarget: string;
  targetRegistered: string;
  targetAchievement: string;
  aboveTargetIsGood: string;
  ifCostVariation: string;
  qtyVariation: string;
  sameAccumulated: string;
  previousPeriod: string;
  sameMonth: string;
  ifCostRate: string;
  qtyRate: string;
  lowerIsBetter: string;
  ifCostSlice: string;
  qtySlice: string;
  rateNumerator: string;
  materialAmount: string;
  producedQuantity: string;
  sameRateSlice: string;
  rateVariation: string;
  monthlyTargetActual: string;
  ifCostRateMonthly: string;
  qtyRateMonthly: string;
  distributionByProduct: string;
  participationSelectedPeriod: string;
  highestRateLines: string;
  efficiencyRanking: string;
  periodStatusAria: string;
  closedMonths: string;
  partialMonth: string;
  futureMonths: string;
  month: string;
  actual: string;
  reference: string;
  noData: string;
  hiddenValue: string;
  units: string;
  performanceAbsoluteAria: string;
  performanceRelativeAria: string;
  distributionAbsoluteAria: string;
  distributionRelativeAria: string;
}

export const DASHBOARD_TRANSLATIONS: Record<LanguageCode, DashboardTranslations> = {
  pt: {
    filtersAria: 'Filtros da dashboard',
    year: 'Ano',
    period: 'Período',
    product: 'Produto',
    line: 'Linha',
    division: 'Divisão',
    week: 'Semana',
    component: 'Componente',
    allMasculine: 'Todos',
    allFeminine: 'Todas',
    unavailableRelative: 'Indisponível na análise relativa',
    activeFilters: 'Filtros ativos',
    removeFilter: 'Remover filtro',
    selectedPlural: 'selecionados',
    apply: 'Aplicar',
    simulatedData: 'Dados simulados',
    updated: 'atualizados',
    clearSelection: 'Limpar seleção',
    analysisControlsAria: 'Controles de análise',
    toggleAnalysisAria: 'Alternar tipo de análise',
    absoluteImpact: 'Impacto absoluto',
    relativeEfficiency: 'Eficiência relativa',
    metricGroupAria: 'Métrica exibida',
    showValues: 'Exibir valores',
    hideValues: 'Ocultar valores',
    absoluteSummaryAria: 'Resumo de Material Scrap',
    relativeSummaryAria: 'Resumo de eficiência relativa',
    ifCostActual: 'IF Cost realizado',
    qtyActual: 'QTY Scrap realizada',
    ifCostTarget: 'Target de IF Cost',
    qtyTarget: 'Target de QTY Scrap',
    targetRegistered: 'Meta cadastrada para',
    targetAchievement: 'Atingimento do target',
    aboveTargetIsGood: 'Acima de 100% é favorável',
    ifCostVariation: 'Variação do IF Cost',
    qtyVariation: 'Variação da QTY Scrap',
    sameAccumulated: 'Mesmo acumulado de',
    previousPeriod: 'Período anterior',
    sameMonth: 'Mesmo mês de',
    ifCostRate: 'Scrap Rate de IF Cost',
    qtyRate: 'Scrap Rate por quantidade',
    lowerIsBetter: 'Quanto menor, melhor',
    ifCostSlice: 'IF Cost do recorte',
    qtySlice: 'QTY Scrap do recorte',
    rateNumerator: 'Numerador da taxa',
    materialAmount: 'Material Amount',
    producedQuantity: 'Quantidade produzida',
    sameRateSlice: 'Mesmo recorte da taxa',
    rateVariation: 'Variação da taxa',
    monthlyTargetActual: 'Target × realizado mensal',
    ifCostRateMonthly: 'Scrap Rate de IF Cost por mês',
    qtyRateMonthly: 'Scrap Rate por quantidade por mês',
    distributionByProduct: 'Distribuição por produto / área',
    participationSelectedPeriod: 'Participação no período selecionado',
    highestRateLines: 'Linhas com maior taxa',
    efficiencyRanking: 'Ranking de eficiência no recorte atual',
    periodStatusAria: 'Status dos períodos',
    closedMonths: 'Jan–Jul fechados',
    partialMonth: 'Ago parcial',
    futureMonths: 'Set–Dez futuros',
    month: 'Mês',
    actual: 'Realizado',
    reference: 'Referência',
    noData: 'Sem dado',
    hiddenValue: 'Valor oculto',
    units: 'unidades',
    performanceAbsoluteAria: 'IF Cost mensal comparando realizado, referência e target',
    performanceRelativeAria: 'Scrap Rate mensal comparando o ano atual e o anterior',
    distributionAbsoluteAria: 'Distribuição do scrap por produto ou área',
    distributionRelativeAria: 'Linhas com maior Scrap Rate',
  },
  en: {
    filtersAria: 'Dashboard filters',
    year: 'Year',
    period: 'Period',
    product: 'Product',
    line: 'Line',
    division: 'Division',
    week: 'Week',
    component: 'Component',
    allMasculine: 'All',
    allFeminine: 'All',
    unavailableRelative: 'Unavailable in relative analysis',
    activeFilters: 'Active filters',
    removeFilter: 'Remove filter',
    selectedPlural: 'selected',
    apply: 'Apply',
    simulatedData: 'Simulated data',
    updated: 'updated',
    clearSelection: 'Clear selection',
    analysisControlsAria: 'Analysis controls',
    toggleAnalysisAria: 'Switch analysis type',
    absoluteImpact: 'Absolute impact',
    relativeEfficiency: 'Relative efficiency',
    metricGroupAria: 'Displayed metric',
    showValues: 'Show values',
    hideValues: 'Hide values',
    absoluteSummaryAria: 'Material Scrap summary',
    relativeSummaryAria: 'Relative efficiency summary',
    ifCostActual: 'Actual IF Cost',
    qtyActual: 'Actual QTY Scrap',
    ifCostTarget: 'IF Cost target',
    qtyTarget: 'QTY Scrap target',
    targetRegistered: 'Target registered for',
    targetAchievement: 'Target achievement',
    aboveTargetIsGood: 'Above 100% is favorable',
    ifCostVariation: 'IF Cost variation',
    qtyVariation: 'QTY Scrap variation',
    sameAccumulated: 'Same accumulated period in',
    previousPeriod: 'Previous period',
    sameMonth: 'Same month in',
    ifCostRate: 'IF Cost Scrap Rate',
    qtyRate: 'Quantity Scrap Rate',
    lowerIsBetter: 'Lower is better',
    ifCostSlice: 'IF Cost in selection',
    qtySlice: 'QTY Scrap in selection',
    rateNumerator: 'Rate numerator',
    materialAmount: 'Material Amount',
    producedQuantity: 'Produced quantity',
    sameRateSlice: 'Same rate selection',
    rateVariation: 'Rate variation',
    monthlyTargetActual: 'Monthly target × actual',
    ifCostRateMonthly: 'Monthly IF Cost Scrap Rate',
    qtyRateMonthly: 'Monthly quantity Scrap Rate',
    distributionByProduct: 'Distribution by product / area',
    participationSelectedPeriod: 'Share in the selected period',
    highestRateLines: 'Lines with the highest rate',
    efficiencyRanking: 'Efficiency ranking in the current selection',
    periodStatusAria: 'Period status',
    closedMonths: 'Jan–Jul closed',
    partialMonth: 'Aug partial',
    futureMonths: 'Sep–Dec future',
    month: 'Month',
    actual: 'Actual',
    reference: 'Reference',
    noData: 'No data',
    hiddenValue: 'Hidden value',
    units: 'units',
    performanceAbsoluteAria: 'Monthly IF Cost comparing actual, reference, and target',
    performanceRelativeAria: 'Monthly Scrap Rate comparing the current and previous years',
    distributionAbsoluteAria: 'Scrap distribution by product or area',
    distributionRelativeAria: 'Lines with the highest Scrap Rate',
  },
  ko: {
    filtersAria: '대시보드 필터',
    year: '연도',
    period: '기간',
    product: '제품',
    line: '라인',
    division: '부문',
    week: '주차',
    component: '부품',
    allMasculine: '전체',
    allFeminine: '전체',
    unavailableRelative: '상대 분석에서는 사용할 수 없음',
    activeFilters: '활성 필터',
    removeFilter: '필터 제거',
    selectedPlural: '개 선택',
    apply: '적용',
    simulatedData: '시뮬레이션 데이터',
    updated: '업데이트',
    clearSelection: '선택 지우기',
    analysisControlsAria: '분석 제어',
    toggleAnalysisAria: '분석 유형 전환',
    absoluteImpact: '절대 영향',
    relativeEfficiency: '상대 효율',
    metricGroupAria: '표시 지표',
    showValues: '값 표시',
    hideValues: '값 숨기기',
    absoluteSummaryAria: 'Material Scrap 요약',
    relativeSummaryAria: '상대 효율 요약',
    ifCostActual: '실제 IF Cost',
    qtyActual: '실제 QTY Scrap',
    ifCostTarget: 'IF Cost 목표',
    qtyTarget: 'QTY Scrap 목표',
    targetRegistered: '목표 등록 연도',
    targetAchievement: '목표 달성률',
    aboveTargetIsGood: '100% 이상이면 양호',
    ifCostVariation: 'IF Cost 변동',
    qtyVariation: 'QTY Scrap 변동',
    sameAccumulated: '동일 누적 기간',
    previousPeriod: '이전 기간',
    sameMonth: '전년도 동일 월',
    ifCostRate: 'IF Cost Scrap Rate',
    qtyRate: '수량 Scrap Rate',
    lowerIsBetter: '낮을수록 좋음',
    ifCostSlice: '선택 범위 IF Cost',
    qtySlice: '선택 범위 QTY Scrap',
    rateNumerator: '비율 분자',
    materialAmount: 'Material Amount',
    producedQuantity: '생산 수량',
    sameRateSlice: '동일 비율 범위',
    rateVariation: '비율 변동',
    monthlyTargetActual: '월별 목표 × 실적',
    ifCostRateMonthly: '월별 IF Cost Scrap Rate',
    qtyRateMonthly: '월별 수량 Scrap Rate',
    distributionByProduct: '제품 / 영역별 분포',
    participationSelectedPeriod: '선택 기간 비중',
    highestRateLines: '비율이 높은 라인',
    efficiencyRanking: '현재 선택 범위 효율 순위',
    periodStatusAria: '기간 상태',
    closedMonths: '1–7월 마감',
    partialMonth: '8월 부분 집계',
    futureMonths: '9–12월 예정',
    month: '월',
    actual: '실적',
    reference: '기준',
    noData: '데이터 없음',
    hiddenValue: '숨겨진 값',
    units: '개',
    performanceAbsoluteAria: '월별 IF Cost 실적, 기준 및 목표 비교',
    performanceRelativeAria: '현재 연도와 전년도의 월별 Scrap Rate 비교',
    distributionAbsoluteAria: '제품 또는 영역별 Scrap 분포',
    distributionRelativeAria: 'Scrap Rate가 높은 라인',
  },
};

export const DASHBOARD_MONTHS: Record<LanguageCode, readonly string[]> = {
  pt: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ko: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
};

export const DASHBOARD_LOCALES: Record<LanguageCode, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  ko: 'ko-KR',
};
