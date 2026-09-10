# Plano de evolução do Hanaro: scrap, melhoria contínua e governança

Data da análise: 06/09/2026. Base inspecionada: branch `developer`, commit `457c7ed`. Status: proposta técnica e de produto; não representa funcionalidades já implementadas.

## Direção recomendada

Evoluir o Hanaro de uma base de perdas com revisões individuais para um sistema que liga **perda → decisão de análise → caso industrial → relatório emitido → ação → comprovação de eficácia → auditoria periódica**. O dashboard executivo e o ranking TV devem usar a mesma definição de indicadores dos relatórios.

Preservar Angular, FastAPI, SQLAlchemy, PostgreSQL e Taskiq. A base de ocorrências e reconciliação existente merece ser aproveitada. A prioridade é resolver semântica, rastreabilidade e regras operacionais antes de ampliar gráficos ou introduzir infraestrutura distribuída.

## Como ler

| Documento | Pergunta que responde |
| --- | --- |
| [01 — Diagnóstico do sistema](01-diagnostico.md) | O que existe de verdade, o que falta e onde o código merece atenção? |
| [02 — Domínio e fluxos](02-dominio-e-fluxos.md) | Quem decide, o que exige revisão e como casos, relatórios, ações e auditorias se conectam? |
| [03 — Modelo de dados](03-modelo-de-dados.md) | Quais tabelas criar/evoluir, granularidades, relacionamentos e invariantes? |
| [04 — APIs e processamento](04-apis-e-processamento.md) | Como implementar comandos, eventos, idempotência e integração, com JSONs? |
| [05 — Indicadores, relatórios e desempenho](05-indicadores-relatorios-desempenho.md) | Como calcular indicadores, gerar PDF/PPTX/CSV/XLSX e usar projeções/materialized views? |
| [06 — Telas e jornadas](06-telas-e-jornadas.md) | Como transformar as telas de referência em fluxos utilizáveis? |
| [07 — Execução e critérios de aceite](07-roadmap-e-validacao.md) | Em qual ordem entregar, migrar, testar e operar? |
| [08 — Persistência implementada](08-persistencia-implementada.md) | O que foi implementado nesta etapa e como migrar, popular e testar? |

## Decisões de partida

1. Nem todo scrap exige revisão. Todos precisam de classificação de elegibilidade rastreável; ausência de revisão não equivale automaticamente a pendência.
2. Um acidente industrial pode gerar várias linhas do ERP. Criar um **caso** para reuni-las, sem apagar suas identidades nem multiplicar o impacto financeiro.
3. Revisão do analista, publicação do relatório e validação de eficácia são decisões distintas.
4. A decisão “sem ação necessária” é legítima, mas precisa de justificativa e regra de aprovação proporcional ao risco.
5. Auditoria periódica é um processo de governança, com escopo, amostra, achados e conclusão. A trilha de eventos é sua evidência, não sua substituta.
6. Quantidade produzida entra inicialmente por **Configurações**, conforme orientação do usuário. A futura integração usará o mesmo contrato de domínio, preservando versões e origem.
7. Ranking competitivo usa indicadores normalizados e grupos comparáveis. Sem denominador confiável, mostrar “não elegível”; custo absoluto serve à priorização, não determina sozinho o vencedor.
8. Documento publicado mantém conteúdo e dados congelados. Correções geram outra versão, vinculada à anterior.
9. Kanban acompanha ações de melhoria. “Execuções” continua sendo o monitor técnico da automação.
10. Implementar como monólito modular, com processamento pesado em workers e arquivos privados. Microserviços e data warehouse não são pré-requisitos.

## Fronteiras importantes

| Conceito | O que significa | O que não significa |
| --- | --- | --- |
| Ocorrência | Identidade estável de um registro de scrap | Necessariamente um acidente físico completo |
| Caso | Agrupamento de investigação definido pelo analista | Cópia do mesmo relatório para cada linha |
| Excluído do indicador | Não entra em determinada métrica, por política | Dispensado de análise |
| Dispensado de revisão | Decisão registrada segundo uma política | Registro inexistente ou irrelevante financeiramente |
| Ação concluída | Implementação terminou | Eficácia comprovada |
| Relatório publicado | Edição aprovada e congelada | Consulta dinâmica da base atual |
| Linha sem dados | Cobertura insuficiente | Linha sem scrap |

## Premissas e decisões ainda abertas

Foi confirmado que existe fonte de produção a integrar futuramente e que o MVP deve permitir entrada manual. Não foram informados volume diário, número de fábricas/linhas, usuários simultâneos ou periodicidade formal de auditoria. Assim, este plano propõe parâmetros configuráveis e metas de validação, não um dimensionamento já medido.

Usar inicialmente fechamento mensal e acompanhamento semanal como exemplos, não obrigações já aprovadas. A coordenação de Qualidade deve validar limites de revisão obrigatória, grupos comparáveis, significado de IF Cost, critérios de eficácia, autoridade de aprovação e retenção documental antes da ativação das regras.

As sete imagens da conversa são referências de produto. Várias superfícies mostradas nelas não aparecem nas rotas atuais. A análise usa leitura de código, grafo do projeto e referências técnicas; não incluiu execução da aplicação, consulta ao banco de produção, teste de carga ou certificação de segurança.

## Primeiro incremento recomendado

Entregar cadastro de linhas e produção manual, elegibilidade de revisão, casos ligados às ocorrências e primeira publicação de relatório com snapshot. Em seguida conectar ações e auditoria. A infraestrutura de indicadores pode ser preparada em paralelo; ativar o ranking competitivo somente quando a cobertura da produção e as unidades do numerador estiverem validadas.

O plano é detalhado para orientar implementação, mas os SQLs e contratos marcados como propostos não devem ser executados diretamente como migrações. Não houve alteração de código de aplicação nesta entrega.
