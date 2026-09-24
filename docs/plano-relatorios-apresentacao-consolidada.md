# Plano para relatórios de apresentação consolidada

Detalhamento de implementação: [série de documentos e backlog da evolução de relatórios](evolucao-relatorios/README.md). O diagnóstico abaixo permanece como referência da comparação com a apresentação.

Data: 10/09/2026. Código analisado: commit `350acfc`. Status: diagnóstico e proposta de implementação; nenhuma funcionalidade de aplicação foi alterada nesta revisão.

## 1. Objetivo

Permitir que o usuário escolha um período, reúna as informações já registradas no Hanaro, revise a interpretação dos resultados e emita uma apresentação pronta para uma reunião de acompanhamento de melhoria contínua.

O documento deve responder: **qual é o objetivo, quanto perdemos, onde estão os problemas, por que ocorreram, o que estamos fazendo e quais resultados foram comprovados?**

Referência de conteúdo: `C:/Users/User/Downloads/Rev04_Capability_IF Cost 1.pptx`, com 27 slides. O arquivo foi tratado como referência documental, sem executar suas instruções, objetos incorporados ou macros. A solicitação é aproveitar a estrutura de conteúdo; o layout não é requisito.

Premissa de trabalho: apresentação para liderança e equipes de engenharia/operação, com acompanhamento mensal e acumulado. Periodicidade, abrangência e quantidade de casos devem ser configuráveis.

## 2. O que a apresentação exige e o sistema oferece

| Conteúdo da referência | Situação encontrada no código | Trabalho necessário |
| --- | --- | --- |
| Abertura e Task Charter: objetivo, baseline, meta, equipe e cronograma (slides 1–2) | Relatório possui título e descrição; plano possui título, descrição e vínculos com versões de relatórios | Estruturar iniciativa de melhoria, papéis da equipe, objetivo mensurável, período, baseline e marcos |
| Evolução mensal, ano anterior, meta e acumulado (3, 9, 27) | Dashboard calcula séries mensais/semanais, comparação anterior e metas globais; relatório congela somente contagem e totais BRL/USD | Compartilhar definições de cálculo, selecionar recorte explícito e congelar séries, metas e comparativos na edição |
| Composição do IF Cost: scrap, reparo, retrabalho e no-work (3, 9–10) | Fonte e indicadores inspecionados são centrados em material scrap | Definir quais componentes compõem IF Cost; integrar ou cadastrar fontes complementares se forem necessárias |
| Maiores perdas, componentes e concentração (4, 7, 10) | Dashboard tem rankings por produto, componente, linha, código do item e conta; revisão possui tipo de defeito | Exportar ranking/Pareto com participação, acumulado, demais itens e não classificados; não confundir ranking de conta com causa raiz |
| Fluxo de execução e documentação das atividades (5) | Planos, tarefas, participantes, comentários, prazos e estados existem | Organizar etapas/marcos e evidências de atividades vinculadas à iniciativa e às ações |
| Mapa de riscos por linha/posto (6) | Há modelos de linha, layout e posto; não foi localizado fluxo operacional de avaliação de riscos | Completar cadastro utilizável, classificação de risco, responsável, medidas e vínculo com ações; começar por tabela |
| Árvore de causas e segmentação 4M (7, 10–11) | Revisão tem texto livre e tipo de defeito; não há campos operacionais estruturados para toda essa classificação | Capturar sintoma, condição, posto, causa, 4M e subcategoria com taxonomia controlada |
| Lista de melhorias e cronograma (8) | Planos e tarefas já funcionam no código, com vínculos a ocorrências e relatórios publicados | Incluir estado das ações na edição, tipo de ação, datas planejadas/reais e implantação por linha |
| Casos de melhoria, 5 porquês, fotos e antes/depois (11–26) | Anexos de revisão são preservados na publicação; modelos de caso/análise/eficácia existem, mas não foi localizado fluxo de uso desses modelos | Completar investigação por caso, seleção de fotos, legenda, comparação temporal e validação de resultado |
| Consolidação executiva de problemas, melhorias e resultados (27) | A prévia lista ocorrências e três totais; não há síntese gerencial estruturada | Criar resumo executivo editável, principais conclusões, pendências e próximos passos |

Não é necessário recriar os 27 slides em cada emissão. O corpo principal deve consolidar a situação; casos adicionais e detalhes podem ir para apêndice.

## 3. Diagnóstico principal

### A base documental já existe

O módulo permite criar relatórios, combinar ocorrências revisadas e relatórios publicados, deduplicar por ocorrência, registrar divergências, publicar versões e gerar CSV, PDF, PPTX e Markdown. Também preserva arquivos de evidência e registra a origem dos dados.

Essa infraestrutura deve ser ampliada. Não há necessidade inicial de substituir o módulo ou criar outro sistema de exportação desconectado.

### O conteúdo exportado ainda é uma lista documental

`exports/document.py` gera pares de título e texto: identificação, resumo financeiro, ocorrências, justificativas e rastreabilidade. `renderers/pptx.py` distribui esses textos em slides. Não monta gráficos, tabelas analíticas, fotografias, cronogramas ou resultados de melhoria.

Mesmo com a opção de evidências habilitada, o documento atual inclui nome, hash, tamanho e identificação do anexo; não incorpora a fotografia no slide. O PDF usa a mesma estrutura textual.

### O universo do relatório é diferente do universo financeiro

Atualmente, as fontes diretas precisam estar ativas e revisadas. Os indicadores publicados somam os itens selecionados, e o período é inferido da menor e maior data desses itens. Isso atende a um dossiê de análises, mas não garante um fechamento de todo o período.

Proposta: distinguir explicitamente **universo dos indicadores** e **casos destacados**. A perda de uma ocorrência contabilizável deve entrar no total mesmo quando sua investigação ainda não foi concluída. A apresentação informa a cobertura de análise, sem esconder o restante.

Também é preciso separar duas formas de consolidação:

- **Fechamento por período:** consulta todas as ocorrências elegíveis do recorte e seleciona casos para explicar o resultado.
- **Dossiê de ocorrências/relatórios:** mantém a composição manual atual e identifica seus totais como pertencentes à seleção.

### A consolidação atual não incorpora a narrativa dos relatórios de origem

Ao combinar relatórios, o código resolve principalmente seus itens congelados, análises alternativas e procedência. Não consolida automaticamente objetivos, conclusões, cronogramas ou ações. A nova composição precisa tratar blocos narrativos e fontes analíticas, além de ocorrências.

### Há recursos fora do módulo e estruturas ainda sem fluxo operacional

Metas e séries estão no dashboard; planos e tarefas estão no módulo de ações. Casos, análises versionadas, produção diária e verificações de eficácia possuem modelos persistentes, mas as buscas em `backend/src` não localizaram serviços operacionais que utilizem esses modelos para completar essas jornadas.

Um estado de tarefa `COMPLETED` também não comprova economia: o comando atual de validação registra conclusão, data e usuário, sem exigir uma medição em `EffectivenessCheck`.

## 4. Jornada proposta para emitir

1. **Definir o relatório:** fechamento gerencial ou dossiê; título, iniciativa, período, fábrica/linhas, moeda, comparação e data de corte.
2. **Conferir a base:** total do universo, fontes atualizadas, revisões pendentes, classificação incompleta, metas disponíveis e cobertura. A seleção deve ter filtros e paginação; hoje os seletores do frontend solicitam apenas os primeiros 100 resultados.
3. **Montar o conteúdo:** o sistema sugere seções, maiores perdas, casos e ações relacionados. O usuário escolhe destaques, organiza a ordem e redige conclusões.
4. **Revisar a apresentação:** prévia por seção com os mesmos números e fontes que serão publicados, fotos legíveis e indicação de pendências específicas.
5. **Publicar e emitir:** congelar a edição, incluindo narrativa, indicadores, metas, ações e evidências, e gerar PPTX/PDF. Alterações posteriores geram nova revisão.

A revisão deve apontar o que falta para determinada afirmação: por exemplo, “sem medição posterior para demonstrar redução”. Dados ausentes não viram zero. Pode-se apresentar “resultado ainda em avaliação” sem bloquear o restante do relatório, desde que a afirmação sem suporte seja retirada.

Uma nova edição poderá reaproveitar a estrutura e os destaques da anterior, atualizando fontes e mostrando diferenças antes da publicação. Reutilização não deve alterar uma edição já publicada.

## 5. Estrutura sugerida da apresentação

| Seção | Pergunta respondida | Origem principal |
| --- | --- | --- |
| Contexto e objetivo | O que estamos tentando melhorar e até quando? | Iniciativa, responsáveis, baseline e meta |
| Resumo executivo | Como estamos e o que exige atenção? | Indicadores calculados + interpretação revisada pelo autor |
| Resultado e tendência | Quanto perdemos e como evoluímos? | Séries, metas e comparação equivalente |
| Principais perdas | Onde concentrar o esforço? | Pareto por componente, linha e defeito |
| Causas prioritárias | Por que esses problemas ocorrem? | Análises estruturadas e cobertura de classificação |
| Plano de melhoria | O que está sendo feito, por quem e para quando? | Ações, responsáveis, prazos, bloqueios e implantação |
| Casos em destaque | O que mudou no processo? | Problema, causa, contramedida e fotos antes/depois |
| Resultados e próximos passos | O que foi medido e o que falta decidir? | Medições de eficácia, conclusões e decisões solicitadas |
| Apêndice | Como verificar os detalhes? | Ocorrências, casos adicionais, metodologia e procedência |

Proposta inicial: corpo executivo de aproximadamente 8–12 slides, variando conforme a quantidade de casos. O modelo deve permitir uma apresentação completa com mais detalhes, sem impor esse tamanho como limite fixo.

Fotos, tabelas e gráficos precisam comunicar evidência. IDs e hashes ficam em notas/apêndice, mantendo a rastreabilidade acessível sem ocupar a narrativa principal.

## 6. Dados que precisam ser capturados na operação

| Grupo | Campos propostos | Onde registrar |
| --- | --- | --- |
| Iniciativa | Objetivo, justificativa, baseline, KPI, meta, início/fim, sponsor, owner, líder, equipe e marcos | Ampliar plano de ação ou entidade de iniciativa ligada a planos; decidir após validar cardinalidade |
| Análise | Sintoma, condição, componente, posto, equipamento, 4M, subcategoria, causa raiz, estado da investigação e sequência de porquês | Revisão/caso; reutilizar `ScrapCase` e `AnalysisVersion` |
| Ação | Tipo imediato/corretivo/preventivo, responsável principal, participantes, causa tratada, início e fim planejados/reais, implantação por linha | Evoluir `ImprovementAction` e relações existentes |
| Evidência | Arquivo, legenda, data, contexto, vínculo e papel: problema/antes/depois/implantação/medição | Ampliar metadados e vínculos da evidência preservada |
| Resultado | Métrica, unidade, janela anterior/posterior, escopo comparável, valores, produção quando pertinente, avaliador, conclusão e limitações | Operacionalizar `EffectivenessCheck` e produção versionada |
| Risco | Linha/posto, perigo ou modo de falha, critério de classificação, nível, responsável, avaliação e medidas | Cadastro de riscos vinculado a postos e ações |
| Narrativa da edição | Mensagem principal, conclusões, destaques, ressalvas, próximos passos e decisões solicitadas | Composição do relatório, congelada em cada versão |

Evitar obrigar o usuário a repetir esses dados na tela de emissão. A emissão reúne o que foi produzido durante a análise e execução. Registros históricos podem permanecer com “não classificado”; migração não deve inventar causas ou medições.

Os cinco porquês são uma sequência de investigação: permitir extensão/encerramento justificado, sem exigir cinco respostas artificiais. Textos legados podem apoiar preenchimento assistido, mas nenhuma classificação inferida deve ser aceita como fato sem revisão.

## 7. Regras para números confiáveis

1. **Definição de custo:** identificar material scrap separadamente do IF Cost completo. Se reparo, retrabalho e no-work não tiverem fonte, informar que a composição está incompleta; não preencher com zero.
2. **Elegibilidade:** congelar a regra de contabilização, inclusive exclusões, estornos, sinal/valor absoluto e itens não classificados. O relatório atual soma valores assinados; o dashboard oferece modos de impacto. Não conectar os dois sem reconciliar a semântica.
3. **Período:** registrar início/fim solicitados, corte efetivo e meses abertos/fechados. A última ocorrência observada não comprova, sozinha, a completude da carga.
4. **Comparação:** comparar janelas equivalentes. Meta anual, meta acumulada até o corte e realizado acumulado são indicadores distintos. Hoje o dashboard soma as metas do ano, mesmo quando o realizado está filtrado; esse comportamento precisa ser tratado antes do reaproveitamento.
5. **Escopo da meta:** a meta atual é global por ano/mês/moeda. Não aplicá-la automaticamente a uma única linha ou componente. Ampliar cadastro ou informar ausência de meta compatível.
6. **Pareto:** usar o mesmo universo do total e apresentar “demais” e “não classificado”. Uma perda ligada a duas ações não pode ser somada duas vezes.
7. **Antes/depois:** armazenar valores, unidade, datas e contexto. Quantidade de componentes descartados não equivale a quantidade de produtos defeituosos. Normalizar por produção somente quando numerador e denominador tiverem escopo compatível.
8. **Ganhos:** separar redução observada, economia estimada, ganho validado e meta futura. Ganhos de manutenção/produtividade, presentes na referência, precisam de métrica própria e não entram automaticamente como redução de scrap.
9. **Zero e ausência:** referência zero implica variação percentual não calculável; medição ausente implica resultado não medido. Meta zero exige regra explícita, sem infinito ou percentual inventado.
10. **Moeda e precisão:** preservar valores decimais, taxa e data de câmbio. Arredondar apenas na apresentação e reconciliar os totais exibidos.

A referência contém campos pendentes de preenchimento e resultados propostos/observados com contextos distintos. Ela orienta quais informações são necessárias; seus percentuais e fórmulas não devem virar regras automáticas do produto.

## 8. Implementação técnica proposta

### Uma composição estruturada e versionada

Evoluir o modelo intermediário de título/texto para blocos semânticos: resumo, indicadores, série temporal, Pareto, análise, tabela de ações, caso de melhoria, evidências e decisões. Cada bloco referencia dados congelados e possui uma finalidade de apresentação.

O snapshot deve preservar: escopo solicitado, corte e cobertura; manifestação das fontes e suas revisões; definição dos indicadores; valores/denominadores; séries e metas; classificações; casos/análises; estado e conteúdo das ações; medições; arquivos e legendas; narrativa e ordem dos blocos.

Não consultar o estado atual das ações ou o dashboard durante a exportação de uma edição antiga. A exportação deve ler apenas a edição congelada e os arquivos que ela referencia.

### Evoluções de contrato e serviço

- Ampliar criação/edição com tipo do relatório, escopo e configuração da composição, preservando controle de concorrência.
- Criar consulta de prontidão e prévia consolidada com totais, cobertura, blocos e pendências.
- Adicionar seleção explícita de casos, ações, evidências e versões dos relatórios de origem. Para composição manual, tornar visíveis as versões escolhidas e mudanças disponíveis.
- Extrair/reutilizar cálculos compartilháveis do dashboard em serviço analítico; não copiar sua resposta dinâmica para o relatório sem tratar semântica, filtro, completude e congelamento.
- Preservar deduplicação/procedência atuais. Para múltiplas classificações, definir atribuição única ou regra de rateio, mantendo o total reconciliado.
- Ampliar a publicação para captura coerente de todas as fontes; renderização continua no worker após finalizar a captura.
- Evoluir schema de conteúdo e template para uma nova versão. Hoje APIs e serviços aceitam somente template `1`; manter leitura/exportação compatível com edições antigas.
- Incluir versão do conteúdo/renderizador e opções relevantes na identidade da exportação, evitando reutilizar artefato incompatível.

### Renderização

PPTX deve conter títulos e textos editáveis, gráficos/tabelas legíveis, fotos incorporadas com legendas, casos e cronogramas. PDF deve usar os mesmos dados e conclusões. CSV continua sendo saída de dados detalhados; XLSX é uma ampliação posterior, não uma dependência para resolver esta solicitação.

A escolha ou troca de biblioteca deve ocorrer após uma prova de capacidade com os dados necessários. O principal trabalho é enriquecer o documento de origem e conectar dados; trocar o renderizador isoladamente não preenche as informações ausentes.

## 9. Entregas e dependências

| Etapa | Entrega concreta | Dependência e critério de aceite |
| --- | --- | --- |
| 1 — Contrato de conteúdo e cálculos | Definir fechamento/dossiê, escopo, corte, métrica, regras de meta, blocos e dataset de referência | Exemplos reconciliados para período completo, parcial, zero e dados ausentes; definição explícita de material scrap/IF Cost |
| 2 — Primeiro fechamento apresentável | Seleção por período, resumo editável, tendência, meta compatível, Pareto disponível, ações vinculadas, casos com texto revisado e fotos; snapshot ampliado e PPTX/PDF | Emitir uma reunião de acompanhamento sem copiar gráficos, fotos ou ações manualmente para o PowerPoint; causas/eficácia ainda não estruturadas aparecem com limitação explícita |
| 3 — Causas e investigação | Captura estruturada, casos agrupados, 4M, porquês e relação causa–ação | Gerar segmentação e ficha de caso sem interpretar texto livre na emissão; mostrar cobertura e não classificados |
| 4 — Resultados comprováveis | Janelas antes/depois, medições, produção compatível quando necessária e validação de eficácia | Mostrar ganho com unidade, período, fonte e responsável; ação concluída sem medição continua “eficácia não avaliada” |
| 5 — Charter, riscos e expansão | Equipe/papéis, marcos, riscos por posto, implantação por linha e fontes adicionais de IF Cost | Apresentar programa de melhoria completo, incluindo riscos e composição de custos suportada por fontes |
| 6 — Reutilização e operação | Nova edição a partir da anterior, comparação de mudanças, perfis de apresentação e validação com volume real | Fechamento recorrente com pouca digitação, versões antigas preservadas e arquivos consistentes |

As etapas 1 e 2 são a prioridade. A etapa 2 é um incremento vertical utilizável, com dados reais disponíveis, e não exige esperar pelo mapa de riscos ou por todo o domínio de eficácia. As etapas 3–5 completam a equivalência de conteúdo com a referência.

Não foi estimado prazo calendário: equipe, disponibilidade dos dados históricos e necessidade de novas fontes ainda não foram verificadas. Estimar cada etapa após decompor seus contratos e validar o conjunto de dados de homologação.

## 10. Validação da implementação futura

- **Reconciliação:** mesmo universo, meta e arredondamento em prévia, edição, PPTX e PDF; Pareto fecha com total.
- **Abrangência:** ocorrências sem revisão entram no fechamento financeiro quando elegíveis; seleção de casos não altera esse total.
- **Consolidação:** duas fontes com a mesma ocorrência não duplicam custo; análises divergentes permanecem visíveis; conclusões de origem têm procedência.
- **Histórico:** corrigir meta, ocorrência, análise ou ação não altera o conteúdo da edição anterior.
- **Evidências:** fotografias aparecem no arquivo, com legenda e proporção; exportação antiga usa a evidência preservada mesmo após alteração da revisão operacional.
- **Casos:** duas ações no mesmo caso não duplicam perdas ou economia; melhoria só recebe resultado confirmado com medição elegível.
- **Janelas:** mês incompleto, meta fora do escopo, ano anterior ausente, moeda e denominador incompatíveis produzem respostas explícitas.
- **Fluxo completo:** selecionar um período, revisar pendências, montar conteúdo, publicar e abrir o PPTX em software compatível. Conferir gráficos, tabelas extensas, fotos, textos longos e caracteres PT/EN/KO.
- **Volume e operação:** seleção além de 100 registros, ordenação estável, exportação em worker, retomada de falha e acesso privado aos arquivos.

Os testes existentes incluem publicação, composição e geração de arquivos, mas a verificação de PPTX inspecionada confirma apenas o prefixo ZIP do arquivo. Acrescentar testes de conteúdo e inspeção visual dos artefatos gerados com casos representativos.

## 11. Pontos a confirmar durante a implementação

As decisões abaixo não impedem a execução da primeira etapa; precisam ser fechadas antes de ativar as respectivas regras:

- O indicador prioritário é material scrap ou a composição completa de IF Cost? Quais fontes fornecem os demais componentes?
- O acompanhamento principal é por iniciativa, fábrica, área ou linha? Uma iniciativa pode reunir vários planos?
- Qual regra de custo, fechamento, meta acumulada e câmbio deve aparecer na reunião?
- Quem confirma causa raiz, medição de eficácia e publicação? A validação de tarefa existente não define automaticamente essas autoridades.
- Quais resultados históricos têm dados verificáveis e quais são somente metas ou estimativas?

## 12. Evidências da revisão e limites

Arquivos principais inspecionados:

- `frontend/src/app/pages/reports/reports-page.html`: composição, prévia e opções de emissão.
- `frontend/src/app/pages/reports/reports.models.ts` e `reports.service.ts`: contratos, fontes e paginação dos seletores.
- `backend/src/modules/governance/service.py`: elegibilidade, composição, deduplicação, escopo e publicação.
- `backend/src/modules/governance/exports/document.py`: conteúdo intermediário atual.
- `backend/src/modules/governance/exports/renderers/pptx.py` e `pdf.py`: geração textual dos artefatos.
- `backend/src/modules/governance/exports/service.py` e `evidence.py`: processamento, identidade dos exports e preservação de anexos.
- `backend/src/modules/material_scrap/dashboard_service.py`: séries, rankings, metas e comparação.
- `backend/src/modules/material_scrap/models.py`: revisão, anexo, atributos da fonte e metas globais.
- `backend/src/modules/governance/models.py` e `actions.py`: estruturas de governança e fluxo de planos/tarefas.
- `backend/tests/unit/modules/governance/test_reports.py`: cobertura existente de publicação/exportação.
- `docs/evolucao-governanca/`: plano anterior, usado como contexto e confrontado com o código atual; proposta escrita não foi tratada como funcionalidade pronta.

Método: leitura estática dos fluxos e extração do conteúdo textual/tabelas dos 27 slides. Não houve renderização visual da apresentação, inspeção dos conteúdos internos de todos os objetos Excel incorporados, consulta ao banco de produção ou execução de testes. Portanto, a análise de slides cobre o conteúdo extraído, sem validar números em imagens ou qualidade visual.

A consulta obrigatória ao Graphify foi tentada; o Python do host não estava disponível, inclusive fora do sandbox. Foi possível consultar diretamente o JSON do grafo com Node, mas ele ainda referencia caminhos antigos de exportação; as conclusões foram confirmadas nos arquivos atuais. O Docker também estava indisponível, sem daemon acessível, impedindo validação executável local. Nenhum código foi modificado; não se aplica atualização AST do grafo nesta entrega documental.
