# 05 — Indicadores, ranking, emissão de documentos e desempenho

[Índice](README.md) · [Telas](06-telas-e-jornadas.md)

As definições abaixo são propostas de produto. A aprovação de cada métrica deve registrar proprietário, versão, escopo e exemplos reconciliados com a operação. Valores do exemplo não são dados reais da fábrica.

## 1. Contrato semântico dos indicadores

Uma métrica precisa de código, fórmula, unidade, moeda, direção favorável, granularidade, política de inclusão/estorno, fonte do denominador, cobertura mínima, precisão e período de vigência. O backend produz o valor oficial; frontend e exportadores apenas formatam esse resultado.

| Indicador | Definição proposta | Cuidados |
| --- | --- | --- |
| Custo bruto de scrap | Soma das perdas elegíveis, em convenção positiva de perda | Não somar `abs()` de estornos como se fossem novas perdas |
| Ajustes/recuperações | Ajustes identificados pela natureza contábil e vínculo à origem | Não presumir pelo sinal sem validar o contrato ERP |
| Custo líquido | Perdas elegíveis menos recuperações elegíveis | Manter reconciliação com valor assinado da fonte |
| Custo por unidade produzida | Custo elegível / unidades acabadas produzidas no mesmo escopo | Comparar produtos/processos compatíveis; moeda fixa |
| Taxa de produtos afetados | Produtos defeituosos únicos / produtos produzidos × 100 | Só existe com contagem de produtos, não soma de componentes |
| Peças descartadas por mil produzidas | Peças descartadas compatíveis / produtos produzidos × 1.000 | É razão de peças por produção, não percentual de monitores defeituosos |
| Registros ERP | Contagem de ocorrências distintas correntes | Não equivale a incidentes ou unidades defeituosas |
| Casos | Contagem de casos distintos | Uma ocorrência em contexto de vários casos não multiplica a perda |
| Cobertura de revisão obrigatória | Obrigações concluídas / obrigações devidas do universo definido | Excluir dispensas do denominador; preservar coorte/política |
| Passivo de revisão | Obrigações ainda abertas, com faixas de atraso | Separar indeterminados e fila não atribuída |
| Eficácia de ações | Verificações eficazes / verificações concluídas elegíveis | Mostrar inconclusivas e ações ainda sem avaliação separadamente |
| Custo vs meta | `(realizado - meta) / meta × 100` | Menor é favorável; meta zero requer tratamento específico |
| Conformidade da auditoria | Itens conformes / itens efetivamente examinados | Informar amostra/população; não alegar cobertura integral |

Definir com o negócio se “IF Cost” deve significar bruto, líquido ou outra composição contábil. O sistema atual oferece modos absoluto/assinado; preservá-los como métricas nomeadas enquanto a nova definição é aprovada, sem alterar totais históricos silenciosamente.

Para câmbio, manter taxa, data efetiva, origem e fallback. USD histórico usa a política escolhida e congelada na edição. Não reconverter perdas antigas com o câmbio de hoje sem declarar uma visão de moeda constante separada.

## 2. Produção e comparabilidade

Orientação confirmada: entrada manual em Configurações no MVP. Ranking só usa versão aprovada. Cobertura de produção é calculada sobre dias/linhas que deveriam operar segundo calendário; zero explícito e aprovado não equivale a célula ausente.

Numerador e denominador devem usar a **mesma interseção de linha, período, família e dias válidos**. Se faltar scrap completo em um dia de produção, não dividir o scrap dos demais dias por toda a produção do período. Preferir inelegibilidade do recorte oficial; uma visão parcial pode ser mostrada com cobertura explícita e fora da competição.

O cadastro inicial de produção por linha/dia suporta custo por unidade nessa granularidade. Não suporta automaticamente taxa por modelo, turno ou posto. Esses filtros precisam de denominador na mesma granularidade ou a resposta deve retornar `UNSUPPORTED_DENOMINATOR_GRAIN`.

### Exemplo que explica por que custo absoluto não define o ranking

| Linha | Produção aprovada | Perda elegível | Custo por unidade | Prioridade de custo absoluto |
| --- | ---: | ---: | ---: | --- |
| A01 | 10.000 | R$ 1.000 | R$ 0,10 | Menor perda total |
| A02 | 100.000 | R$ 5.000 | R$ 0,05 | Maior perda total |
| A03 | Não informada | R$ 0 | Não calculável | Dados insuficientes |

Dentro de um grupo de produto/processo comparável, A02 tem melhor custo por unidade, apesar da maior perda absoluta. A03 não vence por ter zero observado. Se A01 e A02 fabricarem produtos muito diferentes, colocá-las em grupos próprios ou comparar distância para metas específicas aprovadas, com metodologia transparente.

Não usar soma de quantidade de painéis, parafusos e embalagens para declarar percentual de monitores defeituosos. Se a medida disponível for custo, lançar primeiro ranking de custo por unidade e rotular precisamente. Ampliar para taxa de produtos afetados quando existir fonte deduplicável de produtos/serial/lote.

### Elegibilidade proposta

Requisitos: linha ativa no grupo, produção aprovada >0, cobertura completa do recorte oficial, fonte scrap completa, volume mínimo configurado e métricas/unidades compatíveis. Antes de publicar resultado definitivo do mês, exigir fechamento ou prazo de contestação.

Volume mínimo e cobertura tolerada em ranking preliminar devem ser configuráveis. Um limite ilustrativo de 1.000 unidades não é regra industrial universal. Linhas inelegíveis continuam visíveis, com motivo, sem posição numérica.

Empates usam valores não arredondados, com precisão definida, e compartilham posição se iguais nessa precisão; ordenação alfabética só estabiliza a apresentação. Mostrar evolução contra a própria baseline como reconhecimento adicional, sem misturar com ranking absoluto em um score opaco.

## 3. Metas e janelas temporais

Selecionar uma única meta efetiva por métrica, escopo e período. Meta de linha tem prioridade sobre meta de fábrica apenas se cadastrada; não dividir meta global igualmente entre linhas sem regra aprovada. Meta incompatível com filtro retorna “meta não definida para este recorte”.

YTD vai do início do ano ao corte explícito; comparação anterior usa janela equivalente, incluindo definição de dias fechados. Sem produção por dia em um mês incompleto, não apresentar projeção mensal como realizado. Semanas usam ano ISO + semana ISO para evitar erro na virada de ano.

Casos de zero: meta zero e realizado zero = meta atendida, razão percentual não aplicável; meta zero e realizado positivo = acima da meta, sem infinito exibido; referência zero = variação absoluta disponível e percentual indefinido. Ausência de linha/fonte = desconhecido, não zero.

Separar `generated_at` (resposta gerada), `source_extracted_at` (extração), `data_through` (cobertura) e `projection_completed_at` (consolidação). Um relógio de consulta recente não prova que a automação está atualizada.

## 4. Antes/depois e eficácia

Exemplo: baseline de R$ 10.000 para 100.000 unidades = R$ 0,10/unidade. Após ação: R$ 6.000 para 100.000 = R$ 0,06/unidade; redução observada de 40%. Com 50.000 unidades no período posterior, R$ 6.000 significaria R$ 0,12/unidade, piora de 20%, apesar de gasto total menor.

Registrar janelas, mix de produto, paradas, mudanças de processo, produção e completude. “Economia estimada” pode ser `(custo unitário baseline - custo unitário posterior) × produção posterior`, com resultado e hipótese explícitos. Não chamar toda associação temporal de ganho causal confirmado.

Se duas ações atuam juntas, o conjunto possui um benefício estimado. Não atribuir 100% a ambas. Enquanto não houver método de alocação aprovado, mostrar resultado do caso/conjunto e marcar contribuição individual não estimada. Resultado negativo não deve ser truncado para zero sem indicar piora.

## 5. Três camadas para consultas e documentos

| Camada | Finalidade | Atualização | Não usar para |
| --- | --- | --- | --- |
| Fato corrente por ocorrência | Base detalhada, filtros, drill-down | Publicação/reclassificação | Preservar sozinho edição histórica |
| Rollup diário por linha | Dashboard/TV e séries frequentes | Partições afetadas ou geração periódica | Texto/anexos de relatório ou filtros que não estão no grão |
| Snapshot documental | Edição oficial e reprodução | Criado uma vez por edição | Substituir base operacional corrente |

O projeto já tem o primeiro nível em `scrap_dashboard_aggregates`. Recomenda-se inicialmente uma tabela de rollup mantida por job idempotente quando necessário, sem eliminar esse fato detalhado. As métricas de fila/casos/ações podem começar com consultas indexadas, já que sua cardinalidade tende a ser menor; isso deve ser medido.

Tabela proposta `line_daily_rollups`: uma linha por `(generation_id, line_id, production_date, metric_definition_version_id, currency)`, com numerador, denominador, cobertura e resultado. Não repetir produção integral em cada componente/conta e depois somar. Para Pareto por componente, agregar perdas separadamente, sem carregar denominador aditivo.

## 6. Materialized view: onde faz sentido

Uma materialized view pode simplificar uma consolidação periódica quando leituras são frequentes e a defasagem é aceitável. No PostgreSQL 17, `REFRESH` substitui seu conteúdo; `CONCURRENTLY` exige índice unique que cubra todas as linhas, só funciona após a primeira população e permite apenas um refresh por view por vez. Portanto, não é atualização incremental automática nem histórico de publicações. [Referência oficial PostgreSQL 17](https://www.postgresql.org/docs/17/sql-refreshmaterializedview.html).

Trecho ilustrativo sobre a projeção atual: consolida custo absoluto por código de origem/dia apenas para medir um candidato a Pareto. **Não representa a definição final de perda líquida nem o catálogo futuro de linhas.**

```sql
CREATE MATERIALIZED VIEW mv_scrap_daily_source_cost AS
SELECT
    f.organization_code,
    f.receipt_department,
    f.transaction_date,
    SUM(f.issue_amount_brl_abs) AS amount_brl_absolute,
    SUM(f.record_count) AS record_count
FROM scrap_dashboard_aggregates f
JOIN scrap_occurrences o ON o.id = f.occurrence_id
WHERE o.status = 'ACTIVE'
  AND f.to_be_counted_key = 'true'
GROUP BY f.organization_code, f.receipt_department, f.transaction_date
WITH NO DATA;

CREATE UNIQUE INDEX uq_mv_scrap_daily_source_cost
ON mv_scrap_daily_source_cost
  (organization_code, receipt_department, transaction_date);

-- Primeira carga antes de habilitar leitores:
REFRESH MATERIALIZED VIEW mv_scrap_daily_source_cost;

-- Atualizações posteriores, serializadas pelo agendador:
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_scrap_daily_source_cost;
```

Decisão recomendada: não implantar MV e tabela de rollup equivalentes simultaneamente. Escolher MV se refresh completo couber no orçamento e frequência; escolher tabela de rollup por partição quando houver correções frequentes, necessidade de geração coerente entre várias métricas ou custo alto de refresh. Medir com dados representativos antes de escolher.

## 7. Consistência e publicação de gerações

No PostgreSQL, `READ COMMITTED` pode ver resultados diferentes entre consultas sucessivas. Para montar um snapshot documental de várias consultas, usar uma transação de leitura consistente, por exemplo `REPEATABLE READ`, configurada antes da primeira consulta, e copiar os valores necessários. Renderizar documentos somente após finalizar essa captura. O isolamento não congela consultas futuras nem substitui o armazenamento do snapshot. [Isolamento no PostgreSQL 17](https://www.postgresql.org/docs/17/transaction-iso.html).

Fluxo proposto para projeções: registrar revisão das fontes → construir geração candidata → conferir contagens/totais/cobertura → marcar concluída → trocar ponteiro corrente atomicamente → invalidar cache. Geração nunca fica parcialmente pública. Uma construção que descobre mudança de fonte deve reiniciar ou publicar declaradamente o snapshot anterior com a revisão correta, sem etiquetá-lo como atual.

Chave de cache: geração + versão da métrica + filtros canônicos + escopo de acesso + moeda + janela. Consultas públicas e privadas não compartilham payloads. Mudanças em produção, meta e classificação invalidam apenas o que depende delas, quando a granularidade permitir.

Para rollup incremental, **recalcular e substituir a partição** costuma ser mais simples que somar deltas com múltiplos estornos/retries. Serializar escritores por partição, gravar geração e recibo do evento, e comparar com a soma do fato corrente. Se exigir consistência entre muitas partições, publicar uma geração completa ou manifesto de revisões fixas.

## 8. Emissão PDF, PowerPoint, CSV e planilha

Todos os formatos nascem do mesmo dataset congelado e de uma representação intermediária: título, escopo, indicadores calculados, séries, tabelas, conclusões e evidências autorizadas. Cada renderizador cuida de layout, não de recalcular métricas.

| Formato | Conteúdo e uso | Critério de entrega |
| --- | --- | --- |
| PDF | Relatório individual, auditoria, fechamento executivo | Páginas legíveis, identificação da edição, paginação, evidências e aprovação |
| PPTX | Reunião executiva com resumo, tendência, Pareto, casos, ações e decisões | Texto editável; gráficos/tabelas legíveis; notas com fonte/corte; sem screenshot de página inteira |
| XLSX | Análise tabular com abas de resumo, dados, produção, ações e dicionário | Códigos como texto; moeda/unidade visível; filtros; totais reconciliados |
| CSV | Intercâmbio de dataset explicitamente definido | UTF-8, delimitador/decimal documentados, quoting correto e colunas estáveis |

PPTX executivo inicial: 1) contexto e corte; 2) KPIs e cobertura; 3) evolução/meta; 4) Pareto; 5) casos prioritários; 6) ações e eficácia; 7) auditoria/pendências; 8) decisões solicitadas. Volume excessivo vai para apêndice; paginação automática evita sobreposição. Fotos precisam de legenda, proporção preservada e autorização.

XLSX sugerido: `Resumo`, `Ocorrencias`, `Casos`, `Acoes`, `Producao`, `Dicionario`, `Proveniencia`. Não multiplicar transações por ação/anexo numa aba única. Para datasets acima do limite prático do formato, dividir em arquivos/abas ou fornecer CSV em partes, com manifesto; nunca truncar sem aviso.

CSV: oferecer perfil interoperável (`UTF-8`, vírgula delimitadora, ponto decimal) e, se necessário, perfil Excel pt-BR (`UTF-8` com BOM, ponto e vírgula, vírgula decimal). Identificar o perfil no pedido. Campos textuais controlados por usuário que começam com operadores de fórmula recebem neutralização na exportação destinada à planilha; números legítimos são serializados por tipo, não por heurística que altera sinais. No XLSX, escrever texto explicitamente como texto, sem executar fórmulas vindas de comentários.

Preservar precisão: o valor canônico permanece decimal/string no dataset; arredondamento é parte da definição de apresentação. Não prometer precisão ilimitada das células numéricas da planilha; disponibilizar valor exato como texto quando exceder precisão útil do formato.

Adapters possíveis: renderer HTML→PDF no worker, biblioteca de escrita PPTX e biblioteca de escrita XLSX. Selecionar bibliotecas após prova de conceito com fontes portuguesas/coreanas, fotos reais e tabelas longas. O plano não exige automação do PowerPoint/Excel desktop no servidor nem nova dependência específica sem teste.

Metadados do artefato: edição, snapshot, template, renderer/version, locale, fuso, gerado em, hash, tamanho e classificação de acesso. PDF assinado digitalmente é requisito adicional se o negócio pedir; não chamar hash de assinatura digital ou validade jurídica.

## 9. Auditoria periódica como produto analítico

Congelar população por data de corte, regras e critérios. Amostra deve incluir estratos: críticos, revisões obrigatórias vencidas, dispensas, relatórios publicados, ações declaradas eficazes e casos reabertos. Guardar algoritmo/seed quando seleção aleatória, itens selecionados e motivo de substituição.

Exemplo ilustrativo: examinar 100% dos itens críticos e 10% das dispensas, com mínimo por linha. Esse desenho é operacional e não uma amostra estatística que autoriza extrapolar taxa de não conformidade à fábrica inteira. Relatório informa quantos foram elegíveis, selecionados e examinados, limitações e exclusões.

Dois cortes: “situação no encerramento” permanece fixa; “acompanhamento atual dos achados” continua dinâmico e é identificado como tal. Dashboard da auditoria não pode reescrever retroativamente um parecer porque uma ação foi concluída depois.

## 10. Desempenho e capacidade: medir antes de ampliar

O volume real não foi informado. Trabalhar com envelopes sintéticos de 100 mil, 1 milhão e 10 milhões de ocorrências somente como cenários de benchmark, não como previsão da fábrica. Simular distribuição por linha/data, valores nulos, fotos, correções e concorrência, além da quantidade de linhas.

Metas iniciais propostas para homologação, sujeitas à infraestrutura: listagens de 50 itens e dashboard com cache p95 <= 2 s; transição simples p95 <= 1 s; atualização analítica <= 5 min após confirmação; exportação de 10 mil linhas sem imagens <= 60 s. Definir cenário, usuários simultâneos e hardware antes de considerar o requisito aprovado.

Instrumentar tempo SQL, quantidade de queries, memória do worker, tamanho de payload, profundidade da fila, tempo de publicação, lag da geração e duração dos exports. Executar `EXPLAIN (ANALYZE, BUFFERS)` em ambiente de homologação para consultas representativas; essa opção executa a consulta e deve ser usada conscientemente.

Particionamento por data pode ajudar manutenção/retenção e consultas que eliminam partições, mas traz custos de schema e constraints; avaliar somente quando volume/planos justificarem. Em PostgreSQL, constraints únicas em tabela particionada precisam contemplar a chave de partição, o que afeta referências e desenho de IDs. [Particionamento no PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-partitioning.html).

RLS pode ser defesa adicional para escopo por fábrica, se a equipe dominar contexto de sessão e pooling. Não substitui autorização no serviço, testes de escopo ou contrato público separado. Proprietários e papéis privilegiados têm comportamento especial que precisa ser considerado. [Row security no PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## 11. Critérios de reconciliação

Mesma edição deve exibir o mesmo valor em tela, PDF, PPTX, CSV e XLSX, dentro do arredondamento documentado. A soma de perda por linha mais “não mapeado” deve fechar com o total elegível. A soma de períodos usa numerador/denominador somados, nunca média simples de taxas diárias.

O conjunto de ocorrências distintas fecha com o manifesto; um caso com duas ações não duplica sua perda. Revisar/dispenser um item não muda automaticamente seu valor no dashboard. Fonte corrigida gera outra visão corrente e sinaliza documentos afetados, sem atualizar bytes publicados.
