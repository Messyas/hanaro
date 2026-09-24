# Domínio e jornadas

[Índice](README.md) · [Tabelas](03-entidades-e-tabelas.md).

## Tipos de relatório

| Tipo | Universo dos indicadores | Fontes narrativas |
| --- | --- | --- |
| `DOSSIER` | União deduplicada da seleção manual; total rotulado como seleção | Ocorrências revisadas, versões de relatórios e análises escolhidas |
| `PERIOD_CLOSE` | Todas as ocorrências contabilizáveis do recorte e fontes complementares habilitadas | Casos, ocorrências e ações selecionados para explicar o resultado |

Os seletores de destaque nunca definem implicitamente o total de `PERIOD_CLOSE`. Toda exclusão financeira é uma regra registrada, e não efeito colateral de remover um slide. Casos fora do período podem entrar como contexto, identificados como tal e sem alterar o numerador.

## Entidades e cardinalidades

| Relação | Regra |
| --- | --- |
| Factory → Report / ProductionLine / ActionPlan / ScrapCase | 1:N; relações cruzadas precisam pertencer à mesma fábrica |
| Report → ReportScope | 1:0..1 no legado, 1:1 para fechamento V2 |
| Report → ReportSection | 1:N; composição editável, IDs e ordem estáveis |
| Report → ReportVersion | 1:N; cada edição tem snapshot selado |
| DatasetSnapshot → SnapshotFinancialRow | 1:N por janela CURRENT/PREVIOUS/BASELINE |
| DatasetSnapshot → SnapshotItem | 1:N; detalhes selecionados, mantidos separados do universo financeiro |
| Report → ImprovementAction | N:N por ReportActionSource; uma ação só aparece uma vez como fonte na edição |
| Report → AnalysisVersion | N:N; fonte no rascunho e ReportAnalysis na versão publicada |
| ScrapCase → ScrapOccurrence | N:N por CaseOccurrence; no máximo um caso primário ativo por ocorrência |
| ScrapCase → AnalysisVersion | 1:N; análises publicadas não são editadas |
| ActionPlan → ImprovementAction | 1:N existente; o plano recebe o charter |
| ImprovementAction → ScrapCase | N:N existente por ActionCase |
| ImprovementAction → ActionDeployment | 1:N; unique ação/linha |
| EffectivenessCheck → ImprovementAction | Um check tem ação principal; contribuintes opcionais compartilham o mesmo ID de benefício |
| Workstation → ProcessRisk → RiskAssessment | Posto tem riscos; risco tem avaliações append-only |

`PlanReport` já liga plano a uma versão de relatório. Não inverter seu significado para selecionar ações em rascunho. `ReportActionSource` resolve essa outra necessidade e quebra a dependência circular “preciso publicar para conseguir descrever a ação”.

## Estados e autoria

- Relatório: conservar DRAFT/PUBLISHED/ARCHIVED; preparar nova revisão explicitamente, sem apagar publicações.
- Caso: conservar NEW/TRIAGED/INVESTIGATING/AWAITING_APPROVAL/ANALYZED/CLOSED; mapear comandos e validações em `cases.py`. Reabertura retorna a investigação com evento.
- Análise: rascunho por `published_at = null`; `publish_analysis()` congela uma revisão. Correção cria próxima revisão.
- Ação: PLANNED/IN_PROGRESS/UNDER_VERIFICATION/COMPLETED já existem. Conclusão valida implementação, não eficácia financeira.
- Produção: DRAFT/APPROVED/SUPERSEDED já existem; aprovação substitui versão corrente atomicamente.
- Eficácia: EFFECTIVE/INEFFECTIVE/INCONCLUSIVE já existem. Um novo exame é outro registro; resultado anterior permanece auditável.
- Snapshot: editável somente durante construção, depois `sealed_at`; filhos também ficam protegidos contra INSERT/UPDATE/DELETE.

Ator e timestamp vêm da sessão/servidor. Registrar eventos de comandos importantes e `correlation_id`, reaproveitando auditoria/outbox existentes. Não tornar observações livres uma fonte de eventos executáveis.

## Jornada de fechamento

1. Autor cria PERIOD_CLOSE e escolhe datas, fábrica, linhas, métrica e moeda.
2. Sistema resolve códigos de linha, revisão das fontes e cobertura; calcula indicadores de todo o recorte.
3. Sistema sugere destaques com motivos verificáveis: maior impacto, ação atrasada, resultado medido. Usuário confirma a escolha.
4. Autor seleciona seções, ações e fotos; revisa conclusões e próximos passos.
5. Prévia retorna composição, manifesto e token de coerência. Mudanças no rascunho ou fontes invalidam o token.
6. Publicação revalida tudo numa visão consistente e preserva evidências; cria snapshot e versão.
7. Worker gera arquivo a partir da edição; UI acompanha job e permite download.

Não é necessário interpretar linguagem natural para calcular indicadores. Sínteses automáticas iniciais podem usar regras determinísticas (“três componentes concentram X%”), mas explicação causal e confirmação de ganho continuam baseadas em análise registrada.

## Jornada de investigação e eficácia

Ocorrência → classificação inicial → caso e análise → ação → evidência de implantação → medição posterior → avaliação → destaque no relatório.

Na classificação, separar sintoma observado de causa suspeita/confirmada. Porquês são lista ordenada, com evidências opcionais e justificativa de encerramento. Categorias secundárias explicam o caso; apenas classificação financeira primária entra no Pareto aditivo.

Na eficácia, congelar ambas as janelas e a regra usada. Duas ações sobre o mesmo problema podem compartilhar uma avaliação: mostrar um benefício único e contribuintes, sem atribuir 100% da economia a cada tarefa.

## Prontidão por seção

| Situação | Comportamento |
| --- | --- |
| Período inválido ou fonte de outra fábrica | Bloquear publicação |
| Prévia anterior à última alteração | Solicitar atualização da prévia |
| Arquivo selecionado indisponível | Bloquear a edição que promete mostrar essa evidência; permitir removê-la do rascunho |
| Falta de revisão/classificação | Mostrar cobertura, pendência e não classificados |
| Fonte financeira incompleta | Permitir edição provisória declarada; impedir afirmação de fechamento completo |
| Meta incompatível | Não calcular atingimento; manter resultado e aviso |
| Resultado posterior não medido | Mostrar “em avaliação”; não exibir redução comprovada |
| Mês sem ocorrências com cobertura confirmada | Mostrar zero |
| Mês sem confirmação de carga | Mostrar desconhecido/parcial |

## Decisões que precisam de validação de negócio

REL-001 fecha definição do indicador, calendário de fechamento e escopos de meta. REL-015 fecha responsáveis pela avaliação e critérios de comparabilidade. REL-019 exige identificar as fontes de reparo, retrabalho e no-work. Essas decisões não autorizam preencher histórico incompleto com suposições.
