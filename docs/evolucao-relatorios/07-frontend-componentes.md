# Frontend: componentes, serviços e navegação

[Índice](README.md) · [API](06-api-e-contratos.md). Proposta baseada no `frontend/package.json`: Angular 22, ECharts/ngx-echarts, CDK e Material já declarados. Não é necessário trocar framework ou instalar uma segunda biblioteca de gráficos.

## Componentes existentes para reaproveitar

| Classe / caminho em `frontend/src/app/` | Aplicação |
| --- | --- |
| `ReportsPage`, `pages/reports/reports-page.ts` | Preservar listagem, abertura, histórico e integração de emissão; extrair editor em componentes menores |
| `ListFilterDateRange`, `shared/list-filters/list-filter-date-range.ts` | Período: models `from`/`to`, labels e evento `changed` |
| `ListFilterInput`, `ListFilterSelect`, `ListFilterPopover`, mesma pasta | Busca, tipo de relatório, moeda e filtros; respeitar contratos tipados existentes |
| `ListPagination`, `shared/list-view/list-pagination/` | Seletores e histórico além dos primeiros 100 itens |
| `ListPanel`, `ListFeedback`, `InlineAlert`, `StatusBadge`, `ListTableSkeleton`, `DelayedProgressSpinner`, `shared/list-view/` | Estrutura de listas, carregamento, erro, estado vazio, aviso e status |
| `DashboardPerformanceChart`, `charts/dashboard-performance-chart.ts` | Referência de implementação de série; extrair componente neutro antes de compartilhar |
| `DashboardDistributionChart`, `pages/dashboard/components/dashboard-distribution-chart.ts` | Referência de barras e tema; evoluir para Pareto com acumulado sem depender de DashboardStore |
| `CHART_DESIGN`, `charts/chart-design.tokens.ts` | Cores, tipografia e tema dos gráficos |
| `ScrapReviewForm`, `pages/scrap-base/scrap-review-form/` | Ampliar classificação; já usa Signal Forms |
| `ScrapReviewAttachments`, `pages/scrap-base/scrap-review-attachments/` | Seleção/visualização de fotos, eventos `filesSelected` e `attachmentDeleted`; adaptar para legenda e papel |
| `ScrapReviewPreview`, `pages/scrap-base/scrap-review-preview/` | Reaproveitar apresentação de detalhe de revisão onde o contrato servir |
| `ActionPlans`, `pages/action-plans/action-plans.ts` | Manter Kanban e comandos; acrescentar charter, implantação e eficácia por componentes locais |
| `SettingsPage`, `pages/settings/settings-page.ts` | Entrada de linhas, metas, cobertura, produção e taxonomia |
| `UiIcon`, `ui-icon.ts`; `LanguageService`; `ThemeService` | Ícones, traduções PT/EN/KO e tema |
| `DashboardShell`, `layouts/dashboard-shell/` | Navegação e estrutura autenticada existentes |

Componentes `shared` não conhecem endpoints ou entidades de uma feature, conforme `shared/README.md`. O reexport em `pages/dashboard/components/dashboard-performance-chart.ts` não é uma segunda implementação. Não copiar o gráfico inteiro para reports sem remover seu acoplamento a DTOs e traduções de dashboard.

## Composição proposta do editor

```text
pages/reports/
  reports-page.*                    # listagem e seleção existentes
  reports.service.ts               # ampliar API existente
  reports.models.ts                # contratos V1/V2 discriminados
  report-editor.store.ts           # estado por instância de editor
  report-editor/report-editor.*
  report-scope-form/report-scope-form.*
  report-readiness/report-readiness.*
  report-source-picker/report-source-picker.*
  report-section-list/report-section-list.*
  report-section-editor/report-section-editor.*
  report-action-picker/report-action-picker.*
  report-evidence-picker/report-evidence-picker.*
  report-preview/report-preview.*
  report-version-history/report-version-history.*
  report-export-panel/report-export-panel.*
  report-source-changes/report-source-changes.*
```

`.*` significa `.ts`, `.html`, `.css` e testes de comportamento pertinentes. Criar componentes sob demanda no incremento correspondente; não gerar arquivos vazios de etapas futuras.

| Componente novo | Inputs principais | Outputs / responsabilidade |
| --- | --- | --- |
| `ReportEditor` | reportId | Orquestra carregamento e ações da store; providers locais |
| `ReportScopeForm` | scope, catalogOptions, readOnly | scopeChanged, submitted; tipo, datas, moeda, comparação e provisório |
| `ReportReadiness` | ReadinessResult | fixRequested com código/destino; bloqueios separados de avisos |
| `ReportSourcePicker` | Page<EligibleOccurrence>, selection, loading | filtersChanged, pageChanged, selectionChanged; fontes manuais |
| `ReportSectionList` | sections, activeSectionKey | selected, reordered, enabledChanged; botões de mover por teclado |
| `ReportSectionEditor` | seção tipada, opções | sectionChanged; editor específico por kind, sem JSON bruto na UI |
| `ReportActionPicker` | Page<ActionTask>, selectedIds | queryChanged, selectionChanged; mostra plano, estado e prazo |
| `ReportEvidencePicker` | fontes disponíveis, selectedEvidence | selectionChanged, captionChanged, roleChanged; antes/depois e legenda |
| `ReportPreview` | ReportDocumentV2, stale, loading | sectionSelected; exibe dados do servidor, não recalcula indicadores |
| `ReportVersionHistory` | Page<ReportVersion> | versionSelected, prepareRevisionRequested |
| `ReportExportPanel` | versão, capabilities, options, jobs | exportRequested, retryRequested, downloadRequested |
| `ReportSourceChanges` | diferenças tipadas | refreshSourcesRequested; não atualiza fontes ao abrir |

Usar identificadores persistentes em `@for (...; track item.id)` ou section_key; índices visuais não identificam entidades. Reordenação pode usar CDK já declarado se necessário, mas sempre oferecer alternativa de teclado.

## Estado e serviços

`ReportEditorStore` usa signals para report/composition/selection/loading/errors/jobs e computed para dirty, canPublish, selectedSection e previewStale. Fornecer no editor, evitando estado compartilhado entre dois relatórios abertos. Métodos: `load`, `saveComposition`, `refreshPreview`, `publish`, `prepareRevision`, `requestExport`, `retryExport`, `download`.

Ampliar `ReportsService` com `composition`, `saveComposition`, `readiness`, `previewV2`, `sourceChanges`, `prepareRevision` e seletores paginados. Tipar requests em vez de `object`. `GovernanceService` continua atendendo ações; extrair serviços de casos, produção e eficácia quando essas etapas forem implementadas.

Reutilizar `HttpClient`, interceptors existentes e cancelamento de busca com RxJS. Uma resposta de relatório anterior não pode sobrescrever o editor atual. Polling de exportação termina em COMPLETED/FAILED e ao destruir o componente. Identidade visual do job inclui versão, formato e opções, não apenas formato.

Novos formulários seguem Signal Forms já usado em `ScrapReviewForm`; manter campos editáveis com strings vazias/arrays e converter ausência para null no adapter HTTP. Campo monetário vazio nunca vira zero automaticamente. Não migrar formulários legados não relacionados como efeito colateral.

## Gráficos e blocos de apresentação

Criar componentes neutros `TimeSeriesChart` e `ParetoChart` em `charts/` quando houver uso por duas features. DTOs recebem pontos/labels/unidade/locale e metadados de cobertura; não injetam DashboardStore ou ReportsService. Manter wrapper do dashboard para seus contratos existentes.

Prévia usa componentes locais `ReportKpiBlock`, `ReportTrendBlock`, `ReportParetoBlock`, `ReportActionsBlock`, `ReportCaseBlock`, `ReportEvidenceBlock` e `ReportConclusionsBlock`. Renderizadores backend recebem os mesmos blocos sem depender do DOM ou de screenshots do Angular.

Gráficos inicializam apenas no navegador, preservando o tratamento de SSR existente. Mostrar tabela acessível equivalente, indicar períodos desconhecidos e diferenciar referência/meta/realizado além da cor. Conversão de decimal para número só para desenho; texto financeiro formatado parte do valor canônico.

## Componentes dos incrementos B–D

| Local / componentes novos | Integração |
| --- | --- |
| `pages/cases/cases-page`, `case-editor`, `case-occurrence-picker`, `case-analysis-form`, `five-whys-editor`, `case-analysis-history` | Casos, fontes e revisões; relacionar com revisão existente |
| `pages/scrap-base/review-classification-form` | Sintoma/condição/posto/causa; incluído em ScrapReviewForm |
| `pages/action-plans/action-effectiveness`, `effectiveness-form`, `effectiveness-comparison` | Avaliação, antes/depois, contribuintes e limitações |
| `pages/action-plans/plan-charter`, `plan-team`, `plan-milestones`, `action-deployments` | Charter, equipe, marcos e expansão por linha |
| `pages/settings/production-entry`, `production-approval`, `operating-calendar` | Produção manual e calendário |
| `pages/settings/line-catalog`, `line-source-mappings`, `source-coverage`, `metric-targets`, `cause-categories` | Catálogos, cobertura e metas do incremento A/B |
| `pages/risks/risks-page`, `risk-assessment-form`, `workstation-risk-table` | Riscos e medidas; tabela antes do mapa visual |
| `pages/settings/cost-categories`, `cost-records`, `cost-import-preview` | Fontes complementares de IF Cost |

Extrair galeria neutra `EvidenceGallery` somente quando revisão/caso/ação compartilharem apresentação. `EvidencePicker` de reports permanece local por conhecer fontes da edição. Upload e remoção são comandos dos serviços das features, não responsabilidade de componente compartilhado.

## Rotas Angular

Manter `/relatorios` e `/relatorios/:reportId`; acrescentar `/relatorios/:reportId/versoes/:revision` para leitura congelada e `/relatorios/:reportId/previa` se a prévia precisar de tela dedicada. Novas rotas `/casos`, `/casos/:caseId`, `/riscos` e `/riscos/:riskId` entram apenas com o incremento correspondente.

Manter `/planos-de-acao/:planId`, incluindo abas/seções de charter e resultados, sem duplicar a navegação Kanban. Configurações pode usar seções em `/configuracoes` inicialmente; subrotas só quando a tela justificar.

Declarar em `app.routes.ts`, com `loadComponent` e `authenticatedGuard` nas superfícies privadas. Proteger configurações administrativas no backend e apresentar estado de permissão na UI. Preservar links antigos; não usar o parâmetro de uma rota como autorização.

## Estados que fazem parte da entrega

- Rascunho vazio com próxima ação clara; relatório legado em modo compatível.
- Dados carregando, erro recuperável e formulário preservado após falha.
- Conflito 409 com recarregar/comparar sem descartar edição local silenciosamente.
- Prévia desatualizada após qualquer alteração relevante.
- Sem meta, sem classificação, cobertura parcial e resultado ainda não medido.
- Evidência indisponível com ação para remover/substituir a seleção.
- Worker indisponível; publicação e exportação exibidas como estados distintos.
- Aviso ao sair com alterações não salvas, foco restaurado em diálogos e ações operáveis por teclado.

Critério funcional: usuário conclui o fechamento sem copiar manualmente gráficos/fotos/ações para PowerPoint. Testar os componentes pelo comportamento e a jornada completa; não criar testes que apenas repetem cada binding.
