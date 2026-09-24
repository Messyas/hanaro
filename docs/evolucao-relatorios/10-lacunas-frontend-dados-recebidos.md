# Frontend: dados recebidos que ainda não são apresentados

[Índice](README.md) · [Frontend](07-frontend-componentes.md) · [API](06-api-e-contratos.md) · [Backlog](01-backlog.md)

**Status de implementação:** núcleo da prévia V2, `ReportEditorStore`, filtros de escopo, comparação personalizada, paginação dos seletores, edição de evidências, ordenação de seções, gráficos de tendência/Pareto e histórico V2 iniciados. Ainda pendentes a proteção completa contra respostas obsoletas/saída com alterações e a validação final do build/testes Angular.

## Objetivo

Fazer a tela de relatórios representar todo o conteúdo que o backend já entrega para um `PERIOD_CLOSE`. A interface deve permitir revisar o fechamento como uma apresentação consolidada antes da publicação e da exportação. O frontend apenas apresenta, seleciona e edita conteúdo editorial; totais, séries, Pareto, cobertura e prontidão continuam sendo calculados pelo backend.

Este documento detalha a parte ainda pendente do REL-008. Ele não inclui funcionalidades futuras que também não existem no backend, como preparação de nova revisão, comparação de fontes e idempotência explícita da publicação.

## Estado atual

O Angular já permite:

- criar `DOSSIER` e `PERIOD_CLOSE`;
- editar período, moeda, comparação com ano anterior e estado provisório;
- ativar ou desativar seções;
- selecionar ações e anexos de revisões;
- consultar prontidão;
- visualizar total, meta, cobertura e série mensal;
- publicar uma versão V2;
- solicitar, acompanhar e baixar exportações.

O contrato recebido contém mais informação do que a tela apresenta. Há também propriedades cuja tipagem foi reduzida no frontend, obrigando o template a usar `$any` e impedindo componentes específicos de consumirem os blocos com segurança.

## Matriz de lacunas

| Dados já disponíveis | Apresentação atual | Implementação necessária | Prioridade |
| --- | --- | --- | --- |
| `document.report`: código, título, descrição e tipo | O editor mostra título e descrição fora da prévia | Criar cabeçalho da prévia com identidade do documento e período | P0 |
| `document.scope.filters` | Não há controles de organização, produto, divisão ou linha | Criar filtros dimensionais multisseleção e mostrar o recorte aplicado na prévia | P0 |
| `comparison_mode=CUSTOM`, `comparison_from`, `comparison_to` | A tela oferece somente sem comparação e ano anterior | Exibir opção customizada e validar as duas datas | P1 |
| `analytics.comparison` | Recebido e tipado, porém não renderizado | Mostrar total comparativo, variação absoluta/percentual quando calculável e séries lado a lado | P0 |
| `analytics.pareto_lines` | Recebido e tipado, porém não renderizado | Criar bloco de Pareto com barras, acumulado e tabela acessível | P0 |
| `analytics.monthly` | Mostrado como lista textual | Criar gráfico de tendência e manter tabela acessível equivalente | P0 |
| `analytics.coverage` completo | A tela mostra apenas status e dias completos/esperados | Mostrar dias parciais, desconhecidos, datas ausentes e revisões de origem | P0 |
| `analytics.target` e `target_revision` | Mostra o valor da meta | Identificar revisão da meta e diferenciar meta ausente de meta igual a zero | P1 |
| `document.sections[].payload` | Ignorado | Criar editor por tipo de seção para narrativa, conclusão e demais textos editoriais | P0 |
| `document.sections[].data` | Ignorado; a tela consulta `analytics` diretamente | Renderizar cada seção na ordem definida, usando seus dados congeláveis | P0 |
| Ordem e título das seções | Apenas ativação/desativação | Permitir editar título e reordenar com mouse e teclado | P1 |
| `document.actions` e dados da seção `ACTIONS` | A tela permite selecionar, mas a prévia não mostra o conteúdo | Mostrar código, título, responsável, estado, prioridade e prazo | P0 |
| `document.evidence` e evidências por seção | A tela permite selecionar, mas a prévia não mostra as imagens/metadados | Mostrar miniatura, arquivo, legenda, papel e data de captura | P0 |
| `ReportEvidenceSource.caption` | Preenchida automaticamente | Permitir edição da legenda antes de salvar | P0 |
| `ReportEvidenceSource.role` | Sempre enviado como `CONTEXT` | Permitir `CONTEXT`, `BEFORE`, `AFTER`, `IMPLEMENTATION` e `MEASUREMENT` | P0 |
| `ReportEvidenceSource.captured_at` | Sempre enviado como `null` | Permitir informar ou corrigir a data | P1 |
| `readiness.issues[].section_id/source_id` | A mensagem é exibida sem navegação contextual | Transformar `suggested_action` em ação que focaliza a seção ou fonte correspondente | P0 |
| `fingerprint` e `generated_at` da prévia | Recebidos, mas não usados na experiência | Guardar a identidade da prévia, mostrar horário e marcá-la como desatualizada após edição | P0 |
| Paginação dos candidatos | O serviço retorna uma página fixa e a tela exibe apenas seus itens | Manter página/filtros por seletor e usar `ListPagination` | P0 |
| Conteúdo V2 de versões publicadas | Exibe somente cabeçalho, métricas e nomes das seções | Reutilizar os mesmos blocos da prévia em modo somente leitura | P0 |
| Erros de jobs de exportação | Estado `FAILED` existe | Exibir mensagem do job e ação explícita para tentar novamente | P1 |

## Contratos TypeScript

Ampliar `frontend/src/app/pages/reports/reports.models.ts`. `PeriodClosePreview.document` não deve declarar somente `analytics` e uma lista mínima de seções. Criar contratos discriminados compatíveis com o documento retornado pelo backend:

```ts
interface ReportDocumentV2 {
  report: ReportDocumentHeader;
  scope: ReportDocumentScope;
  analytics: ReportAnalytics;
  sections: ReportDocumentSection[];
  actions: ReportDocumentAction[];
  evidence: ReportDocumentEvidence[];
}

type ReportDocumentSection =
  | ReportNarrativeSection
  | ReportKpiSection
  | ReportTrendSection
  | ReportParetoSection
  | ReportActionsSection
  | ReportEvidenceSection
  | ReportConclusionsSection;
```

Cada variante deve usar `kind` como discriminador e tipar seu `data`, `payload` e `evidence`. Evitar `Record<string, unknown>` nos blocos que já possuem schema conhecido. O template não deve depender de `$any` para ler versões V2.

Também acrescentar modelos de estado para:

- `ReportPreviewIdentity`: `reportVersion`, `fingerprint`, `generatedAt`;
- `ReportCandidateQuery`: busca, página e tamanho da página;
- `ReportEvidenceDraft`: fonte, legenda, papel, data e posição;
- `ReportSectionDraft`: ID, título, posição, ativação e payload tipado.

## Componentes Angular

Extrair a implementação de `ReportsPage` conforme as responsabilidades abaixo. A página permanece responsável pela listagem e pela resolução da rota; o estado do relatório aberto fica em uma store fornecida no editor.

```text
pages/reports/
  reports-page.*
  reports.models.ts
  reports.service.ts
  report-editor.store.ts
  report-editor/report-editor.*
  report-scope-form/report-scope-form.*
  report-section-list/report-section-list.*
  report-section-editor/report-section-editor.*
  report-action-picker/report-action-picker.*
  report-evidence-picker/report-evidence-picker.*
  report-readiness/report-readiness.*
  report-preview/report-preview.*
  report-preview/report-kpi-block.*
  report-preview/report-trend-block.*
  report-preview/report-pareto-block.*
  report-preview/report-actions-block.*
  report-preview/report-evidence-block.*
  report-preview/report-narrative-block.*
  report-version-history/report-version-history.*
  report-export-panel/report-export-panel.*
```

### `ReportScopeForm`

- editar período atual e comparação customizada;
- editar moeda e estado provisório;
- selecionar organização, produto, divisão e linha;
- impedir período final anterior ao inicial;
- preservar valor vazio até validação, sem convertê-lo implicitamente para zero;
- emitir um `ReportScope` completo para a store.

Os filtros dimensionais precisam de opções reais. Criar endpoint/catálogo quando o backend ainda não expuser uma lista adequada; até isso existir, derivar opções de um endpoint paginado explícito, sem carregar todos os movimentos no navegador.

### `ReportSectionList` e `ReportSectionEditor`

- ativar, desativar e reordenar seções;
- oferecer botões “mover para cima/baixo” para teclado mesmo que CDK Drag and Drop seja usado;
- editar título;
- escolher o editor pelo `kind`;
- editar texto narrativo e conclusão sem permitir que o usuário sobrescreva métricas calculadas;
- salvar todas as seções com uma única versão otimista.

### `ReportActionPicker`

- busca com debounce e cancelamento da requisição anterior;
- paginação real;
- exibição de código, título, plano, responsável, status, prioridade e prazo quando disponíveis;
- resumo das ações escolhidas na prévia;
- manutenção da seleção ao trocar de página.

### `ReportEvidencePicker`

- busca e paginação;
- miniatura ou indicação de arquivo;
- edição de legenda, papel e data;
- ordenação das evidências selecionadas;
- indicação de fonte indisponível;
- manutenção da seleção ao trocar de página.

### `ReportReadiness`

- separar bloqueios de avisos;
- exibir contagem no cabeçalho do editor;
- associar cada problema à seção ou fonte indicada;
- oferecer ação de foco/correção;
- desabilitar publicação final quando `ready=false`;
- explicar quando a opção provisória permite continuar.

### `ReportPreview`

A prévia deve percorrer `document.sections` na ordem retornada pelo servidor e escolher um componente pelo `kind`. Ela não deve reconstruir o documento a partir de estados paralelos do formulário.

- `ReportKpiBlock`: ocorrências, total, moeda, meta, revisão da meta e cobertura;
- `ReportTrendBlock`: série atual e comparativa, gráfico e tabela;
- `ReportParetoBlock`: valores por linha, acumulado e tabela;
- `ReportActionsBlock`: ações congeláveis com responsável, estado e prazo;
- `ReportEvidenceBlock`: imagem/arquivo, legenda, papel e data;
- `ReportNarrativeBlock`: resumo, contexto e conclusão;
- estado explícito para seção vazia, sem dados, desativada ou indisponível.

Gráficos devem usar os tokens existentes de `charts/chart-design.tokens.ts`. Se tendência ou Pareto forem compartilhados com o dashboard, extrair componentes neutros em `frontend/src/app/charts/`, sem dependência de `DashboardStore` ou `ReportsService`. Sempre fornecer tabela equivalente para leitores de tela e para valores exatos.

### `ReportVersionHistory`

Uma versão V2 publicada deve usar `ReportPreview` em modo somente leitura, consumindo `version.content.document`. Isso garante que histórico e rascunho tenham a mesma linguagem visual e evita a visualização atual, que reduz as seções aos seus nomes.

### `ReportExportPanel`

- mostrar formato, template, opções e status por job;
- apresentar `error_message` em falhas;
- permitir nova tentativa usando `retry_failed`;
- manter polling somente para `QUEUED` e `RUNNING`;
- encerrar polling ao destruir o componente;
- identificar o job por versão, formato, template e opções.

## Store do editor

Criar `ReportEditorStore` com signals e fornecê-la em `ReportEditor`, para evitar estado compartilhado entre relatórios. Estado mínimo:

- relatório, escopo e seções salvos;
- rascunhos locais de escopo, seção e evidência;
- ações e evidências selecionadas;
- prévia e sua identidade;
- consultas paginadas independentes dos seletores;
- carregamento e erro por operação;
- histórico e jobs de exportação.

Computeds mínimos:

- `dirty`;
- `previewStale`;
- `canPublish`;
- `blockers` e `warnings`;
- `selectedSection`;
- `hasPendingOperation`.

Qualquer alteração de título, descrição, escopo, seção, ação ou evidência marca `previewStale=true`. Uma nova resposta de prévia atualiza o fingerprint e limpa esse estado. Uma resposta tardia de outro relatório não pode substituir o editor atual.

## Serviço HTTP

Manter `ReportsService` como adapter de transporte e acrescentar paginação explícita:

```ts
eligibleActions(factoryId, query: ReportCandidateQuery)
eligibleEvidence(reportId, query: ReportCandidateQuery)
eligibleOccurrences(query: ReportCandidateQuery)
sourceReports(reportId, query: ReportCandidateQuery)
versions(reportId, query: ReportCandidateQuery)
```

Os componentes não devem montar URLs, interpretar `HttpErrorResponse` nem conhecer detalhes de polling. A store coordena os comandos e traduz erros de domínio para estados da interface. Preservar `expected_version` em toda alteração do rascunho.

## Ordem de implementação

1. Corrigir fixtures e testes para os contratos V1/V2 atuais.
2. Tipar integralmente `ReportDocumentV2` e remover `$any` do fluxo V2.
3. Criar `ReportEditorStore` e extrair `ReportEditor`/`ReportPreview` sem alterar comportamento.
4. Renderizar seções KPI, tendência, Pareto, ações, evidências e narrativa.
5. Implementar filtros dimensionais e comparação customizada.
6. Implementar legenda, papel, data e ordenação de evidências.
7. Implementar edição e ordenação de seções.
8. Adicionar paginação independente aos seletores e ao histórico.
9. Implementar `previewStale`, navegação dos problemas de prontidão e proteção ao sair com alterações locais.
10. Completar histórico V2 e recuperação de exportações com falha.

## Testes obrigatórios

### Unidade e componentes

- cada `kind` de seção escolhe o bloco correto;
- tendência mostra série atual, comparação e tabela equivalente;
- Pareto mostra todas as linhas e valores recebidos;
- zero é apresentado como zero e ausência como indisponível;
- cobertura parcial/unknown não é apresentada como completa;
- evidência salva legenda, papel e data informados;
- seleção persiste durante paginação;
- alteração relevante marca a prévia como desatualizada;
- resposta HTTP antiga não substitui o relatório atualmente aberto;
- bloqueio impede publicação e aviso não é tratado como bloqueio;
- versão publicada usa conteúdo congelado, sem consultar dados atuais.

### Integração da jornada

1. Criar fechamento por período.
2. Aplicar filtros e comparação.
3. Personalizar seções.
4. Selecionar ações e evidências com metadados.
5. Atualizar a prévia e revisar todos os blocos.
6. Resolver bloqueios ou marcar a edição como provisória quando permitido.
7. Publicar.
8. Exportar PPTX/PDF.
9. Abrir a versão histórica e confirmar os mesmos valores e blocos.

## Critérios de aceite

- Todo campo relevante de `ReportDocumentV2` possui representação visual ou uma decisão documentada de ocultação.
- Tendência, comparação e Pareto recebidos do backend aparecem na prévia sem recálculo financeiro no navegador.
- Seções aparecem na ordem retornada e podem ser editadas/reordenadas no rascunho.
- Ações e evidências selecionadas aparecem antes da publicação.
- Legenda, papel e data da evidência podem ser alterados.
- Usuário encontra candidatos além da primeira página.
- A prévia indica claramente quando ficou desatualizada.
- Bloqueios levam o usuário ao local que precisa de correção.
- Histórico V2 apresenta o documento completo congelado.
- Nenhum `$any` é necessário para renderizar o documento V2.
- Testes de relatórios compilam e passam; `npm run build` permanece verde.

## Fora deste recorte

- calcular métricas ou Pareto no Angular;
- implementar preparação de nova revisão antes da respectiva API;
- incorporar fotos nos arquivos exportados, responsabilidade dos renderizadores;
- criar casos, eficácia, riscos ou fontes adicionais de IF Cost dos incrementos futuros;
- substituir o fluxo legado `DOSSIER`.
