# API e contratos

[Índice](README.md) · [Serviços](05-backend-servicos-e-metodos.md). Rotas **propostas**, exceto quando indicadas como existentes. Prefixo comum: `/api/v1`.

## Convenções

- IDs UUID, datas ISO, timestamps com timezone e decimais como strings.
- Identidade e privilégios vêm da sessão. Não aceitar `actor_id`/aprovador do cliente como autoridade.
- Mutação de agregado usa `expected_version`; stale write retorna 409.
- Listagens novas usam `Page<T>`: items, page, page_size, total, total_pages, has_next, has_previous. `page_size` 1–100 e ordenação estável por campo + ID.
- Filtros podem selecionar todo o universo analítico sem baixar IDs. Seletores de destaques usam paginação e limites explícitos; não truncar silenciosamente.
- Tipos de erro preservam o envelope existente por adapter; ampliar com código estável e detalhes, sem trocar todos os contratos V1 de uma vez.

## Rotas de relatórios

| Método / rota | Situação / handler | Request → resposta |
| --- | --- | --- |
| GET `/reports` | Existente, ampliar filtros | kind/status/search/page → Page<ReportListItem> |
| POST `/reports` | Existente, ampliar `create_report` | ReportCreateV1 ou V2 → ReportDetail, 201 |
| GET `/reports/{id}` | Existente | ID → ReportDetail com schema/tipo |
| PATCH `/reports/{id}` | Existente | expected_version + campos editáveis → detalhe |
| GET `/reports/{id}/composition` | Novo `read_composition` | → ReportComposition |
| PUT `/reports/{id}/composition` | Novo `save_composition` | expected_version + escopo/seções/fontes → composição e nova versão |
| GET `/reports/{id}/readiness` | Novo `read_readiness` | → ReadinessResult; não persiste alterações |
| GET `/reports/{id}/preview?content_schema_version=2` | Existente, ampliar | → ReportPreviewV2; sem parâmetro mantém resposta V1 |
| POST `/reports/{id}/publish` | Existente, ampliar | PublishRequestV2 → ReportVersion, 201; repetição idempotente 200 |
| POST `/reports/{id}/prepare-revision` | Novo `prepare_revision` | expected_version + base_revision → ReportDetail em rascunho |
| GET `/reports/{id}/source-changes` | Novo `source_changes` | → alterações disponíveis vs manifesto base |
| GET `/reports/{id}/versions` | Existente | paginação → Page<ReportVersion> |
| GET `/reports/{id}/versions/{revision}` | Existente, ampliar | → edição congelada, schema e blocos quando V2 |
| GET `/reports/eligible-occurrences` | Existente | busca/filtros/paginação → ocorrências para destaque; não universo financeiro |
| GET `/reports/{id}/source-reports` | Existente | busca/paginação → fontes elegíveis |
| PUT `/reports/{id}/occurrence-sources/{operation}` | Existente | add/remove/replace, expected_version, ids → detalhe |
| PUT `/reports/{id}/report-sources/{operation}` | Existente | contrato legado preservado; escolha de versão explícita via composição V2 |

Rotas estáticas, como `/reports/eligible-occurrences`, devem continuar antes de `/{id}`. Registro no router existente ou `report_composition_routes.py` com prefixo `/reports` em `interfaces/api/v1/__init__.py`; não duplicar o prefixo.

### Exemplo de criação V2

```json
{
  "title": "Fechamento de material scrap — junho/2026",
  "description": "Acompanhamento mensal de perdas e melhorias",
  "report_kind": "PERIOD_CLOSE",
  "content_schema_version": 2,
  "scope": {
    "date_from": "2026-06-01",
    "date_to": "2026-06-30",
    "cutoff_at": "2026-07-02T12:00:00-04:00",
    "timezone": "America/Manaus",
    "metric_code": "MATERIAL_SCRAP_COST",
    "metric_policy_version": "scrap-cost-v1",
    "currency": "USD",
    "comparison_mode": "PREVIOUS_YEAR",
    "filters": { "line_ids": [], "products": [], "divisions": [], "components": [] },
    "is_provisional": false
  }
}
```

Fábrica omitida conserva a resolução local existente. Em contexto com múltiplas fábricas, exigir seleção explícita autorizada. Arrays vazios significam todas as dimensões disponíveis no escopo, não seleção vazia de ocorrências.

### Contrato de composição

`ReportCompositionInput`: expected_version, scope, sections, occurrence_source_ids, report_sources, action_source_ids, case_sources e evidence_sources. A resposta inclui a versão salva e IDs atribuídos pelo servidor. Ausência de campo no PATCH não significa remoção; o PUT de composição é substituição completa documentada.

`sections[]`: section_key, kind, position, enabled, title, payload_schema_version, payload. Referências de evidência na mesma operação usam `section_key`, resolvido para FK `section_id` pelo servidor.

`report_sources[]`: source_report_id e source_report_version_id. `case_sources[]`: case_id e analysis_id. `evidence_sources[]`: section_key, exatamente uma fonte de arquivo, caption, role, captured_at e position.

Texto livre não pode fornecer valores calculados para substituir métricas do backend. `payload` de KPI/TREND referencia código de dataset; `payload` de conclusão guarda texto editorial.

### Prévia e publicação

`ReportPreviewV2`: report_id, report_version (concorrência), document, readiness, source_manifest, preview_fingerprint, generated_at. `document` segue [contrato de documento](08-documento-e-exportacao.md); listas financeiras completas usam drill-down paginado, não precisam viajar na prévia.

```json
{
  "expected_version": 7,
  "content_schema_version": 2,
  "template_version": "2",
  "preview_fingerprint": "hash-retornado-pela-previa",
  "acknowledged_warning_codes": ["UNCLASSIFIED_CAUSES"],
  "idempotency_key": "chave-unica-do-comando"
}
```

Reconhecer aviso não autoriza ignorar bloqueio. V1 continua aceitando payload atual sem fingerprint/chave; garantias novas são exigidas somente no fluxo V2. `prepare-revision` também aceita chave idempotente, persistida no mecanismo de recibo de comando a definir sem reutilizar indevidamente recibo de publicação; alternativa inicial: tratar repetição com mesma base e versão já preparada como retorno do mesmo rascunho, sob lock e evento identificável.

### Erros tipados propostos

| HTTP / código | Uso |
| --- | --- |
| 401 / AUTHENTICATION_REQUIRED | Sessão ausente |
| 403 / ADMIN_REQUIRED | Escrita administrativa sem privilégio |
| 404 / SOURCE_NOT_FOUND | Fonte inexistente ou fora do escopo visível |
| 409 / REPORT_VERSION_CONFLICT | Rascunho mudou |
| 409 / PREVIEW_OUTDATED | Fontes/composição diferem da prévia |
| 409 / IDEMPOTENCY_CONFLICT | Mesma chave com payload distinto |
| 422 / INVALID_REPORT_SCOPE | Período/filtro incompatível |
| 422 / REPORT_NOT_READY | Bloqueios; detalhes apontam seção e correção |
| 422 / UNSUPPORTED_DENOMINATOR_GRAIN | Produção não suporta granularidade |
| 503 / EXPORT_UNAVAILABLE | Worker desligado, como no fluxo atual |

## Exportação: manter rotas existentes

| Rota | Evolução |
| --- | --- |
| POST `/report-versions/{version_id}/exports` | Validar combinações schema/template/renderer; retorna 202 com job |
| GET `/report-versions/{version_id}/exports` | Histórico paginado |
| GET `/exports/{job_id}` | Status, tentativa, erro e artifact |
| GET `/exports/{job_id}/download` | Bytes do artefato pronto, acesso autenticado |
| GET `/report-evidence/{evidence_id}` | Arquivo preservado autorizado |
| GET `/governance/capabilities` | Acrescentar schemas, templates, formatos e composição V2 suportados |

ExportRequestV2 mantém format/options/template_version e acrescenta perfil `EXECUTIVE` ou `COMPLETE`. Opções: idioma, dinheiro, resumo, detalhe, justificativas e evidências continuam com significado explícito. Perfil altera apresentação, não universo ou fórmulas. `renderer_version` é escolhido pelo servidor e aparece no resultado; não aceitar carregamento de renderer arbitrário.

## Casos, produção, eficácia e programa

| Rotas propostas | Comando/consulta | Acesso |
| --- | --- | --- |
| GET/POST `/cases`; GET/PATCH `/cases/{id}` | Listar/criar/editar caso | Autenticado |
| PUT `/cases/{id}/occurrences` | Substituir vínculos, expected_version | Autenticado |
| POST `/cases/{id}/analyses`; PUT `/cases/{id}/analyses/{analysis_id}` | Rascunho de análise; revisão/versão distintas | Autenticado |
| POST `/cases/{id}/analyses/{analysis_id}/publish` | Publicar análise | Autenticado; preservar autoria aplicável |
| GET `/cases/{id}/analyses` | Histórico de análises | Autenticado |
| GET/PUT `/scrap/occurrences/{id}/classification` | Ler/gravar via comando que versiona a review | Mesma política de dono/admin da review atual |
| GET `/actions/{id}/effectiveness-checks`; POST na mesma rota | Histórico e nova avaliação | Autenticado |
| POST `/effectiveness/preview` | Calcular comparação sem registrar conclusão | Autenticado |
| GET/PUT `/action-plans/{id}/charter` | Charter, membros e marcos em comando atômico | Autenticado |
| GET/PUT `/actions/{id}/deployments` | Implantação por linha | Autenticado |
| POST `/evidence-assets`; GET `/evidence-assets/{id}` | Upload multipart/leitura privada | Autenticado; dono do vínculo e escopo |
| POST `/cases/{id}/evidence`; POST `/actions/{id}/evidence` | Vincular asset, legenda e papel | Autenticado |
| PATCH/DELETE `/evidence-links/{id}` | Alterar/remover vínculo operacional | Autenticado; não remover cópia publicada |
| GET/POST `/process-risks`; PATCH `/process-risks/{id}` | Cadastro de risco | Autenticado |
| POST `/process-risks/{id}/assessments`; GET na mesma rota | Registrar/consultar avaliação | Autenticado |
| PUT `/process-risks/{id}/actions` | Vincular medidas | Autenticado |

Rotas já existentes `/action-plans`, `/action-plans/{id}/tasks`, `/actions/{id}/commands` continuam atendendo Kanban. Ampliar seus DTOs com owner, tipo e datas; não criar um segundo endpoint concorrente para mover a mesma tarefa.

## Configurações compartilhadas

Rotas novas sob `/governance`: GET de catálogo exige autenticação; POST/PUT/PATCH e aprovações exigem superusuário, conforme política de configurações atual. Dashboard público continua com DTO agregado próprio.

| Recurso | Rotas / comportamento |
| --- | --- |
| Fábricas/linhas | GET/POST `/factories`; PATCH `/factories/{id}`; GET/POST `/lines`; PATCH `/lines/{id}` |
| Mapeamento | GET/POST `/line-source-mappings`; PATCH `/{id}` com vigência e expected_version |
| Layout/posto | GET/POST `/lines/{id}/layouts`; GET/POST `/layouts/{id}/workstations`; nova revisão para mudança estrutural |
| Cobertura | GET/POST `/source-coverage`; POST cria registro/revisão, não sobrescreve histórico |
| Metas | GET/POST `/metric-targets`; PUT `/metric-targets/{id}` para rascunho; POST `/{id}/approve` |
| Causas | GET/POST `/cause-categories`; PATCH `/cause-categories/{id}` |
| Produção | GET/POST `/production`; PUT `/production/{id}` para rascunho; POST `/{id}/approve` |
| Calendário | GET/POST `/operating-days`; registro de nova revisão |
| Custos | GET/POST `/cost-categories`; PATCH `/cost-categories/{id}`; GET/POST `/cost-records`; PUT `/cost-records/{id}` para rascunho; POST `/{id}/approve`; POST `/cost-records/import` |

Os caminhos abreviados `/{id}` nesta tabela mantêm o recurso da linha. Ingestão automatizada de cobertura/custos exige credencial e escopo apropriados; não dar privilégio de navegador ao robô. Importação pode ser job após medir volume, sem impor nova fila ao cadastro manual pequeno.

### Contrato de medição

`EffectivenessInput`: action_id, contributor_action_ids, metric_code, unit, currency quando aplicável, scope, before {from,to}, after {from,to}, source_mode (SYSTEM/MANUAL), manual_values quando necessário, evidence_ids, conclusion, limitations e supersedes_id opcional.

SYSTEM resolve fontes e cálculos no servidor. MANUAL exige fonte e justificativa, e mantém resultado declarado identificado. Não confiar em resultado percentual enviado pelo cliente como cálculo oficial. POST de avaliação usa chave idempotente de comando e retorna check imutável; registrar a chave em auditoria com unicidade por comando/ator ou tabela de recibo própria no incremento C.

## Matriz de autorização

Atualizar `docs/modelo-de-acesso.md` durante a implementação para incluir as rotas novas antes de habilitá-las. Respeitar as regras de autoria de revisão atuais, que são diferentes da permissão geral de publicar relatório. O frontend não é a barreira de autorização; todos os comandos validam backend e CSRF quando aplicável.
