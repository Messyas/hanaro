# 01 — Diagnóstico fundamentado no sistema atual

[Índice](README.md) · [Próximo: domínio](02-dominio-e-fluxos.md)

## 1. O que foi inspecionado

Consulta inicial ao Graphify seguida de leitura direcionada de modelos, contratos, reconciliação, classificações, revisões, dashboard, rotas, páginas Angular e testes existentes. O grafo auxiliou a navegação; as conclusões abaixo se apoiam no código. A árvore estava limpa e o merge anterior já havia sido concluído em `457c7ed`.

Stack declarada: Angular 22 e ECharts no frontend; Python >=3.11, FastAPI, Pydantic e SQLAlchemy no backend; PostgreSQL 17 e Redis 8 nos arquivos Compose; Taskiq para trabalhos assíncronos. São versões declaradas no repositório, não versões verificadas de um ambiente em execução.

## 2. Matriz de maturidade

| Capacidade | Evidência no código atual | Leitura para o plano |
| --- | --- | --- |
| Ingestão canônica | `schemas.py`, `service.py`, automação em `automation/material_scrap` | Preservar validação de hashes, totais, Decimal e limites de lote |
| Monitor da automação | Execuções, passos, tentativas, heartbeat, retry e notificações de falha | Evoluir operação; não misturar com ações de melhoria |
| Upload manual de scrap | `manual_upload.py` e rota de ingestão manual | Reutilizar experiência de validação para futura importação de produção |
| Reconciliação | Ocorrências estáveis, observações, versões e lock por organização/data | Bom alicerce; explicitar partições vazias e ordenação temporal |
| Revisão individual | `ScrapReview`, rascunho/finalização, autor, versão, fotos | Ainda não constitui publicação documental imutável |
| Revisão em lote | Copia análise finalizada/modelo para ocorrências elegíveis | Reaproveitar templates; revisar regra de finalização automática |
| Relatórios | Página lista registros com `review_status: REVIEWED` e abre preview | Não há entidade própria de edição/publicação de relatório no módulo inspecionado |
| Dashboard | Fato por ocorrência, séries, rankings, cache por revisão, metas | Já existe projeção; não criar outra camada idêntica sem medir |
| Configurações | Preferências, classificações, tipos de defeito e metas | Falta catálogo relacional de linhas/postos e produção manual |
| Kanban e planos | Não localizados nas rotas/modelos examinados | Funcionalidade a implementar; screenshots são referência |
| Alertas de negócio | Existe notificação técnica de execução | Motor de recorrência, custo e atrasos é expansão distinta |
| Auditoria periódica | Não localizado módulo de ciclos/amostras/achados | Novo processo de domínio |
| Trilha geral de eventos | Há históricos técnicos e operação de revisão em lote | Isso não comprova a trilha imutável geral mostrada na referência |
| TV competitiva | Dashboard tem acesso público agregado documentado | Não foi localizada rota TV dedicada nem denominador de produção |
| PDF/PPTX/CSV/XLSX | Não localizada implementação de emissão no código pesquisado | Planejar pipeline de documentos, não apenas botão de download |

“Não localizado” delimita a inspeção deste checkout; não afirma inexistência em outras branches, protótipos ou serviços externos.

## 3. Achados com consequência de negócio

### D01 — Identidade estável depende de valores corrigíveis

Em [identity.py](../../backend/src/modules/material_scrap/identity.py), `record_key()` inclui quantidade e valor BRL, além de organização, data, conta, item, ordem e referência. Correção de descrição pode gerar nova versão da mesma ocorrência; correção de quantidade/valor muda a chave. Isso decorre diretamente do algoritmo, não de um teste de incidente real.

Consequência: um lançamento corrigido pode aparecer como ocorrência nova, enquanto sua revisão permanece vinculada à anterior. Priorizar um identificador imutável do ERP. Na ausência dele, manter o algoritmo versionado e introduzir vínculo explícito de substituição, com resolução assistida de ambiguidades. Não trocar a função de hash em produção sem backfill e mapa de equivalência.

### D02 — Snapshot vazio e cobertura precisam ser explícitos

`publish_snapshot()` constrói partições somente a partir dos registros recebidos. `_reconcile_partition()` desativa ausentes dentro das partições visitadas. Se uma partição inteira vier vazia, ela não será percorrida por esse código.

Consequência: não é possível inferir com segurança se “zero linhas” representa zero scrap ou uma coleta incompleta. Propor manifesto de cobertura com organização, data, completude e contagem esperada, inclusive zero. Somente um snapshot completo e autorizado pode retirar ocorrências do estado corrente. Extração manual filtrada deve ser parcial por padrão.

Também não foi identificado nessa publicação um controle de precedência por sequência/data de extração dentro da partição: o lock serializa gravações, mas não decide qual snapshot é mais recente. Validar rejeição de publicação atrasada e reprocessamento de uma janela antiga.

### D03 — “Imutável” ainda não vale para todas as derivações

`ScrapClassificationService.reapply()` lê todas as ocorrências ativas, aplica `setattr()` na transação corrente e reconstrói integralmente `ScrapDashboardAggregate`. Os campos de origem não são o alvo da regra, mas a representação canônica derivada/hashes é atualizada no registro existente.

Consequência: a classificação histórica observada não é preservada integralmente só pela transação. Separar fonte de classificações versionadas, com vigência e momento de processamento. Reclassificação deve produzir nova derivação e outra geração analítica, sem reescrever a evidência de uma publicação anterior.

O carregamento integral e a remoção global da projeção também merecem teste de memória/concorrência antes de ampliar o volume. A evolução deve recalcular partições afetadas ou construir uma geração paralela e trocar o ponteiro ao concluir.

### D04 — Finalização de revisão não é congelamento de relatório

`save_review_draft()` verifica autoria e versão, mas não proíbe atualização de uma revisão já `REVIEWED`. A gravação nesse caminho não cria um histórico completo de edições. Anexos também têm caminhos de adição/remoção sem bloqueio de status finalizado. `version` é um contador de concorrência, não um arquivo de versões.

Consequência: não usar essa tabela mutável como documento oficial emitido. Criar `case_analysis_versions` e `report_versions`, com snapshot de dados, anexos, autor/aprovador e regras. Manter o fluxo atual como legado durante a migração.

### D05 — Copiar revisões não substitui investigar um caso

`create_bulk_reviews()` cria novas revisões diretamente como `REVIEWED`; pode copiar anexos. Isso atende repetição de conteúdo, mas não demonstra que dezenas de registros pertencem à mesma causa física ou que a evidência é válida para todos.

Consequência: propor prévia de agrupamento, justificativa, seleção congelada e vínculo explícito com um caso. Template inicia conteúdo; não deve provar conclusão. O comportamento legado precisa de migração comunicada, não mudança silenciosa.

### D06 — Metas e números precisam de definição única

`ScrapTarget` é global por ano/mês/moeda. `dashboard_service.py` soma metas anuais, enquanto `dashboard.store.ts` deriva janelas de apresentação a partir das séries mensais. Filtros por linha/produto não encontram uma meta específica por esse escopo na modelagem atual.

Consequência: risco de comparar realizado filtrado com meta global ou de consumidores futuros calcularem resultados distintos. Centralizar cálculo de período, escopo, moeda, denominador e tratamento de zero no backend; ampliar metas por escopo somente com regra de precedência explícita.

O uso de valor absoluto é uma opção atual do indicador. Não deve ser reinterpretado automaticamente como perda líquida: estornos precisam de regra própria e ligação ao lançamento original.

### D07 — Projeção não é rollup

`build_dashboard_projection()` cria exatamente um fato por ocorrência, com `record_count=1`. Apesar do nome `scrap_dashboard_aggregates`, a tabela não é uma consolidação diária por linha. Ela elimina trabalho de normalização na leitura, mas ainda exige agrupamentos.

Consequência: manter essa granularidade detalhada para filtros/drill-down; acrescentar rollups somente onde as medições justificarem. Não somar dados financeiros depois de juntar ocorrências com várias ações, fotos ou versões de relatório.

### D08 — Consistência entre consultas e cache é uma verificação necessária

O serviço do dashboard lê a revisão, executa várias consultas e grava o resultado no cache. Não há início explícito de um snapshot consistente nesse método. O isolamento efetivo da conexão não foi medido. Se usar `READ COMMITTED`, uma publicação concorrente pode fazer consultas sucessivas enxergarem estados diferentes.

Proposta: leitura com snapshot consistente ou uma geração publicada fixa para todas as consultas; chave de cache vinculada à geração efetivamente lida. Isso é um risco arquitetural inferido do código, não uma falha reproduzida. Ver [estratégia analítica](05-indicadores-relatorios-desempenho.md).

### D09 — Acesso atual tem decisões que devem ser respeitadas

[modelo-de-acesso.md](../modelo-de-acesso.md) permite dashboard agregado público para TV e exige autenticação para detalhes. Revisões restringem edição ao autor; configurações compartilhadas dependem de superusuário. O plano amplia responsabilidades por fábrica/linha, sem tratar ausência de guard visual como prova de acesso indevido ao backend.

Não colocar texto de relatório, foto, nomes pessoais ou detalhes de incidente no contrato público da TV. Separar eventual visualização financeira pública de dados permitidos apenas à gestão.

## 4. Leitura das telas de referência

| Referência recebida | O que preservar | Evolução proposta |
| --- | --- | --- |
| Plano mestre de ações e gráficos | Origem, responsável, prazo, escopo, impacto | Kanban + lista compartilhando filtros; separar implementação de eficácia |
| Drawer “Nova ação” | Entrada manual e seleção de origem | Permitir múltiplos casos, origem explícita e dados herdados sem congelar formulário |
| Eventos detectados | Severidade, escopo, impacto, canal | Distinguir recebido/lido de reconhecido/resolvido; deduplicar |
| Eventos imutáveis | Ator, entidade, antes/depois, correlação | Criar trilha técnica própria; auditoria periódica fica em outra área |
| Linhas e mapa | Catálogo e vigência | Identidade de linha, versões de layout, postos e mapeamento de origem |
| Destinatários | Grupo, escopo, categorias, ativação | Preferências de entrega e histórico; nomenclatura de produto em vez de “CRUD” |
| Regras de notificação | Habilitação por regra | Editor com condições, janela, limite, simulação e destinatários efetivos |

As tabelas das imagens concentram muitas colunas e texto truncado. Isso funciona como visão de trabalho em desktop com detalhes expansíveis, mas não como tela TV nem como formulário completo de investigação.

## 5. Pontos de entrada para implementação

| Fonte | Uso nesta análise |
| --- | --- |
| [models.py](../../backend/src/modules/material_scrap/models.py) | Entidades e constraints atuais |
| [schemas.py](../../backend/src/modules/material_scrap/schemas.py) | Contrato canônico v1, Decimal em string, até 50 mil registros/lote |
| [repository.py](../../backend/src/modules/material_scrap/repository.py) | Snapshot, locks, versões e ausência |
| [classification_service.py](../../backend/src/modules/material_scrap/classification_service.py) | Reaplicação e derivações |
| [review_service.py](../../backend/src/modules/material_scrap/review_service.py) | Autoria, versão, finalização, lote e anexos |
| [dashboard_service.py](../../backend/src/modules/material_scrap/dashboard_service.py) | Séries, escopos, metas e rankings |
| [dashboard_cache.py](../../backend/src/modules/material_scrap/dashboard_cache.py) | Cache por revisão e filtros |
| [routes.py](../../backend/src/modules/material_scrap/routes.py) | Fronteiras da API existente |
| [app.routes.ts](../../frontend/src/app/app.routes.ts) | Superfícies efetivamente disponíveis |
| [reports-page.ts](../../frontend/src/app/pages/reports/reports-page.ts) | Relatórios como consulta de revisões |
| [test_service.py](../../backend/tests/unit/modules/material_scrap/test_service.py) | Testes existentes de replay, sobreposição, identidade e metas |

Os testes existentes foram lidos como evidência de intenção/cobertura. Não foram executados nesta entrega documental. As recomendações de otimização precisam de medição no banco real antes de serem chamadas de ganhos comprovados.
