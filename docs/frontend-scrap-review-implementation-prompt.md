# Prompt de implementação — análise e relatórios da Base de Scrap

> Use este documento como prompt para implementar o frontend da funcionalidade. Trabalhe sobre o código existente, preserve o padrão visual do Hanaro e não recrie componentes que já existem no projeto.

## 1. Objetivo

Implementar no frontend Angular o fluxo de análise de ocorrências da Base de Scrap, permitindo que qualquer usuário autenticado:

- filtre e consulte ocorrências de scrap;
- identifique visualmente itens não analisados, em rascunho e revisados;
- selecione uma ou várias ocorrências usando o `occurrence_id` estável;
- crie e salve um rascunho individual;
- classifique o defeito, informe título e descrição e anexe imagens;
- visualize o relatório antes de finalizá-lo;
- finalize uma análise, tornando-a somente leitura;
- abra um relatório finalizado e o use como referência para gerar relatórios em massa;
- acompanhe quais itens foram criados ou ignorados pela operação em massa.

O “analista” não é um papel novo. É o usuário comum autenticado. O responsável deve ser exibido com base na sessão e é definido pelo backend; o frontend não deve permitir escolher ou enviar outro usuário.

Na Base de Scrap, exibir apenas o valor em USD. Não exibir nem recalcular BRL nessa tela.

## 2. Decisões de experiência

### Fluxo principal

1. O usuário acessa `/base-de-scrap`.
2. Usa os filtros existentes e os novos filtros de análise.
3. Ativa o modo de seleção pelo botão `Selecionar itens`, no canto direito do cabeçalho do card.
4. Seleciona uma ou mais linhas por checkbox.
5. Com uma ocorrência selecionada, escolhe `Criar análise` e abre o editor lateral.
6. Com várias ocorrências selecionadas, escolhe `Aplicar relatório de referência` e seleciona um relatório finalizado.
7. Ao clicar normalmente numa linha:
   - sem análise: abre o editor de uma nova análise;
   - `DRAFT`: abre o rascunho editável;
   - `REVIEWED`: abre a visualização somente leitura, com a ação `Usar como referência`.

### Padrão de navegação

Usar um drawer lateral, pois ele preserva a lista, os filtros, a página e a seleção. Tomar o drawer de detalhes de execuções como referência visual em:

- `frontend/src/app/pages/executions/executions-page.html`, seção `selectedExecutionId()`;
- `frontend/src/app/pages/executions/executions-page.css`, seção `Modal / Drawer`.

Não copiar toda a implementação para a página. Extrair um componente próprio da feature, com foco, Escape, bloqueio de scroll e aviso de alterações não salvas tratados de forma acessível.

### Seleção

- O checkbox do cabeçalho seleciona somente os itens elegíveis e visíveis na página atual.
- A seleção não deve significar “todos os resultados do filtro”. O backend exige IDs explícitos e aceita no máximo 500.
- Exibir `N selecionados` e `Limpar seleção` numa barra de ação fixa junto à tabela.
- Preservar seleção ao paginar apenas se isso for explicitamente mostrado ao usuário; a recomendação é preservar e mostrar o total global selecionado.
- Remover da seleção itens que deixem de existir após uma atualização da lista somente depois de informar o usuário.
- Itens sem `occurrence_id` não podem ser selecionados nem analisados; mostrar tooltip explicando a indisponibilidade.
- Usar `occurrence_id`, nunca o campo legado `id`, para `track`, seleção, rotas e chamadas de análise.

## 3. Rotas de frontend

Manter as rotas protegidas por `authenticatedGuard` em `frontend/src/app/app.routes.ts`.

| Rota | Uso |
| --- | --- |
| `/base-de-scrap` | Lista, filtros, seleção e operações em massa. |
| `/base-de-scrap/revisao/:occurrenceId` | Abre o editor/visualizador da ocorrência no drawer sobre a lista. Deve aceitar acesso direto e recarregamento. |
| `/relatorios` | Catálogo de relatórios finalizados, usando a mesma fonte da Base com `review_status=REVIEWED`. |
| `/relatorios/:occurrenceId` | Visualização somente leitura de um relatório finalizado. |

Implementar as rotas filhas sem desmontar desnecessariamente a lista ao abrir/fechar o drawer. Ao fechar, retornar à rota de origem preservando query params.

Query params de filtros podem ser sincronizados com a URL em uma segunda etapa, mas `occurrenceId` deve estar na URL desde a primeira entrega para permitir refresh, link direto e navegação Voltar.

## 4. Estrutura de arquivos sugerida

Preservar os nomes modernos e componentes standalone usados pelo projeto.

```text
frontend/src/app/pages/scrap-base/
├── scrap-base-page.ts                 # orquestra lista, filtros, paginação e seleção
├── scrap-base-page.html
├── scrap-base-page.css
├── scrap-base-page.spec.ts
├── scrap-base.models.ts               # contratos da lista e filtros
├── scrap-base.service.ts              # somente GET da lista/filtros
├── scrap-review.models.ts             # contratos de tipos, análise, anexos e lote
├── scrap-review.service.ts            # endpoints de análise
├── scrap-review.service.spec.ts
├── scrap-review-drawer/
│   ├── scrap-review-drawer.ts
│   ├── scrap-review-drawer.html
│   ├── scrap-review-drawer.css
│   └── scrap-review-drawer.spec.ts
├── scrap-review-form/
│   ├── scrap-review-form.ts
│   ├── scrap-review-form.html
│   ├── scrap-review-form.css
│   └── scrap-review-form.spec.ts
├── scrap-review-preview/
│   ├── scrap-review-preview.ts
│   ├── scrap-review-preview.html
│   ├── scrap-review-preview.css
│   └── scrap-review-preview.spec.ts
├── scrap-review-attachments/
│   ├── scrap-review-attachments.ts
│   ├── scrap-review-attachments.html
│   ├── scrap-review-attachments.css
│   └── scrap-review-attachments.spec.ts
└── scrap-bulk-review-dialog/
    ├── scrap-bulk-review-dialog.ts
    ├── scrap-bulk-review-dialog.html
    ├── scrap-bulk-review-dialog.css
    └── scrap-bulk-review-dialog.spec.ts

frontend/src/app/pages/reports/
├── reports-page.ts
├── reports-page.html
├── reports-page.css
└── reports-page.spec.ts
```

Componentes específicos de análise permanecem dentro da feature. Só mover algo para `shared` se houver uso real por mais de uma feature e se o componente não conhecer endpoints, conforme `frontend/src/app/shared/README.md`.

## 5. Componentes existentes que devem ser reutilizados

| Componente/padrão | Localização | Como usar |
| --- | --- | --- |
| `ListPanel` | `frontend/src/app/shared/list-view/list-panel/` | Manter como card principal. Colocar filtros, ordenação e botão `Selecionar itens` no slot `[list-actions]`. |
| `ListFilterPopover` | `frontend/src/app/shared/list-filters/list-filter-popover.*` | Manter o popover da Base e incluir status da análise e classificação. Não criar outro painel de filtros. |
| `ListFilterInput` | `frontend/src/app/shared/list-filters/list-filter-input.*` | Reutilizar para busca e organização. |
| `ListFilterDateRange` | `frontend/src/app/shared/list-filters/list-filter-date-range.*` | Reutilizar para data inicial/final e preservar validação existente. |
| `ListFilterSelect` | `frontend/src/app/shared/list-filters/list-filter-select.*` | Reutilizar exatamente o padrão de seletor já presente no card para ordenação, status e tipo de defeito. Usar `[(value)]`, `[options]`, `[label]`, `[ariaLabel]` e `(changed)`. |
| `ListPagination` | `frontend/src/app/shared/list-view/list-pagination/` | Manter paginação e tamanhos 25/50/100/200. |
| `ListTableSkeleton` | `frontend/src/app/shared/list-view/list-table-skeleton/` | Atualizar a lista de colunas para refletir checkbox, USD e status da análise. |
| `ListFeedback` | `frontend/src/app/shared/list-view/list-feedback/` | Usar nos estados vazio e erro inicial. |
| `InlineAlert` | `frontend/src/app/shared/list-view/inline-alert/` | Usar em erros de refresh, conflito, upload e resultado parcial de lote. Se for necessário sucesso/warning, evoluir o componente com `kind`, mantendo compatibilidade. |
| `DelayedProgressSpinner` | `frontend/src/app/shared/list-view/delayed-progress-spinner/` | Usar nas requisições da lista e ações assíncronas longas. |
| `StatusBadge` | `frontend/src/app/shared/list-view/status-badge/` | Exibir `Não analisado` como neutral, `Rascunho` como warning e `Revisado` como success. |
| `UiIcon` | `frontend/src/app/ui-icon.ts` | Usar os ícones existentes. Se faltarem `image`, `trash`, `check` ou `copy`, ampliar o union `IconName` e o switch, sem inserir SVG solto nos templates. |
| Botões `.btn` | tokens/classes globais em `frontend/src/app/app.css` | Reutilizar `btn-primary`, `btn-secondary` e `btn-ghost`; não criar um sistema paralelo de botões. |
| Upload do perfil | `frontend/src/app/pages/profile/profile-page.ts` e `.html` | Reutilizar o padrão de input de arquivo oculto, validação prévia, `URL.createObjectURL` e limpeza com `URL.revokeObjectURL`. Não reutilizar o service/contrato de avatar. |
| Drawer de execuções | `frontend/src/app/pages/executions/executions-page.html/.css` | Usar como referência de layout, tokens, largura, backdrop e animação. Melhorar acessibilidade na extração: foco inicial, focus trap e restauração do foco. |
| Sessão do usuário | `frontend/src/app/core/auth/auth.service.ts` | Injetar `AuthService` e ler `authService.user()?.name` para preencher visualmente o responsável. Nunca enviar responsável no payload. |

### Uso obrigatório do seletor existente

Exemplo de uso para classificação:

```html
<app-list-filter-select
  [value]="reviewModel().defectTypeId"
  [options]="defectTypeOptions()"
  label="Tipo de scrap"
  ariaLabel="Selecionar tipo de scrap"
  (changed)="onDefectTypeChanged($event)"
/>
```

O componente atual é adequado para seleção simples. Não o force a funcionar como multiselect. Para `defect_type_ids` no filtro, entregar inicialmente seleção simples; se multiseleção for requisito posterior, criar uma extensão compartilhada própria com teclado e ARIA corretos.

## 6. Alterações na tabela da Base de Scrap

Atualizar `scrap-base.models.ts` com os campos que o backend já retorna:

```ts
export type ScrapReviewStatus = 'DRAFT' | 'REVIEWED';
export type ScrapReviewFilterStatus = 'UNREVIEWED' | ScrapReviewStatus;

interface ScrapListItem {
  // manter os campos atuais
  review_id: string | null;
  review_status: ScrapReviewStatus | null;
  defect_type_id: string | null;
  defect_type_name: string | null;
  responsible_user_id: number | null;
  responsible_name: string | null;
  reviewed_at: string | null;
  review_updated_at: string | null;
  attachment_count: number;
}
```

Adicionar ao `ScrapFilterParams`:

```ts
review_status?: 'UNREVIEWED' | 'DRAFT' | 'REVIEWED';
defect_type_ids?: string[];
responsible_user_ids?: number[];
```

### Ordem recomendada das colunas

1. checkbox de seleção, somente no modo de seleção;
2. data;
3. organização;
4. item e descrição;
5. ordem;
6. quantidade;
7. valor USD;
8. tipo de scrap;
9. status da análise;
10. responsável/data, condensado em uma célula secundária;
11. ação/indicador de abertura.

Remover a coluna `VALOR BRL` e a opção de ordenação visual por BRL. O backend pode continuar aceitando e mantendo esse dado; esta regra é apenas da interface da Base.

Transformar a linha em elemento interativo acessível. Se o clique continuar no `<tr>`, garantir navegação por teclado; preferencialmente incluir um botão/link com nome acessível na última coluna. O clique no checkbox não deve abrir o drawer.

Usar `@for (item of data()!.items; track item.occurrence_id ?? item.id)` e tratar `occurrence_id === null` como não analisável.

## 7. Filtros da análise

Adicionar ao popover existente:

- `Status da análise`: Todos, Não analisado, Rascunho, Revisado;
- `Tipo de scrap`: Todos + catálogo ativo de `/api/v1/scrap/review-types`;
- `Responsável`: nesta entrega pode oferecer `Todos` e `Meus relatórios`, usando `AuthService.user().id`; não criar busca de usuários sem endpoint próprio.

Enviar arrays por query param repetido, como o `ScrapBaseService` já faz:

```text
GET /api/v1/scrap?review_status=REVIEWED&defect_type_ids=<uuid>&responsible_user_ids=12
```

Atualizar `activeFiltersCount`, `clearFilters`, paginação e testes. Mudanças em filtros devem voltar para a página 1.

## 8. Contratos e rotas da API

Todas as rotas exigem sessão autenticada. Não adicionar `responsible_user_id` em comandos de escrita.

### 8.1 Listagem da Base

```http
GET /api/v1/scrap
```

Filtros relevantes:

- `review_status=UNREVIEWED|DRAFT|REVIEWED`;
- `defect_type_ids=<uuid>` repetido, máximo 50;
- `responsible_user_ids=<int>` repetido, máximo 50;
- filtros atuais de data, organização, busca, paginação e ordenação.

### 8.2 Catálogo de tipos

```http
GET /api/v1/scrap/review-types
```

Resposta:

```ts
interface ScrapDefectType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

O catálogo pode vir vazio. Nesse caso, desabilitar finalização e explicar: `Nenhum tipo de scrap ativo foi cadastrado. Procure um administrador.` Não criar tipos automaticamente no frontend. `POST` e `PATCH /review-types` são exclusivos de superusuário e estão fora desta tela.

### 8.3 Obter análise

```http
GET /api/v1/scrap/reviews/{occurrence_id}
```

- `200`: carregar análise e anexos;
- `404`: ocorrência ainda sem análise; abrir formulário vazio;
- outros erros: exibir estado de erro com tentar novamente.

### 8.4 Criar/atualizar rascunho

```http
PUT /api/v1/scrap/reviews/{occurrence_id}
Content-Type: application/json
```

```json
{
  "defect_type_id": "uuid-ou-null",
  "title": "até 200 caracteres",
  "description": "até 20000 caracteres",
  "expected_version": 1
}
```

No primeiro salvamento, `expected_version` pode ser `null`. Nas alterações posteriores, enviar a `version` recebida. Atualizar imediatamente o modelo local com a resposta do servidor.

### 8.5 Finalizar

```http
POST /api/v1/scrap/reviews/{occurrence_id}/finalize?expected_version={version}
```

Antes de chamar, exigir classificação, título e descrição. Após sucesso, mudar para visualização somente leitura e atualizar a linha na lista. Relatório finalizado é imutável.

### 8.6 Upload de evidência

É necessário salvar o rascunho antes do primeiro upload para obter `review.id`.

```http
POST /api/v1/scrap/reviews/by-id/{review_id}/attachments
Content-Type: multipart/form-data
campo: image
```

- tipos aceitos: JPEG, PNG e WebP;
- limite padrão do backend: 10 MiB por imagem;
- máximo padrão: 8 imagens por análise;
- não definir manualmente o header `Content-Type`; deixar o browser criar o boundary;
- fazer upload sequencial ou com concorrência baixa e mostrar progresso por arquivo;
- usar a `url` retornada para visualizar a imagem autenticada.

### 8.7 Remover evidência

```http
DELETE /api/v1/scrap/reviews/by-id/{review_id}/attachments/{attachment_id}
```

Somente permitir remoção em rascunho. Pedir confirmação local e remover da grade apenas após `204`.

### 8.8 Criar relatórios em massa

```http
POST /api/v1/scrap/reviews/bulk
Content-Type: application/json
```

```json
{
  "reference_review_id": "uuid-do-relatorio-finalizado",
  "occurrence_ids": ["uuid-1", "uuid-2"],
  "copy_attachments": false
}
```

- limite de 1 a 500 ocorrências únicas;
- referência deve estar finalizada;
- `copy_attachments` deve iniciar desmarcado;
- explicar que copiar imagens replica evidências e pode não representar corretamente todos os itens;
- nunca sobrescrever análises existentes.

Resultado:

```ts
interface ScrapReviewBulkResult {
  operation_id: string;
  status: string;
  requested_count: number;
  created_count: number;
  skipped_count: number;
  created_occurrence_ids: string[];
  skipped: Array<{
    occurrence_id: string;
    reason: 'NOT_ACTIVE' | 'ALREADY_REVIEWED';
  }>;
}
```

Exibir um resumo explícito após a operação: `X relatórios criados; Y ignorados`. Permitir expandir os ignorados e traduzir os motivos.

## 9. Modelo completo da análise

Criar em `scrap-review.models.ts`:

```ts
export interface ScrapReviewAttachment {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  position: number;
  created_at: string;
  url: string;
}

export interface ScrapReview {
  id: string;
  occurrence_id: string;
  status: 'DRAFT' | 'REVIEWED';
  defect_type: ScrapDefectType | null;
  responsible_user_id: number;
  responsible_name: string;
  title: string;
  description: string;
  version: number;
  source_review_id: string | null;
  bulk_operation_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  attachments: ScrapReviewAttachment[];
}
```

Não usar `any`. Tipar respostas e erros esperados.

## 10. Formulário e estado Angular

O projeto usa Angular 22. Para o novo formulário, usar Signal Forms de `@angular/forms/signals`, sem introduzir um novo `FormGroup`/`FormBuilder`.

Modelo mínimo:

```ts
interface ScrapReviewFormModel {
  defectTypeId: string;
  title: string;
  description: string;
}

readonly reviewModel = signal<ScrapReviewFormModel>({
  defectTypeId: '',
  title: '',
  description: '',
});

readonly reviewForm = form(this.reviewModel, (schema) => {
  required(schema.defectTypeId, { message: 'Selecione o tipo de scrap.' });
  required(schema.title, { message: 'Informe o título.' });
  maxLength(schema.title, 200, { message: 'Use no máximo 200 caracteres.' });
  required(schema.description, { message: 'Informe a descrição.' });
  maxLength(schema.description, 20000, { message: 'Use no máximo 20000 caracteres.' });
});
```

Como `ListFilterSelect` não implementa `FormValueControl`, sincronizar `defectTypeId` explicitamente pelo evento `(changed)`. Para inputs e textarea, usar `[formField]` quando compatível.

Manter signals separados para:

- análise carregada;
- `loading`, `saving`, `finalizing` e upload por arquivo;
- erro de carga, erro de gravação e conflito;
- aba/modo `edit` ou `preview`;
- dirty state;
- anexos locais pendentes e anexos já persistidos.

Usar `computed()` para `canSave`, `canFinalize`, `isReadOnly`, contagem de anexos e labels. Usar `takeUntilDestroyed` nas subscriptions e cancelar requests substituídas quando necessário.

### Concorrência otimista

Se o backend responder `409`, não sobrescrever silenciosamente. Exibir:

`Este relatório foi alterado em outra sessão. Recarregue a versão mais recente antes de continuar.`

Oferecer `Recarregar relatório`; não fazer retry automático de escrita com uma versão antiga.

## 11. Conteúdo do drawer

### Cabeçalho

- contexto `Análise de scrap`;
- código do item e organização;
- badge de status;
- botão fechar com `aria-label`;
- se houver alterações, interceptar fechamento e confirmar descarte.

### Resumo da ocorrência

Mostrar em card compacto e somente leitura:

- item e descrição;
- data;
- organização;
- ordem;
- quantidade;
- valor em USD;
- ID curto da ocorrência, com ID completo em title/ação de copiar se houver padrão.

### Formulário

- `Tipo de scrap`: `ListFilterSelect`, obrigatório para finalizar;
- `Responsável`: input visual somente leitura com `AuthService.user().name` antes do primeiro save e `review.responsible_name` depois do save;
- `Título`: texto, máximo 200;
- `Descrição`: textarea, máximo 20.000, com contador discreto;
- `Evidências`: zona de upload + grade de thumbnails.

Rascunho pode ser salvo incompleto. Finalização não.

### Rodapé fixo

- `Cancelar/Fechar`;
- `Visualizar relatório` enquanto editável;
- `Salvar rascunho`;
- `Finalizar relatório`, ação primária, com confirmação da imutabilidade.

Não desabilitar botões sem explicar o motivo. Usar texto auxiliar ou tooltip para ausência de catálogo/campos.

## 12. Upload e visualização de imagens

- Input deve aceitar `image/jpeg,image/png,image/webp` e seleção múltipla.
- Validar tipo, tamanho e quantidade antes de enviar.
- Criar preview local imediato com object URL.
- Revogar cada object URL ao remover arquivo, concluir upload ou destruir componente.
- Exibir nome, dimensão/tamanho quando disponíveis, estado de envio e erro individual.
- Permitir retry individual.
- Abrir imagem em lightbox/dialog acessível, não em nova aba sem contexto.
- Não armazenar base64 no estado persistente, localStorage ou payload JSON.
- As URLs são privadas e dependem da sessão; usar diretamente com credenciais same-origin.

Se o usuário escolher imagens antes de o rascunho existir, salvar primeiro o rascunho e depois enviar a fila. Se o salvamento falhar, não tentar upload.

## 13. Preview do relatório

Criar `ScrapReviewPreview` como componente puramente apresentacional, reutilizável tanto no drawer quanto em `/relatorios/:occurrenceId`.

O preview deve mostrar:

- título;
- status e tipo de scrap;
- responsável e data da revisão;
- resumo da ocorrência;
- descrição preservando quebras de linha;
- galeria de evidências;
- indicação `Criado a partir de outro relatório` quando `source_review_id` existir.

No preview de rascunho, usar o estado atual do formulário e anexos locais, sem exigir salvamento. Exibir marca visual `Pré-visualização — ainda não finalizado`.

Em relatório finalizado, exibir `Usar como referência`. Essa ação deve retornar/abrir `/base-de-scrap`, manter a referência selecionada e orientar o usuário a filtrar e escolher os itens de destino.

## 14. Operação em massa

### Entrada pela Base

Quando houver duas ou mais ocorrências selecionadas, habilitar `Aplicar relatório de referência`.

O dialog deve conter:

1. quantidade de itens selecionados;
2. seletor/busca de relatório finalizado;
3. preview resumido da referência escolhida;
4. checkbox `Copiar imagens da referência`, desligado;
5. aviso de que itens inativos ou já analisados serão ignorados;
6. confirmação final.

Como não há endpoint dedicado de busca de relatórios, consultar:

```http
GET /api/v1/scrap?review_status=REVIEWED&search=<texto>&page=1&page_size=25
```

Ao escolher uma ocorrência da lista, obter o relatório completo com `GET /reviews/{occurrence_id}` e usar seu `review.id` como `reference_review_id`.

### Entrada por relatório finalizado

Ao clicar em `Usar como referência`:

- navegar para `/base-de-scrap` com a referência mantida em estado de navegação e, opcionalmente, query param `referenceReviewId`;
- mostrar uma faixa persistente `Referência selecionada: {título}`;
- permitir trocar ou remover a referência;
- ativar modo de seleção automaticamente;
- somente enviar o lote depois da confirmação explícita.

Não copiar anexos por padrão.

## 15. Página `/relatorios`

Substituir o placeholder atual por uma visão de relatórios finalizados, reutilizando os componentes de lista e filtro existentes.

- fonte: `GET /api/v1/scrap?review_status=REVIEWED`;
- filtros: busca, período, organização, tipo e `Meus relatórios`;
- card/linha: título, tipo, item, organização, responsável, data, quantidade de imagens e USD;
- clique: `/relatorios/:occurrenceId`;
- ação principal do detalhe: `Usar como referência`.

Não duplicar toda a lógica da Base. Extrair apenas estado/transformações realmente compartilháveis ou compor o mesmo serviço. Evitar uma abstração genérica precoce de “qualquer listagem”.

## 16. Internacionalização

Adicionar todas as novas chaves ao contrato e às três traduções em `frontend/src/app/i18n/language.service.ts`:

- português;
- inglês;
- coreano.

Não colocar textos novos diretamente no template. Incluir labels, aria-labels, erros, confirmações, estados, motivos de skip e mensagens vazias.

Também remover da Base as referências visuais a BRL nas três traduções, sem apagar contratos globais que possam ser usados no dashboard.

## 17. Acessibilidade e responsividade

- Dialog/drawer com `role="dialog"`, `aria-modal="true"` e título ligado por `aria-labelledby`.
- Mover foco para o título/primeiro campo ao abrir, prender foco dentro e restaurar no gatilho ao fechar.
- Escape fecha apenas depois de tratar dirty state.
- Backdrop pode fechar apenas quando não houver risco de perda silenciosa.
- Todos os campos com label real, erros associados e `aria-invalid`.
- Checkboxes com nome que inclua o item/ocorrência.
- Status não pode depender apenas de cor.
- Ações de linha acessíveis por teclado.
- Respeitar `prefers-reduced-motion` nas animações do drawer/lightbox.
- Em telas pequenas, drawer ocupa 100% da largura; rodapé permanece acessível e a tabela continua com scroll horizontal.
- Não usar gestos hover-only.

## 18. Tratamento de erros HTTP

| Código | Comportamento esperado |
| --- | --- |
| `401` | Deixar o interceptor/fluxo global de autenticação agir. |
| `403` | Informar que apenas o responsável pode alterar aquele rascunho. Manter leitura quando possível. |
| `404` no GET de review | Tratar como análise ainda não criada. |
| `404` em anexo/review existente | Informar indisponibilidade e oferecer recarregar. |
| `409` | Conflito de versão/estado; não sobrescrever, oferecer recarregar. |
| `415` | Tipo de imagem não suportado. |
| `422` | Mostrar `detail` do backend em linguagem segura próximo à ação. |
| `5xx`/rede | Preservar formulário e seleção; permitir tentar novamente. |

Evitar alerts nativos. Usar feedback inline/dialog do padrão visual.

## 19. Checklist de implementação

### Contratos e serviços

- [ ] Atualizar `ScrapListItem` com os campos resumidos de análise.
- [ ] Atualizar `ScrapFilterParams` com status, tipos e responsáveis.
- [ ] Criar tipos completos em `scrap-review.models.ts`.
- [ ] Criar `ScrapReviewService` com todos os endpoints tipados.
- [ ] Garantir query params repetidos para filtros array.
- [ ] Garantir multipart com campo `image` e sem header manual.
- [ ] Cobrir service com testes de URL, query, payload e `FormData`.

### Base de Scrap

- [ ] Remover coluna e ordenação visual de BRL.
- [ ] Acrescentar coluna/status de análise e tipo de scrap.
- [ ] Trocar tracking e identidade de seleção para `occurrence_id`.
- [ ] Implementar modo de seleção e checkbox por linha.
- [ ] Implementar selecionar página e limpar seleção.
- [ ] Exibir barra com total selecionado e ações possíveis.
- [ ] Bloquear seleção de linhas sem `occurrence_id`.
- [ ] Adicionar filtros `review_status`, tipo e meus relatórios.
- [ ] Atualizar skeleton, empty states e active filter count.
- [ ] Abrir a rota de revisão ao clicar na ação da linha.

### Editor individual

- [ ] Criar drawer acessível e responsivo.
- [ ] Buscar análise pelo `occurrence_id` ao abrir.
- [ ] Tratar `404` como novo formulário.
- [ ] Preencher responsável da sessão como somente leitura.
- [ ] Implementar Signal Form e validações.
- [ ] Permitir salvar rascunho incompleto.
- [ ] Enviar `expected_version` nas atualizações.
- [ ] Tratar conflito `409` sem perder dados locais.
- [ ] Implementar confirmação de descarte de alterações.
- [ ] Implementar finalização e estado somente leitura.
- [ ] Atualizar a linha/lista após salvar ou finalizar.

### Imagens

- [ ] Implementar seleção múltipla JPEG/PNG/WebP.
- [ ] Validar 10 MiB por arquivo e máximo de 8.
- [ ] Criar/revogar object URLs corretamente.
- [ ] Salvar rascunho antes do primeiro upload.
- [ ] Mostrar fila, progresso, erro e retry por imagem.
- [ ] Implementar remoção somente em rascunho.
- [ ] Implementar galeria/lightbox acessível.

### Preview e relatórios

- [ ] Criar componente apresentacional de preview.
- [ ] Preview de rascunho usa valores locais atuais.
- [ ] Preview finalizado usa resposta persistida.
- [ ] Implementar `/relatorios` com `review_status=REVIEWED`.
- [ ] Implementar `/relatorios/:occurrenceId`.
- [ ] Adicionar `Usar como referência` em relatório finalizado.

### Operação em massa

- [ ] Permitir apenas entre 1 e 500 `occurrence_id` únicos.
- [ ] Permitir escolher somente relatório finalizado como referência.
- [ ] Mostrar preview da referência antes da confirmação.
- [ ] Manter `copy_attachments=false` por padrão.
- [ ] Explicar o impacto de copiar evidências.
- [ ] Enviar somente IDs explícitos selecionados.
- [ ] Exibir criados e ignorados com motivos traduzidos.
- [ ] Atualizar a lista e limpar apenas os IDs processados com sucesso.

### UX, i18n e qualidade

- [ ] Adicionar todas as chaves PT/EN/KO.
- [ ] Usar tokens do tema; não introduzir cores literais desnecessárias.
- [ ] Usar componentes compartilhados existentes.
- [ ] Garantir teclado, foco, ARIA e reduced motion.
- [ ] Garantir layout em 320 px, tablet e desktop.
- [ ] Preservar dados locais em erros de rede.
- [ ] Não usar `any`, listeners globais sem cleanup ou subscriptions órfãs.

### Testes

- [ ] Testar mapeamento dos três status na tabela.
- [ ] Testar seleção, selecionar página, paginação e IDs nulos.
- [ ] Testar filtros e limpeza dos novos filtros.
- [ ] Testar criação de rascunho e preenchimento da resposta.
- [ ] Testar edição com `expected_version`.
- [ ] Testar bloqueio/feedback de finalização inválida.
- [ ] Testar finalização bem-sucedida e modo read-only.
- [ ] Testar `404`, `403`, `409`, `415`, `422` e erro de rede.
- [ ] Testar limites e limpeza de previews de imagem.
- [ ] Testar payload e resultado parcial do lote.
- [ ] Testar abertura direta das rotas de detalhe.
- [ ] Testar foco inicial, Escape e restauração de foco.

## 20. Critérios de aceite

- [ ] Um usuário autenticado cria um rascunho sem escolher responsável.
- [ ] O responsável exibido corresponde ao usuário da sessão e ao retorno do backend.
- [ ] Uma análise finalizada não pode ser editada nem ter anexos removidos.
- [ ] A lista diferencia claramente não analisado, rascunho e revisado.
- [ ] É possível filtrar cada estado pelo backend.
- [ ] A Base mostra USD e não mostra BRL.
- [ ] Imagens válidas podem ser adicionadas, visualizadas e removidas antes da finalização.
- [ ] O preview representa o conteúdo atual antes da finalização.
- [ ] Um relatório finalizado pode ser escolhido como referência.
- [ ] A operação em massa nunca sobrescreve análises existentes e informa itens ignorados.
- [ ] Seleção e requests usam `occurrence_id`, não `id` da transação.
- [ ] A tela continua utilizável por teclado e em viewport de 320 px.
- [ ] Testes e build passam sem regressão.

## 21. Validação final obrigatória

Executar a partir de `frontend/`:

```powershell
npm test -- --run
npm run build
```

Também validar manualmente com o backend e Docker ativos:

1. abrir `/base-de-scrap` autenticado;
2. conferir dados reais e estados da lista;
3. salvar e reabrir um rascunho;
4. anexar, visualizar e remover uma imagem;
5. finalizar um relatório completo;
6. tentar reabrir o finalizado e confirmar somente leitura;
7. selecionar itens filtrados e aplicar esse relatório como referência;
8. conferir o resumo de criados/ignorados;
9. abrir `/relatorios` e localizar o resultado;
10. atualizar diretamente uma rota de detalhe e confirmar que o contexto é reconstruído.

Depois de modificar o código, atualizar o grafo do repositório conforme `AGENTS.md`:

```powershell
python -m graphify update .
```

Se o Python do ambiente Windows continuar indisponível, registrar essa limitação no handoff; ela não deve impedir build e testes do Angular.

## 22. Fora de escopo desta entrega

- criar um papel separado de analista;
- permitir atribuição de responsável;
- administração do catálogo de tipos na Base de Scrap;
- sobrescrever ou editar relatório finalizado;
- selecionar implicitamente todos os resultados de um filtro;
- copiar imagens em massa por padrão;
- gerar PDF ou exportação impressa;
- recalcular USD/BRL no frontend;
- alterar contratos do dashboard que ainda usam BRL.

