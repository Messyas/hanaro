# Backend: módulos, classes e métodos

[Índice](README.md) · [Contratos HTTP](06-api-e-contratos.md).

## Pontos de integração existentes

| Arquivo existente | Responsabilidade a preservar/ampliar |
| --- | --- |
| `backend/src/interfaces/api/v1/__init__.py` | Registro de routers; relatórios com prefixo `/reports`, exports/workflows sem esse prefixo |
| `backend/src/modules/governance/models.py` | Entidades e constraints; manter imports via `modules/__init__.py` |
| `governance/schemas.py` | Contratos atuais; V1 continua aceito |
| `governance/service.py` | `create_report`, `update_report`, `mutate_sources`, `_resolve`, `preview_report`, `publish_report` |
| `governance/actions.py` | `save_plan`, `save_task`, `command_task`, `plan_detail`, `task_detail`, `board` |
| `governance/evidence.py` | `preserve_evidence`; generalizar preservação para seleções independentes de item |
| `governance/exports/service.py` | `request_export`, `run_export`, identidade e lease do worker |
| `governance/tasks.py` | `export_report_task` e `enqueue_report_export`; manter outbox como autoridade de despacho |
| `governance/notifications/` | Eventos, tentativas e destinatários; não acoplar cálculo a envio de mensagens |
| `material_scrap/dashboard_service.py` | `ScrapDashboardService`; compartilhar apenas regras compatíveis e verificadas |
| `material_scrap/review_service.py` | `save_review_draft`, `finalize_review`, gestão de anexos e autoria |
| `material_scrap/target_service.py` | Adapter de metas globais para versões novas |

Prefixo omitido nas linhas abreviadas: `backend/src/modules/`. Manter funções públicas existentes como façades durante a migração dos consumidores, evitando uma reestruturação geral do módulo como pré-requisito.

## Estrutura nova proposta

```text
backend/src/modules/governance/
  composition.py
  publication.py
  catalogs.py
  coverage.py
  metric_targets.py
  cases.py
  production.py
  effectiveness.py
  risks.py
  cost_sources.py
  reporting/
    schemas.py
    queries.py
    analytics.py
    calculations.py
    readiness.py
    snapshot.py
  report_composition_routes.py
  analysis_routes.py
  catalog_routes.py
  exports/
    document.py                 # façade por schema
    document_v2.py
    renderers/pptx_v2.py
    renderers/pdf_v2.py
```

Criar arquivos por incremento, quando sua responsabilidade entrar no produto. `models.py` pode ser dividido posteriormente se tamanho justificar; nomes de tabelas/entidades não dependem dessa reorganização.

## Classes e contratos centrais novos

| Classe | Responsabilidade e métodos importantes |
| --- | --- |
| `ReportScopeInput`, `ReportCompositionInput` | Pydantic: validar datas, filtros, tipos de seção e referências; rejeitar campos desconhecidos |
| `MetricPolicy` | Objeto imutável: `is_eligible(row)`, `measure(row)`, `round_for_display(value)`; versão explícita |
| `ReportAnalyticsQueries` | SQL: `fetch_financial_rows(scope, window)`, `fetch_coverage(scope)`, `fetch_targets(scope)`, `fetch_selected_details(ids)` |
| `ReportAnalyticsService` | `build_dataset(db, scope, selections) -> AnalyticsDataset`; unir fontes coerentes, invocar cálculos e produzir manifesto |
| `AnalyticsDataset` | DTO com janelas, linhas financeiras, métricas, séries, paretos, fontes, metas, cobertura e detalhes selecionados |
| `ReportReadinessService` | `evaluate(scope, dataset, composition) -> ReadinessResult`; classificar blockers/warnings por seção |
| `ReportDocumentBuilder` | `build(dataset, composition, selected_actions, evidence) -> ReportDocumentV2`; usado pela prévia e publicação |
| `ReportSnapshotBuilder` | `persist(db, dataset, document, evidence_manifest) -> DatasetSnapshot`; grava e sela na ordem definida |
| `ReportPublicationService` | `publish(db_factory, report_id, command, actor) -> ReportVersion`; transação, idempotência e coerência |
| `ReportEvidenceResolver` | `stage(selections)`, `validate_staged(manifest)`, `preserve(db, manifest)`; leitura privada e cópia durável |

`ReportAnalyticsQueries` não precisa virar um repositório genérico. Manter SQL explícito, selecionar campos necessários e evitar consulta por ocorrência/anexo. DTOs não são entidades ORM e podem ser testados sem banco.

## Métodos de composição

Em `composition.py`:

- `save_scope(db, report_id, scope, expected_version, actor)`: validar fábrica/linhas, canonicalizar filtros e incrementar versão do Report.
- `replace_sections(db, report_id, sections, expected_version, actor)`: substituição atômica, preservando IDs enviados válidos e verificando payload por kind.
- `replace_action_sources(...)`, `replace_evidence_sources(...)`, `replace_case_sources(...)`: fonte existente, escopo compatível e estado elegível; aumentar versão do pai.
- `pin_report_source_version(...)`: conferir edição e impedir ciclo; fontes V1 seguem comportamento legado somente no fluxo V1.
- `prepare_revision(db, report_id, source_revision, expected_version, actor)`: abrir rascunho a partir de edição, copiar estrutura e sinalizar fontes a atualizar.
- `compare_sources(db, report_id)`: retornar mudanças entre manifesto da base e estado disponível; não aplicar mudanças como efeito da leitura.

O endpoint de composição pode agrupar escopo/seções/fontes em um comando atômico para evitar vários salvamentos parcialmente aplicados. Endpoints especializados devem chamar as mesmas funções internas e compartilhar controle de concorrência.

## Cálculos puros em `calculations.py`

| Método | Regra principal |
| --- | --- |
| `sum_cost(rows, policy)` | Decimal; elegibilidade e sinal definidos; deduplicação anterior à soma |
| `build_series(rows, calendar, coverage)` | Bucket temporal com COMPLETE/PARTIAL/UNKNOWN; zero somente com cobertura suficiente |
| `compare_windows(current, previous)` | Diferença absoluta e percentual quando denominador não zero |
| `compare_target(actual, target, coverage)` | Meta do mesmo escopo/janela; explicar meta ausente/parcial |
| `build_pareto(rows, dimension, limit)` | Ranking, participação, acumulado, demais e não classificados; desempate estável |
| `calculate_review_coverage(rows, reviews)` | Contagem e valor cobertos com denominador explicitado; não misturar cobertura de classificação e revisão |
| `calculate_effectiveness(measurement)` | Fórmula, denominador e comparabilidade validados; benefício observado/estimado sem alegar causalidade automática |

Pareto com valores líquidos negativos requer política própria: preferir perda bruta para priorização e exibir ajustes separadamente. Não desenhar participação cumulativa convencional sobre total negativo/zero. Escolher política em REL-001 e congelá-la.

## Publicação coerente

1. Validar usuário e comando; verificar recibo idempotente existente.
2. Preparar arquivos selecionados em armazenamento privado temporário/durável por hash, com manifesto das origens. Esta fase não publica documento nem envia notificação.
3. Abrir sessão/transação de leitura consistente dedicada antes da primeira consulta de negócio. Não tentar configurar isolamento depois que uma dependência já iniciou a transação. Revalidar todas as fontes e os arquivos preparados nessa visão.
4. Bloquear Report, conferir `expected_version`, estado editável e fingerprint da prévia. Garantir uma publicação por vez por relatório.
5. Resolver fontes fixadas, consultar universos/janelas e capturar versões de metas, cobertura, mapeamentos, ações e classificações. Falha de serialização/conflito retorna orientação de atualizar; repetir apenas a transação completa dentro de limite definido.
6. Construir `ReportDocumentV2` e avaliar prontidão. Fontes mudadas em relação ao que o usuário revisou produzem 409, sem publicar uma edição diferente silenciosamente.
7. Gravar snapshot não selado, observações, detalhes, manifesto, evidências e versão ainda não publicada; inserir vínculos de análise.
8. Selar snapshot e publicar versão; gravar hash canônico, recibo, auditoria e outbox na mesma transação. Commit único.
9. Worker de exportação recebe apenas o ID da versão/job, conforme fluxo existente. Arquivos preparados e não referenciados por falha são órfãos candidatos à limpeza posterior por retenção, sem remover objetos ainda referenciados.

Fingerprint cobre conteúdo relevante e revisões de origem, incluindo seleção, meta e legenda; exclui relógio de geração e campos voláteis de transporte. Congelar estado “como observado na captura” é suficiente; não prometer estado global em tempo real após o commit.

## Métodos das etapas analíticas

| Arquivo | Métodos novos |
| --- | --- |
| `catalogs.py` | `list_lines`, `save_line`, `save_line_mapping`, `resolve_line`, `save_layout`, `save_workstation`, `save_cause_category` |
| `coverage.py` | `record_source_coverage`, `resolve_coverage`, `describe_missing_partitions` |
| `metric_targets.py` | `save_target_draft`, `approve_target`, `resolve_target_for_scope`, `import_legacy_targets` |
| `cases.py` | `create_case`, `update_case`, `link_occurrences`, `save_analysis_draft`, `publish_analysis`, `reopen_case` |
| `production.py` | `save_daily_production`, `approve_production`, `revise_production`, `record_operating_day`, `resolve_denominator` |
| `effectiveness.py` | `prepare_measurement`, `validate_comparability`, `record_check`, `supersede_check`, `list_action_checks` |
| `risks.py` | `save_risk`, `record_assessment`, `link_action`, `list_workstation_risks` |
| `cost_sources.py` | `save_cost_record`, `approve_cost_record`, `import_cost_records`, `resolve_if_cost_composition` |

`record_check` grava resultado e participantes da avaliação conjunta atomicamente; não atualiza status de ação como efeito implícito. `approve_production` e `approve_target` substituem a versão corrente sob serialização por chave e registram atores. `resolve_denominator` retorna erro tipado quando a granularidade não suporta o filtro.

## Integração com acesso e eventos

Reusar `get_current_user`, dependência administrativa e tratamento de erros de governança. A política atual permite publicar a autenticados; não reaproveitar a permissão do dashboard público para expor detalhes. Verificar relação entre relatório, fábrica, fontes e arquivos no serviço.

Eventos novos propostos: REPORT_COMPOSITION_CHANGED, REPORT_REVISION_PREPARED, CASE_ANALYSIS_PUBLISHED, EFFECTIVENESS_RECORDED, TARGET_APPROVED, SOURCE_COVERAGE_RECORDED. Usar outbox existente; apenas eventos configurados geram notificações. Recalcular/invalidar caches afetados após commit, sempre com versão de fonte na chave.
