# Plano de migrations e compatibilidade

[Índice](README.md) · [Modelo de dados](03-entidades-e-tabelas.md).

## Ponto de partida

Revisões encontradas: `20260906_12` (governança), `20260909_13` (relatórios) e `20260909_14` (workflows), encadeadas nessa ordem. **Confirmar `alembic heads` no momento da implementação.** M01–M09 abaixo são identificadores de planejamento; gerar revisões Alembic reais sobre o head encontrado, sem editar migrations já aplicadas.

Arquivos futuros ficam em `backend/migrations/versions/`. Usar imports e tipos locais (`sa.Uuid`, DateTime com timezone, JSON compatível) e nomes explícitos de constraints. Não importar os modelos mutáveis do runtime para definir a estrutura histórica da migration.

## Sequência

| Lote / nome descritivo | Upgrade | Dados legados / aceite |
| --- | --- | --- |
| M01 `report_composition_v2` | Colunas de Report, `gov_report_scopes`, `gov_report_sections`, versão fixada em ReportSource | Report existente permanece DOSSIER/schema 1; sem inferir novo período ou seções |
| M02 `report_scope_sources_targets` | Mapeamentos ERP, cobertura e metas versionadas | Nenhuma linha ou carga recebe COMPLETE por suposição; importar metas globais em job explícito e auditado |
| M03 `report_actions_evidence` | Fontes de ação e evidência, constraints dos vínculos | Nenhuma ação/anexo é selecionado automaticamente nos relatórios existentes |
| M04 `report_snapshot_v2` | Financial rows, manifesto, schema versions, recibo de publicação, metadados de renderer; guards | Defaults estruturais para V1; não recalcular hash, métricas ou conteúdo publicado |
| M05 `structured_analysis_evidence` | Classificação, fontes de caso, schemas de análise, assets/links e origem de PublishedEvidence | Dados históricos permanecem não classificados; origem legada é REVIEW_ATTACHMENT |
| M06 `effectiveness_production` | Calendário, ampliação de EffectivenessCheck e contributors | Produção existente continua com suas versões; não declarar eficácia com base em tarefa concluída |
| M07 `plan_charter_deployment` | Charter, membros, marcos, tipo/datas de ação, implantação | Novos campos opcionais; owner/sponsor não são inferidos do autor |
| M08 `process_risks` | Riscos, avaliações e vínculos | Catálogo vazio, sem importar nível de risco de texto livre |
| M09 `additional_if_cost_sources` | Categorias, registros de custo e filhos de snapshot | Categoria material scrap não gera cópia manual dos valores ERP |

Uma sequência linear simplifica a implantação. M05+ entram somente no incremento correspondente. Se o time implementar branches independentes, resolver heads com migration de merge revisada; não reatribuir `down_revision` de revisão já distribuída.

## Algoritmo de cada upgrade

1. Identificar tabelas/constraints existentes e validar precondições. O histórico contém tratamento de `metadata.create_all` antes de Alembic: reconciliar explicitamente esse cenário. Uma tabela encontrada com formato diferente deve falhar com diagnóstico, não ser ignorada por `IF NOT EXISTS` indiscriminado.
2. Adicionar campos nullable ou defaults sem alterar o significado do legado.
3. Fazer backfill determinístico apenas para estado estrutural: tipo DOSSIER, schema 1, origem de evidência. Migração de semântica é job separado, com relatório de diferenças.
4. Criar constraints/índices e guards. Conferir locks e tamanho das tabelas em homologação antes da execução em produção.
5. Validar contagens, chaves estrangeiras, hashes históricos, publicações e fila de exportação existentes.

Não presumir que uma operação DDL pequena em SQLite terá o mesmo custo e comportamento em PostgreSQL. Se índice precisar de criação concorrente, separar a operação transacional conforme recursos do ambiente e validar sua execução; não colocar `CONCURRENTLY` dentro da transação usual sem tratamento.

## Triggers que precisam de atenção

A migration 12 instala guards para versões publicadas, snapshots selados, itens, análises e produção. A nova migration deve instalar guards específicos nos novos filhos, preservando os antigos.

| Alvo | Regra proposta |
| --- | --- |
| `gov_snapshot_financial_rows`, `gov_snapshot_cost_rows` | INSERT/UPDATE/DELETE proibidos após selar; verificar OLD e NEW parent IDs; transação/fonte coerente |
| `gov_report_scopes`, `gov_report_sections`, fontes novas | Escrita apenas com rascunho editável e mesmo escopo; comando do serviço incrementa Report.version |
| `gov_report_case_sources` / `gov_report_analyses` | Análise pertence ao caso/fábrica; publicada quando selecionada para emissão |
| `gov_review_classifications` | Proteger revisão finalizada; correção cria nova versão |
| `gov_source_coverage`, calendário, avaliações e recibos | Append-only conforme domínio; alteração é revisão/novo registro |
| Metas/custos versionados | Uma versão aprovada por chave; só transição controlada APPROVED→SUPERSEDED, sem reescrever valor aprovado |

**Ordem obrigatória ao publicar casos:** criar `ReportVersion` com `published_at = null`, inserir `ReportAnalysis` e outros filhos, selar snapshot e só então publicar. O guard existente de `gov_report_analyses` rejeita INSERT quando a versão já está publicada. A implementação atual publica diretamente; V2 precisa adaptar essa ordem.

Durante backfill de metadados em linhas imutáveis, preferir adição de coluna com default. Se for inevitável um UPDATE bloqueado pelo guard, escrever migration específica e transacional que limite exatamente os metadados permitidos, restaure o guard e prove preservação dos campos/hash; nunca desligar proteção geral como procedimento operacional.

## Migração de metas globais

Não atribuir metas existentes a todas as fábricas. Quando houver uma fábrica local única confirmada, um comando de importação pode criar `MetricTargetVersion` com `source_legacy_id`; se a associação não for inequívoca, pedir configuração na tela administrativa.

Definir uma autoridade de escrita por vez: inicialmente endpoints legados continuam responsáveis pelas metas globais; após ativação V2, writes legados passam por adapter que registra versão na mesma transação, e leituras mantêm seu contrato. Bloquear escrita paralela que faça duas fontes divergir. Uma alteração de meta não modifica edições antigas.

## Reversão

| Lotes | Política de downgrade |
| --- | --- |
| M01–M04 | Reversão estrutural somente em ambiente sem publicações V2 e sem dados novos que seriam perdidos; preflight deve recusar caso contrário |
| M05–M09 | Recusar remoção de tabelas com análises, evidências, medições ou avaliações usadas em edições; preferir rollback de aplicação/feature flag |
| Todos | Remover guards novos antes das tabelas, filhos antes dos pais, restaurar definição anterior de guard alterado; nunca tocar arquivos privados sem política explícita |

Em produção, o rollback preferido desativa novas escritas e mantém leitores V1/V2. Não voltar para uma versão de aplicação incapaz de ler V2 depois que edições V2 existirem.

## Testes de migration

Testar banco novo, banco no head 14 com dados V1 e cenário histórico de tabelas já criadas pelo bootstrap. Capturar antes/depois: contagens, totais, revisão, bytes/hash de arquivos, FKs e sequências. Testar corrida de aprovação de meta/produção e INSERT tardio em snapshot selado em PostgreSQL real.

Alembic autogenerate é rascunho: revisar constraints, triggers, defaults, backfill e downgrade manualmente. Esta entrega não cria scripts `.py` de migration, para não apresentar um plano de schema como alteração pronta para execução.
