# Entidades, tabelas e invariantes

[Índice](README.md) · [Migrations](04-migrations.md). **Modelo proposto**; nomes novos abaixo ainda não existem.

## Convenções de persistência

Reutilizar `GovernanceEntity`: PK `id UUID`, `created_at timestamptz`. Entidades mutáveis recebem `version integer > 0`, `updated_at timestamptz` e autor; configurar optimistic concurrency como no `Report`. Valores financeiros/medidos usam `numeric(24,6)` ou precisão já usada na fonte, nunca float. Na API, decimais são strings.

FKs históricas usam `ON DELETE RESTRICT`. `CASCADE` só em composição descartável de rascunho. JSONB guarda payloads versionados de estrutura variável, validados por Pydantic; IDs necessários a filtros e integridade ficam em colunas relacionais. Em testes SQLite, usar o padrão `JSON_TYPE` existente; os testes de invariantes PostgreSQL continuam obrigatórios.

### Inventário que deve ser reutilizado

| Classe / tabela existente | Uso nesta evolução |
| --- | --- |
| `Report`, `gov_reports`; `ReportVersion`, `gov_report_versions` | Rascunho, autoria, revisão e conteúdo publicado |
| `ReportOccurrenceSource`, `gov_report_occurrence_sources` | Seleção manual de ocorrências |
| `ReportSource`, `gov_report_sources`; `ReportVersionSource`, `gov_report_version_sources` | Fontes de relatórios e vínculo histórico |
| `DatasetSnapshot`, `gov_dataset_snapshots`; `SnapshotItem`, `gov_snapshot_items` | Contêiner selado e detalhes selecionados |
| `PublishedEvidence`, `gov_published_evidence` | Cópia durável do arquivo publicado |
| `ExportJob`, `gov_export_jobs`; `Artifact`, `gov_artifacts` | Fila, tentativas, idempotência e arquivos |
| `Factory`, `ProductionLine`, `LineLayout`, `Workstation` | Catálogo organizacional e físico |
| `ProductionVersion`, `gov_production_versions` | Produção por linha/dia/revisão |
| `ScrapCase`, `CaseOccurrence`, `AnalysisVersion`, `ReportAnalysis` | Investigação e vínculo com edição |
| `ImprovementAction`, `ActionPlan`, `ActionCase`, `ActionOccurrence`, `ActionParticipant`, `PlanReport` | Plano, tarefas, participantes e relações |
| `EffectivenessCheck`, `gov_effectiveness_checks` | Resultado de avaliação |
| `AuditEvent`, `OutboxEvent`, `ConsumerReceipt` | Auditoria e processamento idempotente |
| `ScrapReview`, `ScrapReviewAttachment`, `ScrapDefectType` | Revisão, imagens e tipo de defeito; não duplicar taxonomia de defeito |
| `ScrapTarget`, `scrap_targets` | Meta global legada; manter compatibilidade |

## M01 — Composição e escopo

### Ampliar `Report` / `gov_reports`

Adicionar `report_kind varchar(20) NOT NULL DEFAULT 'DOSSIER'`, check DOSSIER/PERIOD_CLOSE; `content_schema_version integer NOT NULL DEFAULT 1`; `base_version_id UUID NULL FK gov_report_versions`. O último identifica a edição que originou o rascunho. Serviço garante que pertence ao mesmo relatório. Evitar FK obrigatória circular na criação.

### `ReportScope` / `gov_report_scopes` — nova

Campos: `report_id UUID UNIQUE FK gov_reports`, `date_from date`, `date_to date`, `cutoff_at timestamptz`, `timezone varchar(60)`, `currency varchar(3)`, `metric_code varchar(80)`, `metric_policy_version varchar(40)`, `comparison_mode varchar(20)` (NONE/PREVIOUS_YEAR/CUSTOM), `comparison_from/date`, `comparison_to/date`, `filters JSONB`, `scope_key varchar(64)`, `is_provisional boolean`.

Datas de comparação são nullable somente quando não há comparação CUSTOM; check para pares coerentes e início <= fim. Filtros tipados: IDs de linhas e valores de produto/divisão/componente permitidos, ordenados/canonicalizados para hash. Fábrica vem do pai. Uma regra de serviço exige scope para PERIOD_CLOSE; não usar CHECK com subconsulta entre tabelas.

`scope_key` é identidade canônica do recorte dimensional; não inclui período para metas mensais. O hash completo da consulta inclui também datas, corte, política e moeda. Não usar o mesmo hash para as duas finalidades.

### `ReportSection` / `gov_report_sections` — nova

Campos: `report_id FK`, `section_key varchar(80)`, `kind varchar(40)`, `position integer >= 0`, `enabled boolean`, `title varchar(240)`, `payload_schema_version integer`, `payload JSONB`. Unique `(report_id, section_key)`; índice `(report_id, position, id)`.

`kind`: CONTEXT/EXECUTIVE_SUMMARY/KPI/TREND/PARETO/ACTIONS/CASE/EVIDENCE/CONCLUSIONS/APPENDIX; CAUSES/CHARTER/RISKS/EFFECTIVENESS entram nas etapas posteriores. `payload` contém texto editorial e referências tipadas, não cópia arbitrária dos cálculos. Ordem é substituída sob lock do Report; empates são normalizados pelo serviço.

### Ampliar `ReportSource` / `gov_report_sources`

Adicionar `source_report_version_id UUID NULL FK gov_report_versions`. Null preserva política legada de última versão; no rascunho V2 fixar a edição explicitamente. Validar que a versão pertence a `source_report_id`, à mesma fábrica e está publicada. Manter prevenção de ciclos e auto-referência. Não preencher essa coluna retroativamente como se o usuário tivesse escolhido uma revisão.

## M02 — Linhas, cobertura e metas

### `LineSourceMapping` / `gov_line_source_mappings` — nova

`factory_id FK`, `line_id FK gov_production_lines`, `source_system varchar(60)`, `organization_code varchar(80)`, `receipt_department varchar(120)`, `valid_from date`, `valid_to date NULL`, `version`, `author_id FK user`.

Índice de resolução `(factory_id, source_system, organization_code, receipt_department, valid_from)`. Proibir intervalos sobrepostos para a mesma chave de origem: constraint de exclusão PostgreSQL se a infraestrutura suportar a extensão necessária; caso contrário trigger serializado por chave. A implementação deve escolher um mecanismo de banco, não depender apenas de uma consulta prévia sujeita a corrida. Datas usam intervalo [início,fim); `valid_to > valid_from`.

### `SourceCoverage` / `gov_source_coverage` — nova, append-only

`factory_id FK`, `source_system varchar(60)`, `scope_key varchar(64)`, `business_date date`, `revision integer`, `status varchar(20)` (COMPLETE/PARTIAL/UNKNOWN), `expected_partitions JSONB`, `received_partitions JSONB`, `source_revision varchar(160)`, `extracted_at timestamptz NULL`, `recorded_by_id FK user NULL`, `reason text`, `sha256 varchar(64)`.

Unique `(factory_id, source_system, scope_key, business_date, revision)`; índice nos mesmos campos de busca mais revision. Correção é nova revisão, nunca sobrescrita. Integração de ingestão deve registrar conclusão e reconciliar partições; quantidade zero de linhas não confirma cobertura por si só. Sem integração inicial, confirmação manual autorizada é identificada como manual e auditada.

### `MetricTargetVersion` / `gov_metric_target_versions` — nova

`factory_id FK`, `line_id FK NULL`, `metric_code varchar(80)`, `currency varchar(3)`, `period_start date`, `period_end date`, `scope_key varchar(64)`, `revision integer`, `amount numeric(24,6)`, `status varchar(20)` (DRAFT/APPROVED/SUPERSEDED), `author_id FK user`, `approved_at timestamptz NULL`, `approved_by_id FK user NULL`, `source_legacy_id UUID NULL FK scrap_targets`.

Unique `(factory_id, metric_code, currency, scope_key, period_start, period_end, revision)`; índice unique parcial para uma APPROVED na mesma chave sem revision. `scope_key` diferencia fábrica e linha, evitando unicidade ambígua com NULL. Meta não negativa, período válido, APPROVED exige aprovador/data. Inicialmente períodos mensais completos; não ratear mês parcial por padrão.

## M03 — Seleção de ações e evidências

### `ReportActionSource` / `gov_report_action_sources` — nova

`report_id FK`, `action_id FK gov_actions`, `position integer`. Unique `(report_id, action_id)` e índice reverso `(action_id, report_id)`. A escolha é dinâmica em rascunho; conteúdo e versão da ação são congelados ao publicar.

### `ReportEvidenceSource` / `gov_report_evidence_sources` — nova

`report_id FK`, `section_id FK gov_report_sections`, `review_attachment_id UUID NULL FK scrap_review_attachments`, `published_evidence_id UUID NULL FK gov_published_evidence`, `asset_id UUID NULL` (adicionado em M05), `caption text`, `role varchar(20)` (CONTEXT/BEFORE/AFTER/IMPLEMENTATION/MEASUREMENT), `captured_at timestamptz NULL`, `position integer`.

Check exatamente uma fonte preenchida: duas alternativas em M03, três após M05. Serviço exige section pertencente ao report. Índice `(report_id, section_id, position)`. Rascunho selecionado impede exclusão física do anexo por FK; fluxo de remoção deve explicar/desvincular com comando autorizado, nunca perder seleção silenciosamente. Arquivo publicado não depende da disponibilidade futura do anexo original.

## M04 — Snapshot e publicação V2

### Ampliar `ReportVersion`, `DatasetSnapshot` e `ExportJob`

`ReportVersion`: `content_schema_version integer NOT NULL DEFAULT 1`.

`DatasetSnapshot`: `schema_version integer NOT NULL DEFAULT 1`, `manifest JSONB NOT NULL DEFAULT '{}'`. Manifesto inclui versões de política, fontes, cobertura, metas, mapeamentos, ações e evidências. Snapshot V1 recebe apenas defaults estruturais, sem reinterpretar seus dados.

`ExportJob`: `renderer_version varchar(80) NULL`; versões anteriores mantêm comportamento legado. `Artifact` recebe `renderer_version varchar(80) NULL` e `content_schema_version integer NULL` como metadados de saída; não alterar arquivo/hash anterior.

### `SnapshotFinancialRow` / `gov_snapshot_financial_rows` — nova

`snapshot_id FK gov_dataset_snapshots`, `window_key varchar(20)` (CURRENT/PREVIOUS/BASELINE), `occurrence_id FK scrap_occurrences`, `transaction_id FK scrap_transactions`, `frozen_values JSONB`.

Unique `(snapshot_id, window_key, occurrence_id)`; índice `(snapshot_id, window_key)`. `frozen_values` tipado congela data, valores assinados/absolutos, câmbio, dimensões e rótulos, contabilização, classificação e mapeamento. O mesmo occurrence pode aparecer em janelas distintas; agregação jamais soma janelas diferentes como um único total.

`SnapshotItem` continua como detalhe narrativo selecionado. Não remover sua unicidade existente nem exigir review em observação financeira. Adicionar guard de transação pertencente à ocorrência e mesmo escopo da fábrica.

### `ReportPublicationRequest` / `gov_report_publication_requests` — nova

`report_id FK`, `idempotency_key varchar(100)`, `request_sha256 varchar(64)`, `report_version_id FK gov_report_versions`, `actor_id FK user`. Unique `(report_id, idempotency_key)`; inserção na mesma transação da publicação. Repetição de chave com mesmo payload retorna edição; com outro payload retorna conflito. Falha de transação não deixa recibo concluído.

## M05 — Classificação, casos e arquivos de análise

### `CauseCategory` / `gov_cause_categories` — nova

`factory_id FK`, `code varchar(80)`, `name varchar(160)`, `four_m varchar(12)` (MAN/MACHINE/METHOD/MATERIAL), `is_active boolean`. Unique `(factory_id, code)`. “Não classificado” é estado explícito de ausência de classificação, não causa inventada. Renomear catálogo não altera rótulo congelado.

### `ReviewClassification` / `gov_review_classifications` — nova

`review_id FK scrap_reviews`, `review_version integer`, `symptom text`, `condition text`, `workstation_id FK NULL`, `cause_category_id FK NULL`, `cause_status varchar(20)` (UNKNOWN/SUSPECTED/CONFIRMED), `root_cause text`, `equipment varchar(160)`, `author_id FK user`, `recorded_at timestamptz`.

Unique `(review_id, review_version)`; índice `(cause_category_id, cause_status)`. Revisar classificação incrementa a versão da review pelo mesmo comando, não mantém dois contadores concorrentes. CONFIRMED exige justificativa/categoria; JSON de porquês pertence à análise de caso. Guard impede edição da classificação de uma revisão já finalizada; correção cria próxima revisão.

### Ampliar casos e análises existentes

`ScrapCase`: `description text DEFAULT ''`, `line_id FK NULL`, `workstation_id FK NULL`. `AnalysisVersion`: `schema_version integer DEFAULT 1`, `version integer DEFAULT 1` para concorrência do rascunho, mantendo `revision` como edição da análise. `content` recebe schema `CaseAnalysisContent`: problema, causas, sequência de porquês, classificação primária, hipóteses, evidências e decisão. `CaseOccurrence` e `ActionCase` continuam responsáveis pelos vínculos.

`ReportCaseSource` / `gov_report_case_sources`: `report_id FK`, `case_id FK`, `analysis_id FK gov_analysis_versions`, `position`; unique `(report_id, case_id)`. Exigir análise publicada do caso. Usar `ReportAnalysis` existente ao publicar a edição.

### `EvidenceAsset` / `gov_evidence_assets` — nova

Arquivo operacional privado de caso/ação/medição, sem criar review fictícia: `factory_id FK`, `storage_key varchar(500) UNIQUE`, `filename varchar(255)`, `content_type varchar(100)`, `size_bytes bigint`, `sha256 varchar(64)`, `width integer`, `height integer`, `uploaded_by_id FK user`. Metadados de bytes são imutáveis; substituição cria outro asset. Validar imagem com normalização existente.

`EvidenceLink` / `gov_evidence_links`: `asset_id FK`, `case_id FK NULL`, `action_id FK NULL`, `effectiveness_check_id FK NULL`, `caption text`, `role varchar(20)`, `captured_at timestamptz NULL`, `position integer`. Check exatamente um dono; índices em cada dono. Legenda/contexto são do vínculo, não do arquivo.

Ampliar `PublishedEvidence` com `source_kind varchar(30) DEFAULT 'REVIEW_ATTACHMENT'` e `source_asset_id FK NULL`; tornar `source_attachment_id` nullable para novos assets. Check exige fonte coerente. Preservar registros/bytes antigos; o ID do anexo antigo permanece metadado, como no modelo atual.

## M06 — Produção e eficácia

`LineOperatingDay` / `gov_line_operating_days`: `line_id FK`, `business_date date`, `revision integer`, `expected_to_run boolean`, `reason text`, `author_id FK`; unique `(line_id, business_date, revision)`, append-only. Versão efetiva é a maior revisão válida no corte. Não excluir silenciosamente dia do denominador por ter baixa produção.

Reutilizar `ProductionVersion` sem criar outra tabela de produção. Completar serviços de aprovação, validar unidade e ligar seu ID ao manifesto da medição/documento.

Ampliar `EffectivenessCheck`: `schema_version integer DEFAULT 1`, `supersedes_id FK gov_effectiveness_checks NULL`, `evaluated_at timestamptz NULL`. Campo existente `measurement JSONB` recebe contrato tipado: métrica/unidade, escopo, janelas, valores, denominadores, cobertura, versões das fontes, fórmula, limitações, evidências e conclusão. Registros são append-only.

`EffectivenessContributor` / `gov_effectiveness_contributors`: `check_id FK`, `action_id FK`; unique `(check_id, action_id)`. `check_id` é identidade do benefício conjunto. A ação principal continua em `EffectivenessCheck.action_id`; UI exibe contribuidores sem somar benefício novamente. Todos devem pertencer à mesma fábrica e a relação deve ser incluída antes de finalizar o check.

## M07 — Charter e implantação

Ampliar `ActionPlan`: `objective text DEFAULT ''`, `starts_on date NULL`, `ends_on date NULL`, `kpi_code varchar(80) NULL`, `baseline JSONB NULL`, `target JSONB NULL`. Esses JSONs têm valor, unidade, período, fonte e versão; regras métricas ficam no serviço, não em texto livre. Plano sem charter completo continua utilizável no Kanban.

`PlanMember` / `gov_plan_members`: `plan_id FK`, `user_id FK`, `role varchar(20)` (SPONSOR/OWNER/LEADER/MEMBER); unique `(plan_id,user_id,role)`; unique parcial `(plan_id,role)` para papéis singulares SPONSOR/OWNER/LEADER. Autor do plano não se torna sponsor automaticamente.

`PlanMilestone` / `gov_plan_milestones`: `plan_id FK`, `title varchar(240)`, `due_on date`, `completed_on date NULL`, `position integer`, `version`; índice `(plan_id,due_on)`.

Ampliar `ImprovementAction`: `action_type varchar(20) NULL` (IMMEDIATE/CORRECTIVE/PREVENTIVE), `planned_start_at timestamptz NULL`, `started_at timestamptz NULL`, `implemented_at timestamptz NULL`. `due_at`, `owner_id` e validação já existem. A implementação completa TaskInput para expor owner e datas.

`ActionDeployment` / `gov_action_deployments`: `action_id FK`, `line_id FK`, `status varchar(20)` (PLANNED/IN_PROGRESS/IMPLEMENTED/NOT_APPLICABLE), `planned_on date NULL`, `implemented_on date NULL`, `reason text`, `evidence_asset_id FK NULL`, `version`. Unique `(action_id,line_id)`; IMPLEMENTED exige data, NOT_APPLICABLE exige motivo.

## M08 — Riscos

`ProcessRisk` / `gov_process_risks`: `factory_id FK`, `workstation_id FK`, `code varchar(80)`, `failure_mode text`, `owner_id FK user NULL`, `status varchar(20)` (ACTIVE/RETIRED), `version`; unique `(factory_id,code)`.

`RiskAssessment` / `gov_risk_assessments`: `risk_id FK`, `revision integer`, `method_version varchar(40)`, `level varchar(20)` (LOW/MODERATE/CRITICAL), `rationale text`, `assessed_at timestamptz`, `assessor_id FK user`, `measurements JSONB`; unique `(risk_id,revision)`, append-only. Não inventar score industrial universal.

`RiskAction` / `gov_risk_actions`: `risk_id FK`, `action_id FK`, unique do par. Risco pertence ao posto de um layout versionado; mudança de layout precisa de mapeamento explícito para não reinterpretar avaliação antiga.

## M09 — Fontes complementares de IF Cost

`CostCategory` / `gov_cost_categories`: `factory_id FK`, `code varchar(80)`, `name varchar(160)`, `source_mode varchar(20)` (SCRAP/EXTERNAL), `is_active boolean`; unique `(factory_id,code)`. Categoria SCRAP usa a fonte existente e rejeita lançamento manual duplicado.

`CostRecordVersion` / `gov_cost_record_versions`: `factory_id FK`, `category_id FK`, `line_id FK NULL`, `period_start/date`, `period_end/date`, `source_system varchar(60)`, `source_key varchar(160)`, `revision integer`, `currency varchar(3)`, `amount numeric(24,6)`, `status varchar(20)` (DRAFT/APPROVED/SUPERSEDED), `evidence_asset_id FK NULL`, `author_id FK`, `approved_by_id FK NULL`, `approved_at timestamptz NULL`.

Unique `(factory_id,source_system,source_key,revision)`; unique parcial da origem para uma APPROVED. Registrar granularidade: valor mensal não é filtrável por dia/modelo sem detalhamento. Correção é nova revisão; integração usa chave estável.

`SnapshotCostRow` / `gov_snapshot_cost_rows`: `snapshot_id FK`, `window_key varchar(20)`, `cost_record_version_id FK`, `frozen_values JSONB`; unique `(snapshot_id,window_key,cost_record_version_id)`. Guard de selamento igual ao financeiro. As categorias esperadas e cobertura entram no manifesto, inclusive quando não há registros.

## Regras transversais de integridade

1. Guard dos filhos deve verificar pai antigo e novo em UPDATE, impedir inclusão após selamento e serializar com a operação de selar.
2. FKs simples não garantem mesma fábrica; serviços e guards de vínculos críticos devem verificar o escopo.
3. Renomear catálogo não altera rótulos de snapshots; IDs e labels ficam congelados juntos.
4. Fonte órfã, versão não publicada ou ativo de outra fábrica impedem a publicação correspondente.
5. Para dados classificados em review e caso, definir precedência: análise primária publicada do caso; depois classificação da review vigente; por último não classificado. Congelar a escolha e sua procedência.
6. Toda tabela mutável que altera composição participa da versão do Report/Case/Plan pai; não adicionar endpoints de escrita que ignorem o controle de concorrência.
