import { LanguageCode } from '../../../i18n/language.service';

export interface KioskTranslations {
  executiveTag: string;
  executiveTitle: string;
  factoryTag: string;
  factoryTitle: string;
  offendersTag: string;
  offendersTitle: string;
  prioritiesTag: string;
  prioritiesTitle: string;

  slideExecutive: string;
  slideFactory: string;
  slideOffenders: string;
  slidePriorities: string;

  pause: string;
  play: string;
  autoRotate: string;
  interval: string;
  fullscreen: string;
  exitFullscreen: string;
  exit: string;
  seconds: string;
  lightTheme: string;
  darkTheme: string;

  ifCostAccumulated: string;
  samePeriodPrior: string;
  yoyReference: string;
  variationVsPrior: string;
  lowerIsBetter: string;
  targetAccumulated: string;
  registeredTarget: string;
  targetAchievement: string;
  evolutionTitle: string;
  topComponentsTitle: string;
  scrapUnits: string;
  transactions: string;
  criticalAlerts: string;
  simulatedData: string;
  apiData: string;
  updatedAt: string;
  scheduledEvery2Hours: string;

  period: string;
  month: string;
  year: string;
  currentVsPrior: string;
  occurrences: string;
  leaderLine: string;
  monitoredLines: string;
  priorPeriod: string;
  comparableOccurrences: string;
  generalConsolidated: string;
  assemblyLines: string;
  sectorsWithMostOccurrences: string;
  occurrencesUnit: string;
  variation: string;

  top5DefectsByCost: string;
  top8LinesByCost: string;
  mostCriticalPartNumber: string;
  mostCriticalDefect: string;
  highestAccumulatedImpact: string;
  ofAccumulatedImpact: string;

  critical: string;
  reviewStatus: string;
  pending: string;
  inReview: string;
  justified: string;
  predominantCategories: string;
  material: string;
  process: string;
  machine: string;
  others: string;
}

export const KIOSK_TRANSLATIONS: Record<LanguageCode, KioskTranslations> = {
  pt: {
    executiveTag: 'MATERIAL SCRAP / IF COST',
    executiveTitle: 'Visão Executiva',
    factoryTag: 'MODO FÁBRICA',
    factoryTitle: 'Ranking de ocorrências por linha',
    offendersTag: 'ONDE ESTAMOS PERDENDO DINHEIRO',
    offendersTitle: 'Principais ofensores do período',
    prioritiesTag: 'PROBLEMAS QUE EXIGEM AÇÃO',
    prioritiesTitle: 'Ocorrências prioritárias',

    slideExecutive: 'Executivo',
    slideFactory: 'Fábrica',
    slideOffenders: 'Ofensores',
    slidePriorities: 'Prioridades',

    pause: 'Pausar',
    play: 'Reproduzir',
    autoRotate: 'Rotação automática',
    interval: 'Intervalo',
    fullscreen: 'Tela cheia',
    exitFullscreen: 'Sair da tela cheia',
    exit: 'Sair',
    seconds: 's',
    lightTheme: 'Tema Claro',
    darkTheme: 'Tema Escuro',

    ifCostAccumulated: 'IF Cost acumulado',
    samePeriodPrior: 'Mesmo período {year}',
    yoyReference: 'Referência YoY',
    variationVsPrior: 'Variação vs {year}',
    lowerIsBetter: 'Menor é melhor',
    targetAccumulated: 'Target acumulado',
    registeredTarget: 'Meta cadastrada',
    targetAchievement: 'Atingimento da meta',
    evolutionTitle: 'Evolução de IF Cost — {currentYear} × {priorYear} × Target',
    topComponentsTitle: 'Top 3 componentes afetados',
    scrapUnits: 'unidades de scrap',
    transactions: 'transações',
    criticalAlerts: 'alertas críticos',
    simulatedData: 'Dados simulados',
    apiData: 'Dados da API',
    updatedAt: 'Atualizado',
    scheduledEvery2Hours: 'rotina a cada 2 horas',

    period: 'Período',
    month: 'Mês',
    year: 'Ano',
    currentVsPrior: 'Atual × anterior',
    occurrences: 'Ocorrências',
    leaderLine: 'Linha líder',
    monitoredLines: 'Linhas monitoradas',
    priorPeriod: 'Período anterior',
    comparableOccurrences: 'Ocorrências comparáveis',
    generalConsolidated: 'Consolidado geral',
    assemblyLines: 'Linhas de montagem',
    sectorsWithMostOccurrences: 'Setores com mais ocorrências',
    occurrencesUnit: 'ocorrências',
    variation: 'Variação',

    top5DefectsByCost: 'Top 5 defeitos por IF Cost',
    top8LinesByCost: 'Top 8 linhas por IF Cost',
    mostCriticalPartNumber: 'Part Number mais crítico',
    mostCriticalDefect: 'Defeito mais crítico',
    highestAccumulatedImpact: 'Maior impacto acumulado',
    ofAccumulatedImpact: 'do impacto acumulado',

    critical: 'Crítico',
    reviewStatus: 'Situação das revisões',
    pending: 'Pendentes',
    inReview: 'Em revisão',
    justified: 'Justificadas',
    predominantCategories: 'Categorias predominantes',
    material: 'Material',
    process: 'Processo',
    machine: 'Máquina',
    others: 'Outros',
  },
  en: {
    executiveTag: 'MATERIAL SCRAP / IF COST',
    executiveTitle: 'Executive View',
    factoryTag: 'FACTORY MODE',
    factoryTitle: 'Occurrence Ranking by Line',
    offendersTag: 'WHERE WE ARE LOSING MONEY',
    offendersTitle: 'Main Period Offenders',
    prioritiesTag: 'PROBLEMS REQUIRING ACTION',
    prioritiesTitle: 'Priority Occurrences',

    slideExecutive: 'Executive',
    slideFactory: 'Factory',
    slideOffenders: 'Offenders',
    slidePriorities: 'Priorities',

    pause: 'Pause',
    play: 'Play',
    autoRotate: 'Auto-rotation',
    interval: 'Interval',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    exit: 'Exit',
    seconds: 's',
    lightTheme: 'Light Mode',
    darkTheme: 'Dark Mode',

    ifCostAccumulated: 'Accumulated IF Cost',
    samePeriodPrior: 'Same period {year}',
    yoyReference: 'YoY Reference',
    variationVsPrior: 'Variance vs {year}',
    lowerIsBetter: 'Lower is better',
    targetAccumulated: 'Accumulated Target',
    registeredTarget: 'Registered target',
    targetAchievement: 'Target attainment',
    evolutionTitle: 'IF Cost Evolution — {currentYear} × {priorYear} × Target',
    topComponentsTitle: 'Top 3 affected components',
    scrapUnits: 'scrap units',
    transactions: 'transactions',
    criticalAlerts: 'critical alerts',
    simulatedData: 'Simulated data',
    apiData: 'API data',
    updatedAt: 'Updated',
    scheduledEvery2Hours: 'routine every 2 hours',

    period: 'Period',
    month: 'Month',
    year: 'Year',
    currentVsPrior: 'Current × prior',
    occurrences: 'Occurrences',
    leaderLine: 'Leading line',
    monitoredLines: 'Monitored lines',
    priorPeriod: 'Prior period',
    comparableOccurrences: 'Comparable occurrences',
    generalConsolidated: 'Overall consolidated',
    assemblyLines: 'Assembly lines',
    sectorsWithMostOccurrences: 'Sectors with most occurrences',
    occurrencesUnit: 'occurrences',
    variation: 'Variance',

    top5DefectsByCost: 'Top 5 defects by IF Cost',
    top8LinesByCost: 'Top 8 lines by IF Cost',
    mostCriticalPartNumber: 'Most critical Part Number',
    mostCriticalDefect: 'Most critical defect',
    highestAccumulatedImpact: 'Highest accumulated impact',
    ofAccumulatedImpact: 'of accumulated impact',

    critical: 'Critical',
    reviewStatus: 'Review Status',
    pending: 'Pending',
    inReview: 'In review',
    justified: 'Justified',
    predominantCategories: 'Predominant categories',
    material: 'Material',
    process: 'Process',
    machine: 'Machine',
    others: 'Others',
  },
  ko: {
    executiveTag: 'MATERIAL SCRAP / IF COST',
    executiveTitle: '경영진 뷰',
    factoryTag: '공장 모드',
    factoryTitle: '라인별 스크랩 발생 순위',
    offendersTag: '손실 발생 주요 원인',
    offendersTitle: '기간 주요 원인 항목',
    prioritiesTag: '조치가 필요한 문제',
    prioritiesTitle: '우선순위 발생 건',

    slideExecutive: '경영진',
    slideFactory: '공장',
    slideOffenders: '주요원인',
    slidePriorities: '우선조치',

    pause: '일시정지',
    play: '재생',
    autoRotate: '자동 회전',
    interval: '전환 간격',
    fullscreen: '전체 화면',
    exitFullscreen: '전체 화면 종료',
    exit: '나가기',
    seconds: '초',
    lightTheme: '라이트 모드',
    darkTheme: '다크 모드',

    ifCostAccumulated: '누적 IF Cost',
    samePeriodPrior: '{year}년 동기',
    yoyReference: '전년 동기 대비',
    variationVsPrior: '{year}년 대비 변동',
    lowerIsBetter: '낮을수록 좋음',
    targetAccumulated: '누적 목표',
    registeredTarget: '등록된 목표',
    targetAchievement: '목표 달성률',
    evolutionTitle: 'IF Cost 추이 — {currentYear} × {priorYear} × Target',
    topComponentsTitle: '영향 상위 3개 부품',
    scrapUnits: '개 스크랩 수량',
    transactions: '건의 트랜잭션',
    criticalAlerts: '개 중요 알림',
    simulatedData: '시뮬레이션 데이터',
    apiData: 'API 데이터',
    updatedAt: '업데이트',
    scheduledEvery2Hours: '2시간 주기 갱신',

    period: '기간',
    month: '월',
    year: '연도',
    currentVsPrior: '현재 × 이전',
    occurrences: '발생 건수',
    leaderLine: '우수 라인',
    monitoredLines: '모니터링 라인',
    priorPeriod: '이전 기간',
    comparableOccurrences: '비교 발생 건수',
    generalConsolidated: '전체 통합',
    assemblyLines: '조립 라인',
    sectorsWithMostOccurrences: '최다 발생 공정',
    occurrencesUnit: '건 발생',
    variation: '변동',

    top5DefectsByCost: 'IF Cost 상위 5개 불량',
    top8LinesByCost: 'IF Cost 상위 8개 라인',
    mostCriticalPartNumber: '최고 위험 품번 (PN)',
    mostCriticalDefect: '최고 위험 불량',
    highestAccumulatedImpact: '최대 누적 손실',
    ofAccumulatedImpact: '누적 영향 비중',

    critical: '위험',
    reviewStatus: '검토 현황',
    pending: '대기',
    inReview: '검토 중',
    justified: '사유 확정',
    predominantCategories: '주요 분류 비중',
    material: '자재',
    process: '공정',
    machine: '설비',
    others: '기타',
  },
};
