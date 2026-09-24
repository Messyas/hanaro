# Relatório de refatoração do backend — SOLID, Object Calisthenics e padrões de projeto

Data da análise: 13 de setembro de 2026
Escopo: `backend/src`, com ênfase em Governance, Material Scrap e infraestrutura compartilhada
Objetivo: tornar o código mais legível, idiomático em Python, padronizado em inglês e mais aderente a SOLID, sem impor limites artificiais de tamanho de arquivo.

## 1. Resumo executivo

O backend já possui boas bases: separação por módulos, schemas Pydantic, injeção do FastAPI, políticas de métrica imutáveis, renderizadores substituíveis, Outbox, idempotência e proteção contra concorrência nos fluxos críticos. O principal problema não é o tamanho dos arquivos isoladamente, mas a concentração de responsabilidades e dependências concretas dentro dos casos de uso.

Os maiores retornos virão de cinco movimentos:

1. separar comandos de escrita, consultas e montagem de documentos em Governance;
2. definir claramente quem controla cada transação;
3. substituir listas longas por `Command`, `Query Object`, `Options` e `Value Object`;
4. injetar storage, políticas, relógio, classificadores e resolvedores por contratos pequenos;
5. aplicar Builder apenas onde existe construção complexa e progressiva.

Não recomendo transformar cada função em classe ou criar uma interface para cada implementação. SOLID deve proteger fronteiras que variam ou que precisam de testes isolados. Funções puras e pequenas continuam sendo a opção mais idiomática quando não há estado, política intercambiável ou ciclo de vida.

### Diagnóstico geral

| Área | Situação | Risco principal | Prioridade |
|---|---|---|---|
| Governance / reports | muitas responsabilidades no mesmo service | regressões em publicação, composição e consultas | P1 |
| Transações | `commit()` distribuído por services e repositories | atomicidade pouco explícita e baixa composição | P1 |
| Exportação | boa proteção concorrente, orquestração extensa | I/O, estado, persistência e retry acoplados | P1 |
| Material Scrap | domínio rico, porém procedural | dependências ocultas e estados inválidos | P1 |
| Tipagem de resultados | uso recorrente de `dict[str, Any]` e tuplas | contratos implícitos e refatoração insegura | P1 |
| Cache | contrato exige capacidade inexistente no Memcached | violação concreta de LSP/ISP | P2 |
| Application factory | 22 parâmetros opcionais | configuração difícil de evoluir e testar | P2 |
| Idioma | identificadores em inglês; textos de apresentação no código | mistura de código, localização e domínio | P2 |

## 2. Método e baseline

A análise considerou:

- estrutura de módulos, assinaturas, dependências e fronteiras de persistência;
- funções com muitas ramificações, grande extensão ou listas longas de parâmetros;
- instanciação direta de dependências e leitura de configuração dentro dos casos de uso;
- contratos abstratos e sua substituibilidade;
- repetição de montagem de DTOs, paginação, hash e documentos;
- uso pragmático das regras de Object Calisthenics.

O diretório de trabalho contém alterações locais e arquivos ainda não versionados, principalmente na evolução de relatórios V2. Eles foram incluídos na análise e devem ser tratados como o baseline atual, sem qualquer alteração de código por este relatório.

O grafo existente em `graphify-out` está defasado em relação ao `HEAD` e às alterações locais. O executável/módulo Graphify também não está disponível no ambiente atual; portanto, a fonte usada como autoridade foi o código presente no workspace.

As quality gates foram solicitadas, mas não chegaram a iniciar: `uv` tentou usar o interpretador removido `C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe` e falhou ao criar o ambiente. Após corrigir o ambiente, executar:

```powershell
cd backend
uv run ruff check src tests
uv run mypy src --config-file pyproject.toml
uv run pytest tests/unit -q
```

## 3. O que já está bem encaminhado

Estas decisões devem ser preservadas e ampliadas:

- `MetricPolicy` é imutável e concentra comportamento de métrica, um bom exemplo de Value Object + Strategy;
- o registro de renderizadores já aplica Strategy, embora o contrato possa ser consolidado;
- publicação e exportação possuem idempotência, Outbox e fencing/lease; a refatoração não pode enfraquecer essas garantias;
- schemas Pydantic delimitam boa parte da API;
- dependências do FastAPI estão separadas em módulos próprios em várias áreas;
- enums já representam muitos estados de automação;
- operações de escopo e hash estão começando a migrar para funções puras;
- rotas, em geral, delegam o trabalho pesado a services, apesar de ainda haver exceções.

## 4. Inventário priorizado de achados

| ID | Achado | Evidência principal | Correção recomendada |
|---|---|---|---|
| BE-01 | Service de Governance tem muitos motivos de mudança | `governance/service.py` | separar commands, queries, resolução e publicação |
| BE-02 | controle transacional está espalhado | `commit()` em services e repositories | Unit of Work no limite do caso de uso |
| BE-03 | dependências concretas são criadas dentro dos fluxos | analytics, storage, classifier, settings | Ports/Protocols + injeção no composition root |
| BE-04 | publicação recebe muitos parâmetros e possui duas famílias de regra | `publish_report` | `PublishReportCommand` + Strategy por tipo de relatório |
| BE-05 | resolução retorna tupla e mapas sem contrato | `_resolve` | `ResolvedReportSources` tipado |
| BE-06 | montagem de fechamento mistura leitura, regra e representação | `build_period_close_document` | Builder com fases e colaboradores injetados |
| BE-07 | export worker é uma máquina de estados procedural | `run_export` | State/Transition Policy + ports de renderer/storage |
| BE-08 | registro de renderizadores usa mapas paralelos | `RENDERERS` e `MIME_TYPES` | `RendererDescriptor` único |
| BE-09 | consultas usam listas extensas de parâmetros | Scrap e Governance | Query Object + Specification |
| BE-10 | importação manual constrói objeto muito largo inline | `_records` | Factory/Builder de registro canônico |
| BE-11 | automação permite transições dispersas | `execution_service.py` | State Machine explícita |
| BE-12 | repository de Scrap também orquestra e confirma transações | `material_scrap/repository.py` | repositories menores + UoW |
| BE-13 | interface de cache promete operação não suportada | Memcached `delete_pattern` | segregação de capacidades |
| BE-14 | factory FastAPI tem 22 parâmetros | `create_application` | `ApplicationOptions` + Builder/Factory |
| BE-15 | serialização e paginação são repetidas e não tipadas | Governance queries | DTO mappers + `Page[T]` |
| BE-16 | hash canônico está duplicado | `governance/service.py` e `service_types.py` | uma única implementação compartilhada |
| BE-17 | textos de apresentação em português ficam dentro da lógica | report, export, notification, upload | catálogo/i18n; códigos de erro estáveis |
| BE-18 | rotas ainda resolvem settings, storage e serviços concretos | Governance/Material Scrap routes | dependências FastAPI voltadas a Protocols |

## 5. Achados detalhados e formas de correção

### BE-01 — Separar os motivos de mudança em Governance — P1

`backend/src/modules/governance/service.py` concentra criação e edição de relatório, escopo, seções, fontes, detecção de ciclos, resolução de composição, snapshots, publicação, serialização e consultas paginadas. As aproximadamente 1.500 linhas são apenas um indicador; a violação de SRP é a quantidade de razões independentes para editar o módulo.

Estrutura-alvo sugerida:

```text
governance/
  application/
    commands/
      create_report.py
      update_report.py
      mutate_report_sources.py
      publish_report.py
    queries/
      get_report_detail.py
      list_reports.py
      list_eligible_sources.py
  domain/
    publication.py
    source_resolution.py
    policies.py
    value_objects.py
  infrastructure/
    repositories.py
    sqlalchemy_queries.py
  presentation/
    routes.py
    schemas.py
```

Essa estrutura é direcional, não uma obrigação de criar todos os diretórios em um único PR. O primeiro recorte deve ser por comportamento: extrair resolução e publicação, depois consultas.

Critérios de aceite:

- cada caso de uso tem uma entrada tipada e um resultado tipado;
- o módulo de publicação não conhece detalhes das rotas;
- queries não chamam commands nem fazem `commit()`;
- regras de precedência e conflito permanecem cobertas por testes.

### BE-02 — Tornar explícita a propriedade da transação — P1

Há `commit()` em `governance/service.py`, `actions.py`, `exports/service.py`, services de Material Scrap e também em `material_scrap/repository.py`. Um repository que confirma a transação impede que o chamador combine duas alterações de forma atômica. Ao mesmo tempo, alguns commits intermediários da automação e exportação representam transições duráveis intencionais.

A correção não é remover todos os commits mecanicamente. Deve-se classificar cada fluxo:

- caso de uso atômico: um `UnitOfWork` abre, confirma ou desfaz tudo;
- workflow durável: cada transição de estado possui sua própria unidade transacional, explicitamente nomeada;
- query: nunca confirma transação;
- repository: faz `add`, `flush` e consultas, mas não decide `commit`.

Contrato mínimo:

```python
from typing import Protocol

class UnitOfWork(Protocol):
    reports: "ReportRepository"
    events: "EventRepository"

    async def __aenter__(self) -> "UnitOfWork": ...
    async def __aexit__(self, exc_type, exc, traceback) -> None: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...
```

Não criar uma abstração genérica de repository que exponha SQLAlchemy. Os contratos devem usar a linguagem do domínio, por exemplo `get_for_update`, `save_snapshot` e `find_latest_published_versions`.

### BE-03 — Remover dependências ocultas dos casos de uso — P1

Exemplos atuais:

- `ReportAnalyticsService()` é criado dentro do builder de fechamento e nas rotas;
- `ReportArtifactStorage()` é criado dentro do worker e das rotas;
- `ScrapClassificationService()` é criado dentro da ingestão;
- `get_settings()` é lido no meio da exportação e de outros fluxos.

Isso viola DIP e dificulta testes focados. Definir contratos pequenos com `typing.Protocol` e injetar implementações na composição da aplicação:

```python
class ArtifactStorage(Protocol):
    def write(self, key: str, content: bytes) -> None: ...
    def read(self, key: str) -> bytes: ...

class ReportRenderer(Protocol):
    def render(self, document: "Document") -> bytes: ...

@dataclass(frozen=True, slots=True)
class ExportPolicy:
    max_items: int
    lease_seconds: int
```

Settings devem ser convertidos em opções/políticas no composition root. O domínio não deve consultar configuração global.

### BE-04 — Modelar publicação como Command + Strategy — P1

`publish_report` possui dez parâmetros úteis, calcula hash de idempotência, decide entre DOSSIER e PERIOD_CLOSE, valida versões e persiste artefatos. A lista longa é sintoma de um caso de uso grande.

```python
@dataclass(frozen=True, slots=True)
class PublishReportCommand:
    report_id: UUID
    expected_version: int
    template_version: str
    content_schema_version: int
    preview_fingerprint: str | None
    acknowledged_warning_codes: frozenset[str]
    idempotency_key: str | None
    actor_id: int
    correlation_id: str
```

Depois, despachar a regra de composição por Strategy:

```python
class ReportPublisher(Protocol):
    async def prepare(self, report: Report, command: PublishReportCommand) -> "PublicationPackage": ...

publishers: Mapping[ReportKind, ReportPublisher]
```

Evitar `if template_version == ...` espalhado. A seleção deve ocorrer uma vez. A confirmação da publicação, recibo de idempotência, Audit e Outbox deve continuar na mesma unidade transacional.

### BE-05 — Substituir tuplas e dicionários implícitos por resultados tipados — P1

`_resolve` retorna `tuple[list[dict[str, Any]], list[ReportVersion], dict[str, Any]]`. O chamador precisa conhecer índices e chaves internas como `metrics`, `lineage`, `conflicts` e `precedence`.

```python
@dataclass(frozen=True, slots=True)
class ResolvedReportSources:
    items: tuple[ResolvedOccurrence, ...]
    source_versions: tuple[ReportVersionRef, ...]
    metrics: ReportMetrics
    lineage: Mapping[UUID, tuple[LineageEntry, ...]]
    conflicts: tuple[SourceConflict, ...]
    precedence: SourcePrecedence
```

O mesmo vale para os retornos dos documentos V2, paginação e itens elegíveis. Tipos de resultado reduzem primitive obsession e fazem mypy participar da refatoração.

### BE-06 — Aplicar Builder na composição do fechamento — P1

`build_period_close_document` consulta escopo e seções, calcula analytics, preserva evidências, avalia readiness, monta blocos, documento, manifesto, linhas financeiras e fingerprint. É o melhor candidato a Builder porque o resultado é complexo, possui fases, variantes preview/publicação e invariantes entre subestruturas.

Proposta:

```python
@dataclass(frozen=True, slots=True)
class PeriodCloseBuildRequest:
    report_id: UUID
    mode: BuildMode  # PREVIEW or PUBLICATION

@dataclass(frozen=True, slots=True)
class PeriodClosePackage:
    document: ReportDocument
    readiness: ReadinessAssessment
    manifest: PublicationManifest
    financial_rows: tuple[FinancialRow, ...]
    fingerprint: str

class PeriodCloseDocumentBuilder:
    def __init__(
        self,
        reports: ReportReader,
        analytics: AnalyticsProvider,
        evidence: EvidenceProvider,
        actions: ActionProvider,
        hasher: CanonicalHasher,
    ) -> None: ...

    async def build(self, request: PeriodCloseBuildRequest) -> PeriodClosePackage:
        context = await self._load_context(request)
        readiness = self._assess_readiness(context)
        document = self._build_document(context)
        manifest = self._build_manifest(context)
        return self._package(document, readiness, manifest, context)
```

O Builder não deve executar `commit()`. Ele monta um pacote imutável; o caso de uso de publicação decide persistência. Não é necessário um Builder fluente com dezenas de métodos `with_*`.

### BE-07 — Tornar o export worker uma orquestração de estados — P1

`run_export` mistura aquisição de lease, CAS, leitura de snapshot, limite de itens, seleção de renderer, renderização em thread, storage, hash, persistência de Artifact, eventos, retry e falha. Há boas garantias concorrentes que precisam ser preservadas.

Separar em:

- `ExportJobRepository`: leitura com lock, CAS e persistência;
- `RendererRegistry`: formato para descriptor;
- `ArtifactStorage`: port de I/O;
- `ExportTransitionPolicy`: transições válidas e backoff;
- `RunExportJob`: orquestra uma tentativa;
- `ExportEventRecorder`: Audit + Outbox dentro da transação.

Uma State Machine é adequada para impedir transições inválidas:

```python
ALLOWED_EXPORT_TRANSITIONS = {
    ExportStatus.QUEUED: frozenset({ExportStatus.RUNNING}),
    ExportStatus.RUNNING: frozenset({ExportStatus.COMPLETED, ExportStatus.RETRYING, ExportStatus.FAILED}),
    ExportStatus.RETRYING: frozenset({ExportStatus.RUNNING, ExportStatus.FAILED}),
}
```

Não manter transação aberta durante renderização ou storage. O comentário atual já explicita essa decisão e ela deve virar teste de integração.

### BE-08 — Consolidar o contrato dos renderizadores — P2

`RENDERERS` e `MIME_TYPES` são mapas paralelos. Adicionar um formato exige editar ambos, permitindo inconsistência.

```python
@dataclass(frozen=True, slots=True)
class RendererDescriptor:
    media_type: str
    extension: str
    render: ReportRenderer
    supports_options: frozenset[str]

RENDERERS: Mapping[ExportFormat, RendererDescriptor]
```

Isso mantém Strategy e adiciona Registry/Factory. Validações especiais, como opções aceitas por CSV, passam a pertencer ao descriptor/policy do renderer.

### BE-09 — Usar Query Objects e Specifications em filtros extensos — P1

Assinaturas internas relevantes:

| Função | Quantidade aproximada | Solução |
|---|---:|---|
| `execution_service.list_executions` | 15 | `ExecutionSearchCriteria` + `PageRequest` |
| `routes.build_filters` | 13 | `ScrapFilterCriteria` construído pela dependency |
| `query_service.list_scrap` | 11 | `ScrapQuery` + Specification SQLAlchemy |
| `dashboard_service.get_dashboard` | 7 | `DashboardQuery` |
| `service.list_eligible_occurrences` | 8 | `EligibleOccurrenceQuery` |
| `service.list_reports` | 7 | `ReportSearchCriteria` |
| `metric_targets.resolve_approved_target` | 7 | `TargetScope` Value Object |

Exemplo:

```python
@dataclass(frozen=True, slots=True)
class PageRequest:
    number: int
    size: int

@dataclass(frozen=True, slots=True)
class ScrapQuery:
    filters: ScrapFilters
    search: str | None
    review: ReviewCriteria
    sort: ScrapSort
    page: PageRequest
```

Uma dependency FastAPI transforma query parameters no objeto. A rota ainda pode ter vários parâmetros por exigência de documentação/OpenAPI, mas o service recebe apenas `db` e `query`.

Não confundir assinatura longa de adapter com violação de domínio. `read_automation_executions` tem 16 parâmetros, mas a maioria é declarativa do FastAPI. Ainda vale agrupá-los por legibilidade, desde que o OpenAPI e a validação permaneçam equivalentes.

### BE-10 — Factory/Builder para o registro canônico importado — P2

`manual_upload._records` parseia linha, normaliza valores, valida campos e instancia um `CanonicalScrapRecord` muito largo. A construção tem estágios claros.

A opção mais Pythonic para conversão determinística é uma Factory:

```python
class CanonicalScrapRecordFactory:
    def from_gerp_row(self, row: GerpRow, exchange_rate: ExchangeRate) -> CanonicalScrapRecord:
        parsed = self._parser.parse(row)
        normalized = self._normalizer.normalize(parsed)
        self._validator.validate(normalized)
        return self._mapper.to_record(normalized, exchange_rate)
```

Use `CanonicalScrapRecordBuilder` somente se várias fontes montarem parcialmente o mesmo registro, com etapas opcionais e validação final comum. Para uma única linha GERP → registro, Factory é mais simples e evita um Builder cerimonial.

### BE-11 — Centralizar transições da automação — P1

`execution_service.py` altera status, passos, tentativas, heartbeat e falhas em muitas funções. Constantes de estados terminais ajudam, mas não impedem todas as transições ilegais de forma centralizada.

Criar `ExecutionTransitionPolicy` puro, testado por tabela, e manter lock/CAS no repository:

- estado inicial e transições válidas;
- efeitos associados: timestamps, step atual e counters;
- sanitização de mensagem como política separada;
- métodos com nomes de negócio: `start_attempt`, `schedule_retry`, `complete`, `fail`, `cancel`.

Evitar classes `QueuedState`, `RunningState` etc. se uma tabela + funções puras resolverem. State Pattern completo só se os comportamentos por estado crescerem significativamente.

### BE-12 — Reduzir responsabilidades do repository de Material Scrap — P1

`material_scrap/repository.py` cria runs, gerencia câmbio, confirma estados, reconcilia ocorrências, atualiza projeção e marca falhas. Além de persistência, contém algoritmo de reconciliação e decide commits.

Recorte sugerido:

- `IngestionRunRepository`;
- `ExchangeRateRepository`;
- `OccurrenceRepository`;
- `OccurrenceReconciler` para a regra;
- `DashboardProjectionWriter`;
- `MaterialScrapUnitOfWork`.

`_reconcile_partition` é grande, mas relativamente coeso. Não deve ser fragmentado só por tamanho. Extraia primeiro um `ReconciliationContext`, detecção de colisões e criação/atualização de ocorrência, mantendo o algoritmo visível em um único nível de abstração.

### BE-13 — Corrigir LSP e ISP no cache — P2

`CacheBackend` exige `delete_pattern`. `MemcachedBackend` implementa o método apenas para lançar `PatternMatchingNotSupportedError`. Portanto, uma implementação de `CacheBackend` não pode substituir outra sem alterar o comportamento esperado.

Segregar capacidades:

```python
class CacheReaderWriter(Protocol):
    async def get(self, key: str) -> Any | None: ...
    async def set(self, key: str, value: Any, expiration: int) -> None: ...
    async def delete(self, key: str) -> None: ...

class PatternInvalidator(Protocol):
    async def delete_pattern(self, pattern: str) -> None: ...
```

O decorator deve receber uma estratégia de invalidação compatível. Para Memcached, preferir versionamento de namespace/tag em vez de fingir suporte a glob.

Também existem duas classes com o nome `PatternMatchingNotSupportedError`, uma no backend Memcached e outra no decorator. Consolidar a exceção no módulo de contratos.

### BE-14 — Builder/Options para criação da aplicação — P2

`create_application` recebe 22 parâmetros, incluindo metadata OpenAPI, CORS, docs, gzip, lifespan e overrides. Este é um Builder legítimo porque há configuração progressiva de um objeto complexo e várias famílias de opções.

Versão equilibrada:

```python
@dataclass(frozen=True, slots=True)
class ApplicationOptions:
    metadata: ApiMetadataOptions
    cors: CorsOptions
    documentation: DocumentationOptions
    middleware: MiddlewareOptions
    create_tables_on_startup: bool

class ApplicationBuilder:
    def __init__(self, settings: Settings, options: ApplicationOptions) -> None: ...
    def create_base(self, router: APIRouter) -> "ApplicationBuilder": ...
    def add_exception_handlers(self) -> "ApplicationBuilder": ...
    def add_middleware(self) -> "ApplicationBuilder": ...
    def add_documentation(self) -> "ApplicationBuilder": ...
    def build(self) -> FastAPI: ...
```

Se quase todos os consumidores apenas usam defaults, `ApplicationOptions` + uma factory com fases privadas já resolve. Builder fluente é vantajoso para testes que precisam trocar combinações específicas.

### BE-15 — Padronizar paginação e mapeamento de leitura — P2

Várias queries repetem cálculo de total, total de páginas, `has_next`, `has_previous` e montagem manual de dicionários. Criar:

```python
@dataclass(frozen=True, slots=True)
class Page(Generic[T]):
    items: tuple[T, ...]
    number: int
    size: int
    total_items: int

    @property
    def total_pages(self) -> int: ...
```

DTOs de leitura específicos substituem `dict[str, Any]`. Mappers puros podem ser funções; não é preciso criar classes quando não existe estado.

### BE-16 — Eliminar duplicação do hash canônico — P2

`governance/service.py` mantém `_json_default`, `canonical_json` e `_sha256`, enquanto `governance/service_types.py` já oferece `canonical_sha256`. Consolidar em um único módulo, com testes de contrato para Decimal, UUID, datetime, ordenação de chaves e Unicode.

Como fingerprints e idempotency hashes são contratos persistidos, a troca deve provar compatibilidade com fixtures existentes antes de remover a implementação antiga.

### BE-17 — Código em inglês sem misturar localização — P2

Os identificadores estão majoritariamente em inglês. Há, porém, textos em português embutidos em:

- títulos default de seções;
- readiness de fechamento;
- templates de exportação e notificação;
- validação de upload manual;
- mensagens do review service.

Esses textos podem ser intencionalmente visíveis ao usuário; traduzi-los para inglês diretamente seria uma regressão de UX. A padronização correta é:

- identificadores, comentários, docstrings e nomes de testes em inglês;
- códigos de erro estáveis em inglês, por exemplo `SOURCE_COVERAGE_INCOMPLETE`;
- mensagens localizadas em catálogos por locale;
- templates de relatório fora da regra de negócio;
- literais externos/legados preservados em adapters quando fazem parte do protocolo.

Durante a inspeção, `Get-Content` sem encoding explícito exibiu mojibake, enquanto a leitura com `-Encoding UTF8` confirmou que os textos dos arquivos estão corretos. Padronizar ferramentas e pipeline em UTF-8 evita falsos positivos; não há correção de conteúdo a aplicar com base nessa observação.

### BE-18 — Manter rotas como adapters — P2

Algumas rotas ainda chamam `get_settings()`, instanciam storage/analytics e fazem `commit()`. A rota deve:

1. validar e converter HTTP para um command/query;
2. chamar um caso de uso injetado;
3. mapear resultado ou exceção de domínio para HTTP.

Feature flags, storage e analytics devem chegar via dependencies do FastAPI. Exceções `HTTPException` dentro de application/domain services, como em partes de `execution_service.py`, devem migrar para exceções de aplicação e ser convertidas nos exception handlers.

## 6. Long Parameter List: decisão por contexto

Nem toda lista longa pede Builder. A escolha recomendada é:

| Contexto | Padrão preferido | Motivo |
|---|---|---|
| comando de caso de uso | Command Object | representa intenção e facilita validação/idempotência |
| filtros/paginação/ordenação | Query Object | agrupa critérios imutáveis |
| configuração com muitos defaults | Options dataclass | simples e idiomático |
| construção progressiva de objeto complexo | Builder | controla fases e invariantes |
| conversão determinística de uma fonte | Factory | uma entrada produz um objeto completo |
| comportamento variável por tipo/formato | Strategy + Registry | elimina condicionais distribuídos |
| muitos valores primitivos relacionados | Value Object | nomeia conceito e protege invariantes |

Outras assinaturas que merecem tratamento:

- `_build_application_metadata` (13): `ApiMetadataOptions`;
- `_execute_cached_endpoint` (11): `CachePolicy` + `CacheExecutionContext`;
- `request_export` (7): `RequestExportCommand`;
- `_publish_period_close` (9): `PublishReportCommand` + `PublicationPackage`;
- `mutate_sources` (8): `MutateReportSourcesCommand` discriminado;
- endpoints de alerts/tasks (8–9): query dependencies;
- `create_report` (9): `CreateReportCommand` + `ReportFactory`.

## 7. Object Calisthenics aplicado de forma pragmática

### Regras que agregam valor neste backend

1. **Um nível de abstração por função.** Funções de orquestração devem ler como passos de negócio; SQL, mapeamento e cálculo ficam em colaboradores nomeados.
2. **Guard clauses para reduzir nesting.** Aplicar em validações e transições, sem proibir `else` de forma dogmática.
3. **Encapsular primitivos com significado.** `PageRequest`, `DateRange`, `TargetScope`, `CorrelationId`, `LeaseToken`, `ReportFingerprint` e `SourceMutation` são candidatos.
4. **First-class collections quando há invariantes.** `AcknowledgedWarnings`, `ReportSections` e `SourceSet` justificam tipo próprio se validarem unicidade, limite ou ordenação.
5. **Não abreviar conceitos de domínio.** Manter exceções convencionais como `db`, `id`, DTO, API e URL.
6. **Evitar mapas mágicos.** Preferir DTOs, dataclasses e Pydantic models nas fronteiras.
7. **Entidades com comportamento útil.** Transições simples podem viver em objetos/policies; persistência e I/O não devem entrar na entidade.

### Regras que não devem ser impostas literalmente

- limite rígido de linhas por arquivo ou método;
- no máximo dois atributos por classe;
- proibição de mais de um ponto por linha em queries SQLAlchemy;
- proibição absoluta de `else`;
- wrapper para todo `str`, `int` ou UUID;
- interface com uma única implementação sem necessidade de isolamento ou variação.

O critério é redução de complexidade acidental, não conformidade estética.

## 8. Arquitetura-alvo dos fluxos críticos

### Publicação de relatório

```text
FastAPI route
  -> PublishReportCommand
  -> PublishReportUseCase
       -> ReportRepository.get_for_update()
       -> PublisherRegistry.for_kind()
       -> ReportPublisher.prepare()
            -> DocumentBuilder.build()
            -> ReadinessPolicy.assess()
            -> CanonicalHasher.hash()
       -> PublicationRepository.save(package)
       -> EventRecorder.record()
       -> UnitOfWork.commit()
  -> ReportVersionResponse
```

### Ingestão de Material Scrap

```text
Task/route adapter
  -> IngestMaterialScrapCommand
  -> MaterialScrapIngestion
       -> CanonicalBatchValidator
       -> ClassificationResolver
       -> IngestionRunRepository
       -> OccurrenceReconciler
       -> ProjectionWriter
       -> ExecutionTransitionPolicy
       -> explicit workflow transaction(s)
  -> IngestionResult
```

## 9. Sequência de implementação recomendada

### Fase 0 — Proteger comportamento atual

- reparar a referência de Python usada pelo `uv`;
- executar Ruff, mypy e unit tests;
- adicionar characterization tests para publicação V1/V2, fingerprint, idempotência, precedência, export lease e reconciliação;
- registrar quais commits intermediários são intencionais em workflows duráveis.

### Fase 1 — Tipos de entrada e saída, sem mudar comportamento

- introduzir `PageRequest`, `Page[T]`, commands e query objects;
- criar DTOs para `_resolve` e composição V2;
- consolidar hash canônico com teste de compatibilidade;
- substituir parâmetros gradualmente nas bordas internas.

### Fase 2 — Transações e dependências

- definir ports necessários e providers FastAPI/Taskiq;
- remover instanciações diretas de storage, analytics e classifier;
- mover commits dos repositories para casos de uso/UoW;
- manter transações separadas onde o workflow exige durabilidade entre etapas.

### Fase 3 — Extrair Governance

- extrair `ReportSourceResolver`;
- implementar `PublishReportUseCase` e publishers por tipo;
- implementar `PeriodCloseDocumentBuilder`;
- separar query services e mappers tipados.

### Fase 4 — Material Scrap

- criar `ScrapQuery`/Specifications;
- separar repository, reconciler e projection writer;
- centralizar transições da automação;
- extrair Factory/Builder da importação manual.

### Fase 5 — Infraestrutura e idioma

- segregar capacidades do cache;
- consolidar renderer descriptors;
- migrar application factory para Options/Builder;
- extrair catálogos de mensagens e templates localizados.

## 10. Estratégia de testes por refatoração

| Mudança | Testes mínimos |
|---|---|
| Command/Query Object | validação, defaults e igualdade imutável |
| Unit of Work | commit único, rollback e Outbox atômico |
| Source resolver | precedência, ciclo, conflito, lineage e ordenação determinística |
| Period close builder | preview vs publication, readiness, manifest e fingerprint |
| Export state machine | todas as transições, lease expirado, retry e idempotência |
| Renderer registry | formato, media type, extensão e opções suportadas |
| Cache capabilities | Redis com pattern; Memcached com estratégia compatível |
| Reconciler | replay, colisão, superseding e projeção |
| Localization | código estável + mensagem por locale |

## 11. Definition of Done

Uma etapa de refatoração só deve ser considerada concluída quando:

- comportamento público e contratos persistidos permanecem compatíveis ou são versionados;
- nenhuma rota contém regra de negócio ou `commit()`;
- queries não alteram estado;
- repositories não controlam a transação;
- dependências externas são injetáveis nos fluxos críticos;
- comandos e resultados relevantes não usam `dict[str, Any]` como contrato principal;
- funções internas de negócio não mantêm listas longas quando existe um conceito coeso;
- Builders produzem objetos válidos e não executam persistência;
- identificadores e documentação técnica estão em inglês;
- textos visíveis ao usuário vêm de catálogo/template localizado;
- Ruff, mypy e testes unitários passam;
- testes de integração validam atomicidade, concorrência e I/O onde aplicável.

## 12. Decisão final sobre Builder

Aplicar Builder em:

1. `PeriodCloseDocumentBuilder` — prioridade alta;
2. `ApplicationBuilder` — prioridade média, preferencialmente junto de `ApplicationOptions`;
3. `PublicationPackageBuilder` — se a montagem de snapshots V1/V2 continuar crescendo;
4. `CanonicalScrapRecordBuilder` — somente se houver múltiplas fontes ou montagem parcial compartilhada.

Não aplicar Builder em filtros, paginação, commands simples ou seleção de estratégias. Nesses casos, `dataclass`/Pydantic, Factory, Query Object e Strategy deixam o código menor, mais previsível e mais idiomático.

O objetivo arquitetural não é maximizar a quantidade de padrões. É fazer com que cada regra tenha um lugar claro, cada transação tenha um dono, cada dependência possa ser substituída no ponto correto e cada caso de uso seja legível sem conhecer detalhes de HTTP, SQLAlchemy, filesystem ou configuração global.
