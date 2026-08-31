# Monitor de Execuções GERP — Guia do Frontend

Este documento orienta a implementação da tela **Execuções GERP** no frontend Angular, definindo o que está pronto para consumo no MVP, o que foi postergado para evitar quebras, os contratos de API ativos e os checklists de design e arquitetura da interface.

---

## 1. Escopo do MVP e Diagnóstico Atual

### 🟢 O que está pronto para construir
1. **Histórico de Rotinas (Tabela principal)**:
   - Consumo do endpoint `GET /api/v1/scrap/executions`.
   - Paginação server-side (`page`, `page_size`).
   - Ordenação determinística (`sort_by`, `sort_order`).
   - Barra de filtros completa (Período `date_from`/`date_to`, `status`, `trigger`, `execution_id`, `search`).
2. **Gaveta / Modal de Detalhes da Execução**:
   - Consumo do endpoint `GET /api/v1/scrap/executions/{execution_id}`.
   - Timeline ordenada das 8 etapas (`sequence`, `attempt`, `status`, `duration_ms`, `message`, `error_code`).
   - Metadados técnicos seguros (Request ID GERP, arquivo TSV bruto, hash SHA-256, contagens, status do snapshot contábil).

### 🟡 O que foi postergado (Não implementar agora para não quebrar)
1. **Gráfico de Barras (*Falhas por categoria*)**:
   - **Status**: Postergado.
   - **Motivo**: O backend ainda não possui a rota agregadora (`GROUP BY failure_category, count(*)`) para o período.
2. **Cards de KPIs do Topo (*Execuções hoje, Duração, Volume de registros, Falhas*)**:
   - **Status**: Postergado ou mantido apenas como layout placeholder estático até a publicação do endpoint `GET /api/v1/scrap/executions/summary`.
   - **Atenção**: Como a tabela usa paginação no servidor (25 itens por página), o frontend **não deve** tentar calcular somas globais a partir do array de itens da página atual.
3. **Botão "Executar agora"**:
   - **Status**: Desabilitado ou oculto no MVP.
   - **Motivo**: Conforme regra de negócio, as rotinas são 100% orquestradas e agendadas pelo Smart Office / GERP. Não há disparo manual por analista no frontend no MVP.

---

## 2. Contratos da API (Backend Disponível)

### 2.1 Listagem Paginada
- **Endpoint**: `GET /api/v1/scrap/executions`
- **Autenticação**: Sessão autenticada (`CurrentUserDep`).
- **Query Params suportados**:
  - `date_from` (YYYY-MM-DD), `date_to` (YYYY-MM-DD)
  - `status`: `QUEUED` | `RUNNING` | `COMPLETED` | `FAILED` | `CANCELLED`
  - `mode`: `LOCAL_FILE_SIMULATION` | `GERP_RPA`
  - `trigger`: `SCHEDULED`
  - `snapshot_status`: `NOT_PUBLISHED` | `PUBLISHED` | `UNCHANGED_REPLAY` | `PRESERVED_PREVIOUS`
  - `failure_category`: string
  - `execution_id`: UUID
  - `gerp_request_id`: string
  - `search`: string (busca em correlation_id e failure_message)
  - `page`: número (padrão 1, mín 1)
  - `page_size`: número (padrão 25, mín 1, máx 100)
  - `sort_by`: `started_at` | `finished_at` | `status` (padrão `started_at`)
  - `sort_order`: `asc` | `desc` (padrão `desc`)

**Interface TypeScript Sugerida**:
```typescript
export interface ExecutionListItem {
  id: string;
  execution_id: string;
  correlation_id: string;
  source_system: string; // 'GERP'
  report_name: string;
  trigger: 'SCHEDULED';
  mode: 'LOCAL_FILE_SIMULATION' | 'GERP_RPA';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  current_step: string | null;
  query_date_from: string;
  query_date_to: string;
  organization_parameter: string;
  organizations_found: string[];
  gerp_request_id: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  records_received: number;
  records_accepted: number;
  records_rejected: number;
  snapshot_status: 'NOT_PUBLISHED' | 'PUBLISHED' | 'UNCHANGED_REPLAY' | 'PRESERVED_PREVIOUS';
  failure_category: string | null;
}

export interface ExecutionPage {
  items: ExecutionListItem[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}
```

### 2.2 Detalhes e Timeline de Etapas
- **Endpoint**: `GET /api/v1/scrap/executions/{execution_id}`
- **Retorno**: Metadados completos da execução + array de `steps`.

**Interface TypeScript Sugerida**:
```typescript
export interface ExecutionStepRead {
  step_code:
    | 'GERP_REQUEST'
    | 'GERP_REPORT_GENERATION'
    | 'FILE_DOWNLOAD'
    | 'FILE_VALIDATION'
    | 'DATA_NORMALIZATION'
    | 'EXCHANGE_RATE'
    | 'JSON_VALIDATION'
    | 'SNAPSHOT_PUBLICATION';
  sequence: number;
  attempt: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  message: string | null;
  error_code: string | null;
  metadata: Record<string, unknown>;
}

export interface ExecutionDetail extends ExecutionListItem {
  processing_date: string;
  timezone: string;
  source_file_name: string | null;
  source_file_sha256: string | null;
  failure_code: string | null;
  failure_message: string | null;
  retry_count: number;
  ingestion_run_id: string | null;
  steps: ExecutionStepRead[];
}
```

---

## 3. Checklist de Design & Padrões Visuais (Hanaro Design System)

Siga rigorosamente as diretrizes documentadas em [page-layout.md](page-layout.md), [page-text.md](page-text.md) e [hanaro.theme.css](../src/app/theme/hanaro.theme.css).

### 3.1 Tipografia e Hierarquia
- [ ] **Fonte única**: Usar `Fustat, sans-serif` (definida globalmente; não redeclarar `font-family`).
- [ ] **Título da página**:
  - Elemento único: `<h1 class="page-title">Execuções e atualização</h1>`
  - Tamanho: `24px/32px` no mobile e `32px/1.2` a partir de `640px`.
  - Cor: token `--app-page-title`.
  - Sem subtítulo nem parágrafos explicativos colados no cabeçalho do `h1`.
- [ ] **Títulos de Seção / Tabela**:
  - Elemento: `<h2>Histórico de rotinas</h2>` (tamanho `20px/28px`, peso `600`).
  - Sem ícone decorativo antecedendo o texto do `h2`.
- [ ] **Textos de Tabela e Células**:
  - Conteúdo padrão: `14px/20px`, cor `--app-text`.
  - Informações secundárias/subtítulos de coluna (ex: processo abaixo do ID): `12px/16px`, cor `--app-text-muted-detail`.

### 3.2 Tokens de Cores e Suporte a Tema Claro / Escuro
- [ ] **Não usar cores hexadecimais fixas nos componentes**. Utilizar exclusivamente os tokens semânticos:
  - Fundo da página: `var(--app-page)`
  - Fundo de cards/tabelas: `var(--app-surface)` ou `var(--app-canvas)`
  - Bordas e divisores: `var(--app-card-border)` e `var(--app-divider)`
  - Cor primária da marca (vermelho LG): `var(--brand-primary)`
- [ ] **Badges de Status Semânticos**:
  - **Concluído / Publicado**: Fundo `var(--app-success-soft)` e texto `var(--app-success)`.
  - **Falha / Preservado**: Fundo `var(--app-danger-soft)` e texto `var(--app-danger)`.
  - **Em andamento / Pendente**: Fundo `var(--app-warning-soft)` e texto `var(--app-warning)`.
  - **Replay inalterado**: Fundo `var(--app-blue-soft)` e texto `var(--app-blue)`.
- [ ] **Transição sem piscadas**: Não adicionar `transition: all` ou transições manuais de cores em elementos com tokens de tema.

### 3.3 Estrutura de Layout e Espaçamentos
- [ ] **Container vertical**: Envolver a página com a classe `.page-stack` (`gap: 24px`).
- [ ] **Barra de Filtros**:
  - Formulário com campos compactos, labels acima de cada controle e botão "Limpar filtros".
  - Manter espaçamento consistente entre inputs (`gap: 16px`).
- [ ] **Tabela**:
  - Alinhamento numérico à direita para contagens (`Recebidos`, `Válidos`, `Rejeitados`, `Duração`).
  - Alinhamento textual à esquerda para `Execution ID`, `Origem`, `Gatilho` e `Status`.
  - Estados vazios (*Empty State*) e de carregamento (*Loading Skeleton*) previstos no design.

---

## 4. Checklist Técnico do Angular

- [ ] **Módulo / Rota Lazy-Loaded**:
  - Criar componente em `src/app/pages/executions/` (ou `src/app/modules/executions/`).
  - Registrar a rota com `loadComponent` em `app.routes.ts`.
- [ ] **Comunicação HTTP e Segurança**:
  - Usar URLs relativas: `/api/v1/scrap/executions`.
  - Deixar o navegador gerenciar o cookie `session_id` (`HttpOnly`).
  - Tratar status `401` redirecionando para login e `403` como acesso negado.
  - Não imprimir payloads sensíveis no `console.log`.
- [ ] **Gerenciamento de Estado**:
  - Usar Angular Signals (`signal`, `computed`) para filtros, paginação e controle do modal.
  - Usar RxJS com `switchMap` e `takeUntilDestroyed` para requisições de listagem.
- [ ] **Testes de Unidade (`.spec.ts`)**:
  - Cobrir renderização da tabela com dados fictícios.
  - Testar disparo de troca de página e alteração de filtros.
  - Testar abertura do modal de detalhes ao clicar na linha da tabela.
  - Validar estado de erro HTTP e exibição de alerta amigável.
