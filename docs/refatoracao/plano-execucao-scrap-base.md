# Plano de execução da refatoração de scrap-base

Status: em execução. A entrega 0 foi corrigida e validada por build em `36d0d1c`. A implementação da entrega 1 está pronta para revisão; a suíte de testes ainda aguarda execução. Este documento detalha a etapa 4 do [plano de transição DXi](plano-transicao-arquitetura-dxi.md).

### Progresso

| Entrega | Estado | Evidência |
| --- | --- | --- |
| 0. Baseline | Código corrigido; build, build Cloudflare, formatação e checker passaram. Testes não executados nesta sessão. | `36d0d1c` |
| 1. Revisão em lote | Coordenador implementado e builds/formatação/checker passaram. Cobertura de regressão ainda precisa ser executada e ajustada se necessário. | `fb003e3` |
| 2–5 | Planejadas; ainda não iniciadas. | — |

## Objetivo e limites

Reduzir as responsabilidades de `ScrapBasePage` e `ScrapReviewDrawer` por fluxos completos, preservando as rotas `/base-de-scrap` e `/base-de-scrap/revisao/:occurrenceId`, os contratos HTTP e a integração de `settings` com `scrap-base.public-api.ts`. A ordem é: estabilizar o baseline, extrair revisão em lote, extrair fila, consolidar a operação de revisão individual, organizar modelos e listagem e, por fim, mover arquivos para subpastas funcionais. Cada entrega deve compilar e poder ser revertida isoladamente.

O backend não será reestruturado nesta sequência. `ScrapReviewService`, `ScrapBaseService` e `DefectTypesService` continuam como clientes HTTP. Coordenadores e stores terão escopo da página ou do drawer, conforme o tempo de vida do estado. Não criar um serviço global que guarde seleção ou rascunhos de usuários diferentes.

## Estado atual verificado

| Fluxo | Local atual | Responsabilidades misturadas |
| --- | --- | --- |
| Listagem e seleção | `scrap-base-page.ts` | Filtros, busca, paginação, chamada HTTP, seleção de até 500 ocorrências, abertura do drawer e do diálogo. |
| Revisão em lote | `scrap-base-page.ts`, `scrap-bulk-review-dialog/scrap-bulk-review-dialog.ts` | Origem por modelo ou revisão, payload, envio, erro e atualização dos IDs selecionados após resultado parcial. |
| Fila individual | `scrap-base-page.ts`, `scrap-review-drawer/scrap-review-drawer.ts` | Construção da fila, índice, transição entre ocorrências, salvamento, finalização e encerramento. |
| Revisão e anexos | `scrap-review-drawer/scrap-review-drawer.ts` | Formulário, versão esperada, HTTP, upload sequencial, conflito, prévia e limpeza de URLs temporárias. |
| Modelos | `scrap-template.service.ts`, página, drawer e popover | HTTP e signals globais no mesmo serviço; ativação, criação, edição, exclusão e favoritos em componentes diferentes. |

Há testes existentes para seleção, envio por modelo e por revisão, fila e upload antes da finalização. Eles são a base de regressão, mas não cobrem todos os resultados parciais, cancelamentos e respostas antigas. A última tentativa de build com a árvore limpa mostrou erros de tipos também fora de scrap-base. A primeira entrega abaixo deve determinar a causa antes de usar o build como critério de regressão.

## Entrega 0 — baseline confiável

1. Confirmar árvore limpa, versão instalada de Angular/TypeScript/RxJS e instalação coerente com `frontend/package-lock.json`. Reproduzir `npm run build` e `npm run build:cloudflare` a partir de `frontend/`; registrar erros e separar falhas de ambiente de falhas do código.
2. Corrigir o baseline em commit independente se houver defeito real. Executar `npm run format:check`, `npm run check:architecture` e a suíte de testes existente. Registrar contagem e eventuais falhas preexistentes.
3. Não iniciar a movimentação de arquivos enquanto o compilador apresentar erros não compreendidos. A extração comportamental pode ser revisada por diff, mas seu aceite exige baseline executável.

Critério: comando, ambiente e resultado do baseline ficam reproduzíveis em CI e localmente.

## Entrega 1 — revisão em lote

Criar `scrap-bulk-review.coordinator.ts` em `modules/scrap-base/`, fornecido por `ScrapBasePage` para compartilhar a mesma instância com o diálogo. O coordenador possuirá `selectionMode`, IDs selecionados, origem ativa, abertura do diálogo, estado de envio e resultado. A página manterá os filtros, a página atual e a recarga da lista. O diálogo manterá foco, tradução, resumo e comandos visuais; chamará o coordenador para executar a operação. O `ScrapReviewService` continuará responsável apenas pelo HTTP.

Regras a preservar ou explicitar na API do coordenador:

- Somente ocorrências com ID, estado `ACTIVE` e revisão ainda não `REVIEWED` podem entrar na seleção. Selecionar tudo atua apenas sobre os itens elegíveis da página atual. IDs já escolhidos em outras páginas permanecem até remoção explícita ou conclusão.
- A seleção é limitada a 500 IDs. A origem é exclusiva: `template_id` **ou** `reference_review_id`. Ao escolher um modelo, a revisão anterior deixa de ser origem; o caminho vindo de `history.state.referenceReview` continua funcionando.
- Cópia de anexos é opt-in e só vale para uma revisão de referência que tenha anexos. Capturar IDs, origem e opção de anexos no início do envio; impedir segunda requisição enquanto ele estiver em andamento.
- Em sucesso parcial, retirar apenas `created_occurrence_ids`. Manter IDs ignorados selecionados e exibir `skipped` e os motivos no diálogo. A página recarrega a lista uma vez após a conclusão. Em erro, manter seleção e origem para permitir nova tentativa.
- Ao fechar/cancelar o diálogo, limpar apenas seu estado transitório. Ao sair da página, a instância e a seleção são descartadas. Não mover a fila individual para este coordenador.

Alterar `scrap-base-page.ts`, seu HTML e `scrap-bulk-review-dialog/`; acrescentar `scrap-bulk-review.coordinator.spec.ts` e ajustar specs existentes para fornecer a instância no escopo correto. Cobrir seleção entre páginas, limite, item inelegível, origem exclusiva, anexos opt-in, envio duplicado, falha com retry, resultado parcial e limpeza ao sair da página. Aceite: mesma rota e interface, com uma única origem de verdade para o estado do lote.

## Entrega 2 — fila de revisão individual

Criar `scrap-review-queue.store.ts`, com estado de fila limitado à sessão da página: snapshot ordenado dos IDs selecionados, índice atual, ID ativo e metadados conhecidos de cada ocorrência. `ScrapBasePage` inicia e encerra a fila; `ScrapReviewDrawer` consome a fila e emite eventos de salvar, finalizar, avançar, voltar e fechar. A fila não deve compartilhar `isSubmitting` nem o resultado do lote, embora possa receber os IDs escolhidos na tabela no momento de sua criação.

- Preservar a ordem de seleção, a abertura da primeira ocorrência e a navegação da rota existente. Registrar em teste o comportamento do URL durante os próximos itens antes de alterá-lo. Se a rota passar a acompanhar cada item, tratar isso como mudança de comportamento explícita, incluindo histórico do navegador e links diretos.
- `saveDraftAndAdvance` deve avançar somente após salvar o rascunho e terminar os uploads necessários. `confirmFinalize` deve avançar somente após resposta de finalização; no último item, emitir conclusão e limpar a fila uma única vez. Falha ou conflito `409` mantém o índice e os dados editáveis do item.
- Voltar, avançar ou fechar com alterações não salvas deve passar por uma decisão explícita de descarte, reaproveitando a confirmação atual. Bloquear troca durante salvamento, finalização ou upload. Ao trocar, revogar URLs temporárias e reiniciar apenas o estado local do item.
- Metadados de uma ocorrência fora da página carregada podem estar ausentes. Nesse caso, apresentar estado sem metadados até obter os dados disponíveis, sem mostrar os dados da ocorrência anterior. Não criar novo endpoint sem verificar o backend.
- Requisição de uma ocorrência antiga não pode sobrescrever o item atual após avanço rápido. Cancelar a assinatura anterior ou comparar a chave da requisição antes de aplicar a resposta.

Alterar `scrap-base-page.ts`, `scrap-review-drawer.ts` e seus specs; adicionar spec da store com avanço, retorno, último item, conflito, descarte e resposta atrasada. Aceite: a fila funciona com um ou vários IDs, não perde rascunho silenciosamente e não mostra dados de outro item.

## Entrega 3 — operação de revisão e anexos

Depois da fila, extrair de `ScrapReviewDrawer` a sequência de caso de uso para `scrap-review-workflow.coordinator.ts`, fornecido no drawer. A operação recebe ID, dados do formulário, versão esperada e arquivos pendentes; compõe `saveDraft`, uploads sequenciais e, quando solicitado, `finalize`. O formulário e as mensagens traduzidas ficam no componente. `ScrapReviewService` continua com endpoints separados.

Definir resultados tipados para rascunho salvo, revisão finalizada, conflito de versão e falha de anexo. Preservar a versão retornada pelo servidor como fonte da próxima operação. Não finalizar se o upload obrigatório falhar sem deixar esse resultado explícito para o usuário; decidir e registrar a política de retry antes de mudar o tratamento atual, que captura falhas individuais de upload e continua. A limpeza de object URLs continua em `ScrapAttachmentPreviewService` e no ciclo de vida do drawer. Cobrir ordem `save → upload → finalize`, erro em cada etapa, `409`, cancelamento/destruição e edição de revisão finalizada pelo responsável.

Aceite: o drawer concentra apresentação e estado transitório do formulário; a sequência de gravação fica em um único coordenador com erros observáveis.

## Entrega 4 — modelos e listagem

Separar, se os testes das etapas anteriores confirmarem a utilidade, o HTTP de `ScrapTemplateService` do estado de modelos usado por página e drawer. Uma store com escopo de página pode manter catálogo, carregamento, origem ativa e mutações; o serviço HTTP fica com listar/criar/editar/excluir. Preservar criação a partir de uma revisão, favorito, atualização do modelo ativo, feedback e exclusão. Evitar duas stores distintas que possam divergir entre página e drawer.

Extrair listagem, filtros e paginação de `ScrapBasePage` para `scrap-list.store.ts` no mesmo escopo. A store monta `ScrapFilterParams`, cancela a consulta anterior e guarda dados/loading/erro. O modo de seleção do lote informa `exclude_reviewed`, mas os IDs selecionados continuam no coordenador de lote. Preservar debounce de 300 ms, filtro por usuário, faixa de datas, ordenação, paginação e atualização local após salvar uma revisão. Cobrir resposta fora de ordem, erro, lista vazia e troca de filtros. Essas duas extrações podem ser entregas independentes.

## Entrega 5 — diretórios funcionais e documentação

Depois que cada responsabilidade tiver um dono, fazer **apenas movimentos de arquivos** em commit separado. Estrutura sugerida:

```text
modules/scrap-base/
├── scrap-base-page.{ts,html,css,spec.ts}
├── scrap-base.routes.ts
├── scrap-base.public-api.ts
├── list/                 # lista, filtros, tipos e respectivos testes
├── review/               # serviço de revisão, modelos locais, drawer, formulário, anexos, fila e lote
└── templates/            # catálogo, popover e respectivos testes
```

Manter TS, HTML, CSS e spec de cada componente juntos. Atualizar imports relativos, URLs de templates/estilos e specs; verificar que não há arquivos duplicados nos caminhos antigos. `settings` deve continuar importando `DefectTypesService` e `ScrapDefectType` somente por `scrap-base.public-api.ts`. Não criar diretórios vazios nem mover um modelo de domínio para `shared` só porque vários arquivos da mesma feature o usam. Executar build e checker após cada grupo de movimentos; atualizar o grafo ao concluir alterações de código conforme `AGENTS.md`.

## Verificação final e critério de conclusão

Executar `npm run build`, `npm run build:cloudflare`, `npm run format:check`, `npm run check:architecture` e os testes relevantes da feature. Exercitar manualmente: seleção em páginas diferentes, revisão em lote por modelo e por revisão, resultado parcial, fila com rascunho e finalização, conflito, anexos, favoritos e link direto de revisão. O plano só será marcado concluído quando esses fluxos, as URLs e a fronteira pública de `settings` estiverem preservados e cada entrega tiver validação registrada.
