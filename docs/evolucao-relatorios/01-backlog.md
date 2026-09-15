# Backlog de implementação

[Índice](README.md). Status em 11/09/2026: REL-002, REL-004, REL-005, REL-007 e REL-011 estão **concluídos**; REL-001, REL-003, REL-006, REL-008, REL-009 e REL-020 estão **em andamento**; REL-010 e os incrementos B–D permanecem **a fazer**. P0: necessário ao primeiro fechamento; P1: equivalência analítica com a referência; P2: expansão. A ordem abaixo é de dependência, não estimativa de calendário.

## Visão ordenada

| ID | Prioridade / incremento | Entrega | Depende de | Migration |
| --- | --- | --- | --- | --- |
| REL-001 | P0 / A | Contrato de indicador, período e dataset de homologação | — | — |
| REL-002 | P0 / A | Relatório por período e composição V2 | 001 | M01 |
| REL-003 | P0 / A | Mapeamento de linhas, cobertura e metas compatíveis | 001 | M02 |
| REL-004 | P0 / A | Consulta do universo financeiro e métricas compartilhadas | 002, 003 | — |
| REL-005 | P0 / A | Seleção de ações e evidências com legenda | 002 | M03 |
| REL-006 | P0 / A | Snapshot V2, procedência e publicação coerente | 004, 005 | M04 |
| REL-007 | P0 / A | Prévia e validação de prontidão | 004, 005 | — |
| REL-008 | P0 / A | Compositor Angular e seleção paginada | 002, 005, 007 | — |
| REL-009 | P0 / A | PPTX/PDF com blocos, gráficos e fotos | 006 | — |
| REL-010 | P0 / A | Nova revisão e comparação de fontes | 006, 008 | — |
| REL-011 | P0 / A | Integração do fluxo completo e capabilities | 008, 009, 010 | — |
| REL-012 | P1 / B | Classificação estruturada e investigação por caso | 003, 006 | M05 |
| REL-013 | P1 / B | Pareto de causas e casos no documento | 009, 012 | — |
| REL-014 | P1 / C | Produção manual, calendário e aprovação | 003 | M06 |
| REL-015 | P1 / C | Medição antes/depois e eficácia | 012, 014 | M06 |
| REL-016 | P1 / D | Charter, equipe e marcos do plano | 005 | M07 |
| REL-017 | P1 / D | Implantação por linha | 003, 016 | M07 |
| REL-018 | P2 / D | Riscos por posto e medidas | 012, 017 | M08 |
| REL-019 | P2 / D | Composição completa de IF Cost | 004, fontes aprovadas | M09 |
| REL-020 | P0 / todos | Regressão, compatibilidade, operação e rollout | Por incremento | Todas |

## Detalhamento dos itens

### REL-001 — Definição de conteúdo e números — em andamento

Entregue: `MetricPolicy` puro e versionado para `MATERIAL_SCRAP_COST@scrap-cost-v1`. A política considera somente ocorrências ativas, usa custo líquido (`issue_amount_brl` ou `amount_usd`) e arredonda apenas para exibição. Estornos permanecem explícitos no resultado, em vez de serem convertidos para valor absoluto. Restam validação de negócio dessa política, fixture de homologação e a regra de cobertura/meta parcial.

Entregar exemplos de fechamento e dossiê; contrato `MetricPolicy`; conjunto pequeno de dados com totais calculados independentemente; definição de corte, estornos, elegibilidade e moeda. Decidir se meta parcial usa dias aprovados ou fica indisponível; não ratear implicitamente.

Arquivos: schemas novos de análise, testes de domínio e atualização desta documentação. Aceite: negócio consegue explicar cada valor e o universo considerado; fixture cobre ausência, zero, período parcial e duplicidade.

### REL-002 — Escopo e composição — concluído

Entregue: `report_kind` (`DOSSIER` e `PERIOD_CLOSE`), `content_schema_version`, entidades `ReportScope` e `ReportSection`, migration M01, seções padrão e endpoints para leitura/atualização do escopo e substituição ordenada de seções. O fechamento exige período e schema V2 e usa o compositor próprio; o `DOSSIER` e seus snapshots V1 continuam compatíveis.

Ampliar `ReportCreate`, `ReportUpdate`, `Report`, `ReportSource`; criar `ReportScope` e `ReportSection`. Preservar título/descrição e composição V1. `PERIOD_CLOSE` exige período explícito; `DOSSIER` mantém seleção manual. Seções possuem IDs estáveis, ordem e versão do payload.

Arquivos: `governance/models.py`, `schemas.py`, `service.py`, novo `composition.py`, frontend `reports.models.ts`. Aceite: atualização conflitante retorna 409, fontes podem ter versão fixada e relatório antigo abre sem conversão automática.

### REL-003 — Escopo confiável e metas — em andamento

Entregue: `scope_key` canônica, derivada da fábrica e dos filtros dimensionais, sem datas; tabelas `LineSourceMapping`, `SourceCoverage` e `MetricTargetVersion`; consulta que retorna a última revisão de cobertura sem inferir completude quando não há registro; resolução de mapeamento por vigência; e resolução da última meta aprovada para o período exato. A chave normaliza ordem, duplicidade e espaços dos filtros antes do hash e será usada para resolver cobertura e metas sem misturar escopos. Restam comandos administrativos de mapeamento/cobertura/meta, a integração da ingestão e a ligação desses resultados ao compositor analítico.

Operacionalizar fábricas/linhas existentes, mapear códigos ERP por vigência, registrar cobertura por fonte/dia e criar metas versionadas por escopo. Manter metas globais existentes acessíveis. Inicialmente suportar escopos de fábrica e linha; filtros mais detalhados recebem meta indisponível se não houver definição compatível.

Arquivos novos: `catalogs.py`, `coverage.py`, `metric_targets.py`; ampliar Configurações e `material_scrap/target_service.py` para ponte de compatibilidade. Aceite: linha sem mapeamento aparece como “não mapeada”; lacuna de carga não vira zero; meta global não é usada como meta de uma linha.

### REL-004 — Serviço analítico — concluído

Entregue: consulta somente leitura do universo de ocorrências ativas e transações correntes, filtrada pelo escopo V2; política versionada; total, série mensal, comparação customizada ou com ano anterior, Pareto por linha, meta aprovada e cobertura diária consolidada do mesmo recorte. As linhas financeiras alimentam o snapshot, mas não são expostas pelo endpoint analítico público.

Criar `ReportAnalyticsService` e consultas do universo corrente, sem exigir revisão. Reutilizar lógica validada de filtros/projeção do material scrap; separar cálculos puros de acesso ao banco. Gerar totais, série, referência anterior, meta do recorte, Pareto e cobertura de análise.

Arquivos novos em `governance/reporting/`. Aceite: remover um caso destacado não muda o fechamento; mesmas ocorrências em vários relatórios não duplicam custo; total e Pareto reconciliam.

### REL-005 — Ações e evidências — concluído

Entregue: fontes ordenadas de ações e evidências, validação por fábrica/seção, candidatos filtrados pelo período, seletores Angular, legenda/papel/data e preservação de arquivos na publicação. A edição congela os campos das ações e os metadados/bytes das evidências.

Adicionar `ReportActionSource`, `ReportEvidenceSource` e metadados de legenda/papel/data. Reutilizar anexos de revisão no MVP; permitir selecionar evidência já preservada de relatório de origem. Copiar conteúdo das ações na publicação. Não criar plano novo durante a emissão quando já existe um relacionado.

Arquivos: `actions.py`, `evidence.py`, novos contratos de composição; `ActionPlans`, `ScrapReviewAttachments` e seletores do relatório. Aceite: uma foto antes/depois e uma ação existente aparecem na prévia; reabrir ação não modifica edições antigas.

### REL-006 — Congelamento e publicação — concluído

Entregue: `SnapshotFinancialRow` para janelas atual/comparação, schema e manifesto versionados, conteúdo editorial/ações/evidências congelado, hash canônico, publicação V2 sob controle de versão, revalidação do fingerprint da prévia, chave explícita de idempotência por usuário/relatório e guard PostgreSQL para filhos de snapshot. Repetições após timeout retornam a mesma `ReportVersion`; reutilização da chave com payload diferente retorna conflito.

Criar observações financeiras por janela e manifesto de fontes; congelar também blocos, metas, ações e legendas. Implementar transação consistente, revalidação da prévia e idempotência da publicação V2. Instalar guards para novos filhos de snapshot.

Arquivos: novo `publication.py`, `service.py`, `evidence.py`, `models.py`; ver [migrations](04-migrations.md). Aceite: publicação e alteração concorrente resultam em edição coerente ou conflito explícito; links de análise são inseridos antes de marcar a versão como publicada.
### REL-007 — Prontidão e prévia — concluído

Entregue: um único `build_period_close_document` usado por prévia e publicação, com `fingerprint`, bloqueios e avisos tipados. Cobertura incompleta bloqueia edição final e permite edição marcada como provisória; ausência de meta, ações, evidências ou movimento no recorte é informada sem converter ausência em zero confirmado.

Criar `ReportReadinessService` e prévia V2 com bloqueios, avisos e referências para correção. Exemplos: falta de período bloqueia fechamento; causa não classificada informa cobertura; ganho sem medição impede a afirmação de eficácia, mas permite relatório com resultado pendente.

Aceite: frontend não precisa inferir regras do domínio; resposta traz `code`, `severity`, `section_id`, `source_id` quando aplicável e `suggested_action` tipados. Prévia e publicação usam o mesmo construtor de conteúdo.

### REL-008 — Compositor Angular — em andamento

Entregue: criação de `DOSSIER` ou `PERIOD_CLOSE`; edição de período, moeda, comparação e estado provisório; ativação de seções; seleção de ações/evidências; prontidão; e prévia V2 com total, meta, cobertura e série mensal. Restam filtros dimensionais completos, paginação visual além dos primeiros 100 candidatos, extração da página em componentes/store e sinalização persistente de prévia desatualizada.

Extrair responsabilidades de `ReportsPage` para componentes locais e store por editor. Criar fluxo escopo → conteúdo → revisão → emissão. Corrigir paginação de ocorrências, fontes, ações e versões; distinguir “selecionar página” de “todo o filtro”. Não enviar IDs arbitrariamente limitados para definir universo financeiro.

Aceite: usuário encontra e seleciona item além do centésimo; navegação preserva rascunho salvo; prévia antiga é marcada como desatualizada após edição. Componentes e contratos detalhados em [frontend](07-frontend-componentes.md).

### REL-009 — Renderizadores V2 — em andamento

Entregue: template 2 para PDF, PPTX, Markdown e CSV, consumindo somente o conteúdo e as linhas financeiras congeladas; resumo, indicadores, tendência, Pareto, ações, evidências e manifesto são paginados pelos renderizadores existentes. Restam gráficos nativos/editáveis e incorporação visual dos bytes das fotos no PPTX/PDF; nesta etapa, as evidências aparecem com legenda, nome e hash.

Criar blocos tipados e renderização de resumo, tendência, Pareto, tabela de ações, caso com fotos e conclusões. Consumir apenas o snapshot. Manter renderizador legado por schema/template.

Aceite: arquivo abre em software compatível, fotos estão incorporadas, textos/gráficos editáveis quando suportados e tabelas extensas paginam sem ocultar dados. Mesmo valor em prévia, PPTX e PDF, respeitado o arredondamento.

### REL-010 — Nova revisão e diferenças

Criar comando para preparar próxima revisão do mesmo relatório com base na edição escolhida; manter publicações e seus bytes intactos. Copiar estrutura, não reutilizar silenciosamente os números antigos como atuais. Mostrar novas revisões de fontes, ações alteradas e anexos indisponíveis.

Aceite: operação é idempotente, pede `expected_version`; `Report.version` não se confunde com `ReportVersion.revision`. Estado publicado permanece até um comando explícito preparar novo rascunho, se o fluxo atual não permitir editar.

### REL-011 — Integração da emissão — concluído

Entregue: publicação V2 → job idempotente por opções/template → worker → artefato → acompanhamento/download. `capabilities` anuncia templates 1 e 2; o frontend escolhe a versão correspondente ao snapshot e preserva a indisponibilidade quando Taskiq está desligado.

Integrar publicação → pedido de exportação → acompanhamento → download. Ampliar capabilities com formatos/templates suportados; conservar indisponibilidade quando worker estiver desligado. Não enviar notificações extras por padrão.

Aceite: jornada completa com retomada de erro; jobs iguais reutilizam artefato compatível; mudar opção de conteúdo não baixa arquivo anterior inadvertidamente.

### REL-012 — Classificação e casos

Criar taxonomia 4M/subcategoria, vínculos de classificação e API de casos/análises. Estender `ScrapReviewForm` com campos estruturados; conectar `ScrapCase`, `CaseOccurrence`, `AnalysisVersion` e `ActionCase`. Casos com várias ocorrências possuem uma investigação e perda deduplicada.

Aceite: análise publicada é imutável, revisão gera outra versão; “não classificado” permanece mensurável; causas suspeitas não são rotuladas como confirmadas.

### REL-013 — Conteúdo analítico dos casos

Incluir Pareto de causa/4M, porquês e ficha de caso nos blocos V2. Reusar `ReportAnalysis` para vínculo com análise publicada; adicionar fonte de caso no rascunho. Não somar valor inteiro em múltiplas causas secundárias.

Aceite: cada gráfico mostra universo classificado/total e regra de atribuição; relatório de caso inclui ocorrências, causa, ação, evidências e estado do resultado.

### REL-014 — Produção e calendário

Criar tela de entrada por linha/dia em Configurações e comandos de aprovação/substituição de `ProductionVersion`. Registrar calendário operacional. Usar mapeamento de linha da REL-003. Registrar cobertura tanto de produção quanto de scrap.

Aceite: zero aprovado difere de célula ausente; revisão não altera produção histórica usada na edição; denominador por modelo não é inferido de produção por linha.

### REL-015 — Eficácia

Operacionalizar `EffectivenessCheck`, avaliação versionada, janelas e evidências. Registrar métricas monetárias, quantitativas e qualitativas com unidades próprias. Permitir verificação inconclusiva. Manter conclusão de tarefa separada da aprovação de resultado.

Aceite: comparação reproduzível; economia estimada mostra fórmula/hipóteses; ações conjuntas recebem avaliação conjunta sem duplicar ganho.

### REL-016 — Charter e equipe

Ampliar `ActionPlan` com objetivo, período, KPI, baseline, meta e papéis. Criar membros e marcos. Renderizar charter apenas quando selecionado e suficientemente preenchido.

Aceite: uma iniciativa é reutilizada em várias edições; baseline e meta da edição permanecem congeladas após revisão do plano.

### REL-017 — Implantação

Adicionar `ActionDeployment` por ação/linha com planejamento, realização, estado e evidência. Alimentar cronograma e expansão de melhorias.

Aceite: ação pode estar implementada em uma linha e pendente em outra; isso aparece na apresentação sem declarar implantação global.

### REL-018 — Riscos

Operacionalizar layouts/postos existentes, cadastro e avaliação de risco versionada, ligações com ações. Entregar tabela por posto primeiro; mapa sobre desenho da linha é evolução opcional.

Aceite: regra de classificação e versão do layout identificáveis; mitigação executada não reduz risco automaticamente sem reavaliação.

### REL-019 — IF Cost completo

Cadastrar categorias complementares, registros versionados e cobertura/importação idempotente. Conectar esses registros ao snapshot sem duplicar material scrap já originado do ERP.

Aceite: composição só se declara completa com todas as fontes esperadas; dados faltantes aparecem como desconhecidos; ganhos de manutenção não entram como scrap.

### REL-020 — Qualidade e entrega — em andamento

Entregue neste incremento: testes unitários para política, chave de escopo, cobertura, metas, compatibilidade V1 e fluxo V2 de prévia/publicação; compilação Python e compilação Angular de TypeScript/templates. Pendente: executar pytest/ruff em ambiente com dependências de desenvolvimento, teste PostgreSQL das migrations/triggers, inspeção visual dos quatro formatos e rollout operacional.

Criar testes independentes de cálculo, integração PostgreSQL, contratos, componentes, exportação e migração de base anterior. Conferir compatibilidade V1/V2 e capacidade do worker. Usar [matriz de validação](09-validacao-e-entrega.md).

Aceite: checklist do incremento atendido, sem revisões históricas alteradas; atualizar Graphify após futuras alterações de código. Não há critério de prazo/performance aprovado sem medir um volume e ambiente definidos.
