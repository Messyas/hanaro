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
  currentSelection: string;
  searchOptions: string;
  noFilterOptions: string;
  apply: string;
  simulatedData: string;
  apiEmptyData: string;
  apiData: string;
  loadingData: string;
  updated: string;
  clearSelection: string;
  moreFilters: string;
  lessFilters: string;
  analysisControlsAria: string;
  toggleAnalysisAria: string;
  absoluteImpact: string;
  relativeEfficiency: string;
  metricGroupAria: string;
  compareWith: string;
  compareYtd: string;
  compareYoy: string;
  compareMom: string;
  showValues: string;
  hideValues: string;
  executiveReading: string;
  comparisonReference: string;
  summaryOnTarget: string;
  summaryNeedsAttention: string;
  summaryRelative: string;
  summaryDetail: string;
  absoluteSummaryAria: string;
  relativeSummaryAria: string;
  ifCostActual: string;
  qtyActual: string;
  ifCostTarget: string;
  quantityReference: string;
  targetRegistered: string;
  targetAccumulated: string;
  targetAchievement: string;
  aboveTargetIsGood: string;
  targetGapAbove: string;
  targetGapBelow: string;
  targetGapOnTrack: string;
  targetGapAmount: string;
  targetGapReached: string;
  targetGapExceeded: string;
  percentagePoints: string;
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
  evolutionChart: string;
  chartFilters: string;
  clearChartFilters: string;
  monthlyTargetActual: string;
  weeklyTargetActual: string;
  monthlyQtyActual: string;
  weeklyQtyActual: string;
  ifCostRateMonthly: string;
  ifCostRateWeekly: string;
  qtyRateMonthly: string;
  qtyRateWeekly: string;
  monthlyView: string;
  weeklyView: string;
  currentMonthWeeks: string;
  topProducts: string;
  topLines: string;
  topModels: string;
  topOffenders: string;
  topComponents: string;
  participationSelectedPeriod: string;
  periodStatusAria: string;
  closedMonths: string;
  partialMonth: string;
  futureMonths: string;
  month: string;
  actual: string;
  reference: string;
  noData: string;
  noChartData: string;
  noChartDataTitle: string;
  noChartDataHint: string;
  noRelativeDataHint: string;
  hiddenValue: string;
  units: string;
  performanceAbsoluteAria: string;
  performanceRelativeAria: string;
  distributionAbsoluteAria: string;
  distributionRelativeAria: string;
  relativeProductRanking: string;
  relativeProductRankingHint: string;
  noRelativeRankingHint: string;
  scrapRate: string;
  scrapValue: string;
  productionValue: string;
  occurrences: string;
  rankingLimitAria: string;
  topFive: string;
  topTen: string;
  kioskModeTitle: string;
  kioskModeAria: string;
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
    currentSelection: 'Seleção atual',
    searchOptions: 'Buscar',
    noFilterOptions: 'Nenhuma opção encontrada',
    apply: 'Aplicar',
    simulatedData: 'Dados simulados',
    apiEmptyData: 'Dados simulados · API sem dados disponíveis',
    apiData: 'Dados da API',
    loadingData: 'Atualizando dados',
    updated: 'Atualizado às',
    clearSelection: 'Limpar seleção',
    moreFilters: 'Filtros',
    lessFilters: 'Menos filtros',
    analysisControlsAria: 'Controles de análise',
    toggleAnalysisAria: 'Alternar tipo de análise',
    absoluteImpact: 'Impacto absoluto',
    relativeEfficiency: 'Eficiência relativa',
    metricGroupAria: 'Métrica exibida',
    compareWith: 'Comparar com',
    compareYtd: 'YTD anterior',
    compareYoy: 'Mesmo mês ano anterior',
    compareMom: 'Mês anterior',
    showValues: 'Exibir valores',
    hideValues: 'Ocultar valores',
    executiveReading: 'Leitura executiva',
    comparisonReference: 'Referência',
    summaryOnTarget: 'Resultado dentro da meta planejada',
    summaryNeedsAttention: 'Resultado acima da meta planejada',
    summaryRelative: 'Eficiência relativa do recorte atual',
    summaryDetail: 'Variação calculada contra a referência selecionada',
    absoluteSummaryAria: 'Resumo de Material Scrap',
    relativeSummaryAria: 'Resumo de eficiência relativa',
    ifCostActual: 'IF Cost realizado',
    qtyActual: 'QTY Scrap realizada',
    ifCostTarget: 'Target de IF Cost',
    quantityReference: 'Quantidade de referência',
    targetRegistered: 'Meta cadastrada para',
    targetAccumulated: 'Meta acumulada até o último mês com dados',
    targetAchievement: 'Atingimento do target',
    aboveTargetIsGood: 'Acima de 100% é favorável',
    targetGapAbove: 'abaixo da meta (favorável)',
    targetGapBelow: 'acima da meta (atenção)',
    targetGapOnTrack: 'Dentro da meta',
    targetGapAmount: 'Diferença para a meta',
    targetGapReached: 'Dentro da meta',
    targetGapExceeded: 'Acima da meta',
    percentagePoints: 'p.p.',
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
    evolutionChart: 'Evolução do scrap',
    chartFilters: 'Filtros',
    clearChartFilters: 'Limpar filtros do gráfico',
    monthlyTargetActual: 'Target × realizado mensal',
    weeklyTargetActual: 'Target × realizado semanal',
    monthlyQtyActual: 'Quantidade realizada mensal',
    weeklyQtyActual: 'Quantidade realizada semanal',
    ifCostRateMonthly: 'Scrap Rate de IF Cost por mês',
    ifCostRateWeekly: 'Scrap Rate de IF Cost por semana',
    qtyRateMonthly: 'Scrap Rate por quantidade por mês',
    qtyRateWeekly: 'Scrap Rate por quantidade por semana',
    monthlyView: 'Mensal',
    weeklyView: 'Semanal',
    currentMonthWeeks: 'Semanas do período selecionado',
    topProducts: 'Top {count} produtos / áreas',
    topLines: 'Top {count} linhas',
    topModels: 'Top {count} modelos',
    topOffenders: 'Top {count} ofensores',
    topComponents: 'Top {count} componentes',
    participationSelectedPeriod: 'Participação no período selecionado',
    periodStatusAria: 'Status dos períodos',
    closedMonths: 'Jan–Jul fechados',
    partialMonth: 'Ago parcial',
    futureMonths: 'Set–Dez futuros',
    month: 'Mês',
    actual: 'Realizado',
    reference: 'Referência',
    noData: 'Sem dado',
    noChartData: 'Sem dados para os filtros selecionados',
    noChartDataTitle: 'Sem dados neste recorte',
    noChartDataHint: 'Ajuste os filtros locais ou troque a visão para conferir outro agrupamento.',
    noRelativeDataHint:
      'A taxa depende de denominador compatível; quando ele faltar, o gráfico fica indisponível.',
    hiddenValue: 'Valor oculto',
    units: 'unidades',
    performanceAbsoluteAria: 'IF Cost mensal comparando realizado, referência e target',
    performanceRelativeAria: 'Scrap Rate mensal comparando o ano atual e o anterior',
    distributionAbsoluteAria: 'Distribuição do scrap por produto ou área',
    distributionRelativeAria: 'Ranking de produtos por Scrap Rate',
    relativeProductRanking: 'Produtos com maior Scrap Rate',
    relativeProductRankingHint: 'Perda proporcional: scrap dividido pelo valor produzido',
    noRelativeRankingHint: 'Cadastre o valor produzido por produto para calcular este ranking.',
    scrapRate: 'Scrap Rate',
    scrapValue: 'Valor de scrap',
    productionValue: 'Valor produzido',
    occurrences: 'Ocorrências',
    rankingLimitAria: 'Quantidade de itens exibidos no ranking',
    topFive: 'Top 5',
    topTen: 'Top 10',
    kioskModeTitle: 'Modo Kiosk / TV Executiva',
    kioskModeAria: 'Abrir Dashboard em Modo Kiosk (TV 50")',
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
    currentSelection: 'Current selection',
    searchOptions: 'Search',
    noFilterOptions: 'No options found',
    apply: 'Apply',
    simulatedData: 'Simulated data',
    apiEmptyData: 'Simulated data · API has no available data',
    apiData: 'API data',
    loadingData: 'Updating data',
    updated: 'Updated at',
    clearSelection: 'Clear selection',
    moreFilters: 'Filters',
    lessFilters: 'Fewer filters',
    analysisControlsAria: 'Analysis controls',
    toggleAnalysisAria: 'Switch analysis type',
    absoluteImpact: 'Absolute impact',
    relativeEfficiency: 'Relative efficiency',
    metricGroupAria: 'Displayed metric',
    compareWith: 'Compare with',
    compareYtd: 'Previous YTD',
    compareYoy: 'Same month previous year',
    compareMom: 'Previous month',
    showValues: 'Show values',
    hideValues: 'Hide values',
    executiveReading: 'Executive reading',
    comparisonReference: 'Reference',
    summaryOnTarget: 'Result within the planned target',
    summaryNeedsAttention: 'Result above the planned target',
    summaryRelative: 'Relative efficiency for the current selection',
    summaryDetail: 'Variation calculated against the selected reference',
    absoluteSummaryAria: 'Material Scrap summary',
    relativeSummaryAria: 'Relative efficiency summary',
    ifCostActual: 'Actual IF Cost',
    qtyActual: 'Actual QTY Scrap',
    ifCostTarget: 'IF Cost target',
    quantityReference: 'Reference quantity',
    targetRegistered: 'Target registered for',
    targetAccumulated: 'Accumulated target through the latest month with data',
    targetAchievement: 'Target achievement',
    aboveTargetIsGood: 'Above 100% is favorable',
    targetGapAbove: 'below target (favorable)',
    targetGapBelow: 'above target (attention)',
    targetGapOnTrack: 'Within target',
    targetGapAmount: 'Difference to target',
    targetGapReached: 'Within target',
    targetGapExceeded: 'Above target',
    percentagePoints: 'p.p.',
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
    evolutionChart: 'Scrap evolution',
    chartFilters: 'Filters',
    clearChartFilters: 'Clear chart filters',
    monthlyTargetActual: 'Monthly target × actual',
    weeklyTargetActual: 'Weekly target × actual',
    monthlyQtyActual: 'Monthly actual quantity',
    weeklyQtyActual: 'Weekly actual quantity',
    ifCostRateMonthly: 'Monthly IF Cost Scrap Rate',
    ifCostRateWeekly: 'Weekly IF Cost Scrap Rate',
    qtyRateMonthly: 'Monthly quantity Scrap Rate',
    qtyRateWeekly: 'Weekly quantity Scrap Rate',
    monthlyView: 'Monthly',
    weeklyView: 'Weekly',
    currentMonthWeeks: 'Weeks in the selected period',
    topProducts: 'Top {count} products / areas',
    topLines: 'Top {count} lines',
    topModels: 'Top {count} models',
    topOffenders: 'Top {count} offenders',
    topComponents: 'Top {count} components',
    participationSelectedPeriod: 'Share in the selected period',
    periodStatusAria: 'Period status',
    closedMonths: 'Jan–Jul closed',
    partialMonth: 'Aug partial',
    futureMonths: 'Sep–Dec future',
    month: 'Month',
    actual: 'Actual',
    reference: 'Reference',
    noData: 'No data',
    noChartData: 'No data for the selected filters',
    noChartDataTitle: 'No data in this selection',
    noChartDataHint: 'Adjust the local filters or switch views to check another grouping.',
    noRelativeDataHint:
      'The rate depends on a compatible denominator; when it is missing, the chart is unavailable.',
    hiddenValue: 'Hidden value',
    units: 'units',
    performanceAbsoluteAria: 'Monthly IF Cost comparing actual, reference, and target',
    performanceRelativeAria: 'Monthly Scrap Rate comparing the current and previous years',
    distributionAbsoluteAria: 'Scrap distribution by product or area',
    distributionRelativeAria: 'Product ranking by Scrap Rate',
    relativeProductRanking: 'Products with highest Scrap Rate',
    relativeProductRankingHint: 'Proportional loss: scrap divided by production value',
    noRelativeRankingHint: 'Add production value by product to calculate this ranking.',
    scrapRate: 'Scrap Rate',
    scrapValue: 'Scrap value',
    productionValue: 'Production value',
    occurrences: 'Occurrences',
    rankingLimitAria: 'Number of ranking items displayed',
    topFive: 'Top 5',
    topTen: 'Top 10',
    kioskModeTitle: 'Kiosk Mode / Executive TV',
    kioskModeAria: 'Open Dashboard in Kiosk Mode (50" TV)',
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
    currentSelection: '현재 선택',
    searchOptions: '검색',
    noFilterOptions: '옵션을 찾을 수 없음',
    apply: '적용',
    simulatedData: '시뮬레이션 데이터',
    apiEmptyData: '시뮬레이션 데이터 · API 사용 가능 데이터 없음',
    apiData: 'API 데이터',
    loadingData: '데이터 업데이트 중',
    updated: '업데이트 시간',
    clearSelection: '선택 지우기',
    moreFilters: '필터',
    lessFilters: '필터 줄이기',
    analysisControlsAria: '분석 제어',
    toggleAnalysisAria: '분석 유형 전환',
    absoluteImpact: '절대 영향',
    relativeEfficiency: '상대 효율',
    metricGroupAria: '표시 지표',
    compareWith: '비교 기준',
    compareYtd: '전년 누계',
    compareYoy: '전년 동일 월',
    compareMom: '전월',
    showValues: '값 표시',
    hideValues: '값 숨기기',
    executiveReading: '경영 요약',
    comparisonReference: '기준',
    summaryOnTarget: '계획 목표 범위 내 결과',
    summaryNeedsAttention: '계획 목표를 초과한 결과',
    summaryRelative: '현재 선택 범위의 상대 효율',
    summaryDetail: '선택한 기준 대비 변동',
    absoluteSummaryAria: 'Material Scrap 요약',
    relativeSummaryAria: '상대 효율 요약',
    ifCostActual: '실제 IF Cost',
    qtyActual: '실제 QTY Scrap',
    ifCostTarget: 'IF Cost 목표',
    quantityReference: '기준 수량',
    targetRegistered: '목표 등록 연도',
    targetAccumulated: '데이터가 있는 마지막 월까지 누적된 목표',
    targetAchievement: '목표 달성률',
    aboveTargetIsGood: '100% 이상이면 양호',
    targetGapAbove: '목표 이하(양호)',
    targetGapBelow: '목표 초과(주의)',
    targetGapOnTrack: '목표 범위 내',
    targetGapAmount: '목표와의 차이',
    targetGapReached: '목표 범위 내',
    targetGapExceeded: '목표 초과',
    percentagePoints: 'p.p.',
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
    evolutionChart: '스크랩 추이',
    chartFilters: '필터',
    clearChartFilters: '차트 필터 지우기',
    monthlyTargetActual: '월별 목표 × 실적',
    weeklyTargetActual: '주별 목표 × 실적',
    monthlyQtyActual: '월별 실제 수량',
    weeklyQtyActual: '주별 실제 수량',
    ifCostRateMonthly: '월별 IF Cost Scrap Rate',
    ifCostRateWeekly: '주별 IF Cost Scrap Rate',
    qtyRateMonthly: '월별 수량 Scrap Rate',
    qtyRateWeekly: '주별 수량 Scrap Rate',
    monthlyView: '월별',
    weeklyView: '주별',
    currentMonthWeeks: '선택 기간의 주차',
    topProducts: '상위 {count}개 제품 / 영역',
    topLines: '상위 {count}개 라인',
    topModels: '상위 {count}개 모델',
    topOffenders: '상위 {count}개 원인',
    topComponents: '상위 {count}개 부품',
    participationSelectedPeriod: '선택 기간 비중',
    periodStatusAria: '기간 상태',
    closedMonths: '1–7월 마감',
    partialMonth: '8월 부분 집계',
    futureMonths: '9–12월 예정',
    month: '월',
    actual: '실적',
    reference: '기준',
    noData: '데이터 없음',
    noChartData: '선택한 필터에 대한 데이터 없음',
    noChartDataTitle: '선택 범위에 데이터 없음',
    noChartDataHint: '로컬 필터를 조정하거나 다른 보기로 확인하세요.',
    noRelativeDataHint: '비율은 호환되는 분모가 필요하며, 없으면 차트를 사용할 수 없습니다.',
    hiddenValue: '숨겨진 값',
    units: '개',
    performanceAbsoluteAria: '월별 IF Cost 실적, 기준 및 목표 비교',
    performanceRelativeAria: '현재 연도와 전년도의 월별 Scrap Rate 비교',
    distributionAbsoluteAria: '제품 또는 영역별 Scrap 분포',
    distributionRelativeAria: 'Scrap Rate별 제품 순위',
    relativeProductRanking: 'Scrap Rate가 높은 제품',
    relativeProductRankingHint: '비례 손실: Scrap을 생산 가치로 나눈 값',
    noRelativeRankingHint: '이 순위를 계산하려면 제품별 생산 가치를 등록하세요.',
    scrapRate: 'Scrap Rate',
    scrapValue: 'Scrap 가치',
    productionValue: '생산 가치',
    occurrences: '발생 건수',
    rankingLimitAria: '랭킹 표시 항목 수',
    topFive: '상위 5',
    topTen: '상위 10',
    kioskModeTitle: '키오스크 모드 / 임원용 TV',
    kioskModeAria: '키오스크 모드로 대시보드 열기 (50인치 TV)',
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
