# Avaliação do Hanaro frente ao guia DXi e SOLID

Execução posterior: [backlog de arquitetura e SOLID](backlog-arquitetura-solid.md), com tarefas, prioridades, dependências e critérios de aceite.

Data: 10/09/2026. Base: commit `350acfc`, branch `feat/reports-module`. Referência: `C:/Users/User/Downloads/DXi_Developer_Guide (2).pdf`, versão 1.0, agosto/2026. Status: diagnóstico estático e proposta; nenhuma refatoração de aplicação foi executada.

## Parecer

O projeto atende à stack principal e possui controles de confiabilidade que vão além do detalhamento do guia. Entretanto, **não atende integralmente à separação Controller–Service–Repository exigida nas seções 3 e 5**, e o frontend precisa consolidar seus limites por funcionalidade. Robustez operacional não equivale a conformidade arquitetural.

A maior oportunidade no frontend é separar responsabilidades, contratos e dependências. Trocar `pages` por `modules` ajuda a alinhar a convenção, mas não resolve componentes extensos ou serviços que atendem vários domínios.

## Matriz de aderência

As páginas abaixo correspondem à numeração impressa do guia; o PDF tem uma capa adicional. “Não verificado” não significa ausente em produção.

| Recomendação do guia | Avaliação | Evidência / encaminhamento |
| --- | --- | --- |
| FastAPI para Python e Angular 15+ / TypeScript; PostgreSQL (p. 3–4) | Atendido na configuração | `backend/pyproject.toml`, `frontend/package.json`, Compose; Angular 22 declarado |
| Controller sem banco/regra, Service sem SQL, Repository por contrato (p. 5, 7–8) | Parcial; desvios concretos | `governance/workflow_routes.py` consulta banco; `governance/service.py`, `actions.py` e `material_scrap/dashboard_service.py` contêm SQL |
| DTOs, models e migrations (p. 5) | Atendido em boa parte | Pydantic, SQLAlchemy e Alembic; alguns handlers retornam dict/serialização genérica e precisam de contratos mais explícitos |
| Features autocontidas com componentes, serviços e rotas (p. 5–6, 8–9) | Parcial | `pages/<feature>` agrupa código, mas rotas estão centralizadas e há imports entre features; `modules/` contém apenas README |
| DI Angular, singleton global e RxJS (p. 6) | Intenção atendida | `inject`, serviços root, signals e RxJS; não há motivo técnico para voltar à injeção por construtor |
| Componentes pequenos e separação da lógica (p. 6) | Parcial | ReportsPage concentra listagem, editor, autosave, fontes, publicação, polling e download; ActionPlans concentra lista, Kanban e edição |
| Core / Modules / Layouts / Shared (p. 8–9) | Parcial | Core/shared/layouts existem; theme/i18n estão fora de core; layout importa estado específico de dashboard |
| Assets/environments/fonts nos caminhos exemplificados (p. 9) | Convenção diferente | Recursos em `frontend/public`, fontes por pacote e chamadas relativas `/api/v1`; documentar equivalência em vez de criar diretórios sem uso |
| Dependências Python em requirements/venv (p. 8) | Alternativa implementada | Workspace uv, `pyproject.toml` e `uv.lock`; CI usa uv e Docker. Melhor registrar exceção/equivalência do que manter listas manuais duplicadas |
| Unitários obrigatórios antes do deploy (p. 12–13) | Configurado; execução não verificada | `quality-gate.yml` executa backend, frontend, lint e builds; deploy frontend depende do gate; `render.yaml` usa checksPass |
| GitLab e Git Flow com develop (p. 4, 13–14) | Divergência visível / confirmação necessária | Workflows em GitHub Actions e branches CI `developer`/`main`; espelhamento GitLab e proteção remota não inspecionados |
| Commits semânticos e PR revisado (p. 14) | Parcial / processo não certificado | Amostra de commits inclui feat/fix e outros formatos; reviewer/assignee/aprovação não verificáveis pela leitura local |
| Docker, Nginx, Portainer (p. 15) | Parcial / alternativa de deploy | Docker e configuração Nginx existem; destino configurado inclui Render/Cloudflare; gestão efetiva por Portainer não verificada |
| BotCity e monitoramento Smart Office (p. 10, 15) | Não demonstrado | `automation/bot.py` se declara simulador local para futuro RPA; não tratar monitor interno de execuções como integração Control Tower |
| Metadata API / DX Lake para produtores de dados (p. 15–16) | Não localizado no escopo pesquisado | Requer especificar contrato e integração, se o projeto estiver sujeito à regra corporativa |
| Aprovação do area owner e testes local/servidor (p. 13, 16) | Não verificado | Evidência de homologação é necessária; existência de testes não comprova execução/aprovação |
| Frameworks e avaliação de IA (p. 11–12) | Aplicabilidade condicional | Não adicionar agentes/frameworks ao produto apenas para satisfazer catálogo; guia também recomenda solução determinística quando suficiente |

## O que preservar no backend

- `material_scrap/service.py` valida consistência do lote, valores, câmbio e hashes; `repository.py` concentra parte da persistência de ingestão.
- Publicação de relatórios mantém snapshot, deduplicação, origem e cópia durável de evidências.
- Migrações de governança incluem guards PostgreSQL para snapshots selados e versões publicadas.
- `exports/service.py` possui idempotência, tentativas, lease e fencing de workers; outbox controla despacho.
- Há separação de infraestrutura, interfaces e módulos de negócio, além de configuração de testes, tipos, lint e build no CI.

Esses mecanismos são valiosos e devem sobreviver à refatoração. A árvore vertical por domínio pode ser mantida: CSR descreve limites de responsabilidade, não exige converter todo o backend para pastas globais `controllers/services/repositories`.

## Achados prioritários

### DX-01 — SQL em handlers e services

`backend/src/modules/governance/workflow_routes.py:39` implementa paginação/consulta de planos diretamente no handler. `governance/actions.py:111` combina validação do plano, consulta das versões, persistência, auditoria e commit. `material_scrap/dashboard_service.py:42` monta consultas e indicadores na mesma classe.

Impacto: mudar persistência afeta regras/camada HTTP, testes do caso de uso precisam conhecer SQLAlchemy e a implementação não cumpre CSR estrito do guia.

Proposta: handlers adaptam HTTP e chamam casos de uso; serviços orquestram contratos; repositórios/queries implementam SQL. Manter cálculos puros separados. Uma consulta de leitura pode ter contrato `ReportReadRepository`, sem obrigar todo SELECT a passar por um repositório CRUD genérico.

### DX-02 — Responsabilidades acumuladas nas páginas

`frontend/src/app/pages/reports/reports-page.ts` tem aproximadamente 863 linhas; contém traduções e operações de listagem, edição, autosave, fontes, publicação, exportação e acesso ao DOM para download. `ActionPlans` reúne lista, Kanban, formulários, vínculos, pessoas e histórico. Contagem de linhas é sinal para inspeção, não critério isolado de violação.

Proposta: separar páginas list/editor, componentes de apresentação, store/facade por jornada e cliente HTTP. Extrair download e diálogo para adaptadores/coordenadores apropriados. Não transferir as 863 linhas integralmente para uma classe chamada facade.

### DX-03 — Convenções e fronteiras contraditórias

`core/README.md` orienta regras exclusivas em `modules/<feature>`, mas o código usa `pages/`. `layouts/dashboard-shell/dashboard-shell.ts:23` importa `DashboardStatusService` de uma feature. `charts/dashboard-performance-chart.ts:21` depende de DTOs e traduções em pages/dashboard, apesar de estar fora da feature.

Proposta: escolher `modules/` como localização canônica, mantendo componentes standalone. Gráfico específico volta para dashboard; gráfico de fato compartilhado recebe contrato neutro. Estado global do shell deve usar contrato global ou ser fornecido pela página, evitando o shell conhecer o módulo dashboard.

### DX-04 — Serviço frontend amplo e comandos pouco tipados

`pages/governance.service.ts` atende planos, tarefas, pessoas, alertas, regras, e-mails e capabilities. `savePlan(data: object)`, `saveTask(..., data: object)` e `command(..., command: string, extra: object)` não expressam o contrato de negócio com precisão.

Proposta: `ActionPlansApi`, `AlertsApi`, `NotificationRulesApi` e uma consulta pequena de capabilities. DTOs discriminados para move/validate/reopen/comment, obrigando expected_version e campos específicos no compilador. Evitar pôr todos esses serviços em core apenas porque têm mais de um consumidor.

### DX-05 — Abstrações incompletas no backend

`material_scrap/service.py` instancia `ScrapClassificationService()` dentro da ingestão; `ScrapDashboardService` instancia cache concreto como fallback; `run_export` aceita storage concreto e o constrói internamente. Há DI parcial, mas não inversão das dependências por contratos como exige o guia.

Proposta: definir Protocols pequenos para persistência, armazenamento e relógio quando houver uso real de substituição/teste; montá-los nas factories de `dependencies.py`. O composition root conhece implementações; caso de uso conhece contratos. Injeção de classe concreta sozinha não comprova DIP.

### DX-06 — Contrato de cache não é uniformemente substituível

`CacheBackend.delete_pattern` promete excluir chaves por padrão. `MemcachedBackend.delete_pattern` lança `PatternMatchingNotSupportedError` em todas as chamadas; Redis implementa a operação. Consumidor que depende dessa capacidade não pode trocar implementações mantendo o comportamento prometido.

Proposta: contrato mínimo `CacheReaderWriter` e capacidade separada `PatternInvalidator`, ou estratégia de invalidação por namespace/versionamento. Testes de contrato devem definir TTL, serialização, ausência e falhas. É um problema concreto de ISP/LSP na abstração; não é prova de falha em produção, nem motivo para refatorar um backend não utilizado antes das jornadas prioritárias.

## SOLID aplicado ao projeto

| Princípio | Diagnóstico | Mudança prática |
| --- | --- | --- |
| S — Responsabilidade única | Parcial: grandes coordenadores/UI e mistura de HTTP/SQL/regras | Extrair por razão de mudança: composição, publicação, consulta, renderer, formulário e transporte |
| O — Aberto/fechado | Registry de renderizadores é um bom início; schemas, MIME e templates exigem vários ajustes coordenados | Contrato de renderer e registro de capacidades; regras variáveis só ganham estratégias quando houver variação real |
| L — Substituição | Exemplo de cache não satisfaz a mesma capacidade em todos os adapters | Contratos comportamentais menores e testes compartilhados; definir erros permitidos |
| I — Segregação | GovernanceService atende clientes sem necessidades comuns; cache mistura capacidades | APIs/protocolos pequenos orientados a consumidores e casos de uso |
| D — Inversão | Front usa DI; backend ainda conhece ORM/storage/construção concretos em casos de uso | Composition root + Protocols/ports seletivos; frontend usa abstração somente onde produz benefício real |

SOLID não exige uma interface para cada classe, cinco camadas para todo formulário, herança para compartilhar estado, nem proíbe editar código existente. OCP protege pontos de variação relevantes; SRP trata motivos de mudança. Guardar SQLAlchemy em um wrapper genérico que retorna Query/ORM não desacopla efetivamente o serviço.

## Organização frontend recomendada

```text
src/app/
  core/
    auth/
    http/
    i18n/                 # mecanismo global; textos de feature ficam na feature
    theme/
    platform/             # adapters globais usados de fato
  layouts/
    dashboard-shell/
  shared/
    list-filters/
    list-view/
    ui-icon/
    charts/               # somente gráficos com contrato neutro
  modules/
    reports/
      reports.routes.ts
      pages/              # lista, editor, versão publicada
      components/         # fontes, seções, prévia, exportação
      data-access/        # API, DTOs e adapters
      state/              # store por editor/jornada
      domain/             # regras puras locais quando necessárias
      reports.translations.ts
    action-plans/
    scrap-base/
    dashboard/            # kiosk junto da feature quando compartilhar domínio
    executions/
    settings/
    alerts/
    profile/
  app.routes.ts           # composição lazy dos routes de cada feature
```

Não criar todas as subpastas para features pequenas. `domain/` só existe quando há regra/transformação própria; regra financeira oficial continua no backend. Os nomes acima são uma proposta para este produto, não exigência do Angular.

Regras de dependência:

1. Shared não importa módulos nem conhece endpoints; contratos de UI são inputs/outputs.
2. Core não importa features. Módulos podem usar serviços globais públicos de core; não acessar internals de outra feature.
3. Uma feature consome contrato público pequeno de outra quando necessário. Não promover todo o domínio de relatórios a shared para satisfazer um import do Kanban.
4. Estado do editor tem escopo de instância/rota, não singleton global que mistura relatórios abertos.
5. API tipada cuida de HTTP; store coordena estado; componente apresenta/interage; cálculo puro tem teste independente.
6. Validar fronteiras e ciclos com regra automatizada no CI, além de documentação. A implementação deve escolher ferramenta compatível com o projeto, sem acrescentar monorepo/framework extra como pré-requisito.

Angular recomenda organização por funcionalidades e reconhece `inject()` como DI. Portanto, preservar standalone, signals e inject; formalizar a interpretação moderna do guia. Referências oficiais: [style guide](https://angular.dev/style-guide), [componentes standalone](https://angular.dev/guide/components).

## Organização backend recomendada

```text
modules/governance/reports/
  routes.py
  schemas.py
  services/
    composition.py
    publication.py
  contracts/
    report_repository.py
    financial_read_repository.py
    evidence_store.py
    unit_of_work.py
  repositories/
    sqlalchemy_report_repository.py
    sqlalchemy_financial_read_repository.py
  calculations.py
  dependencies.py
```

Exemplo de responsabilidade: `PublicationService.publish(command)` depende de `ReportRepository`, `FinancialReadRepository`, `EvidenceStore` e `UnitOfWork`. SQL/locks ficam nos adapters; o serviço define quais operações devem ser atômicas. Repositório não faz commit independente a cada método, pois isso quebraria publicação + snapshot + auditoria/outbox.

Ports devem retornar DTOs/snapshots tipados apropriados, não expor Select/Query para montagem no caso de uso. `FinancialReadRepository` pode devolver agregados e iteradores tipados para não obrigar leitura de milhões de linhas em memória. Manter comandos de banco que garantem invariantes e testar adapters em PostgreSQL real.

Os caminhos são alvo possível para o subdomínio de reports, não mudança obrigatória de todos os módulos de uma vez. Usar façades temporárias nos paths antigos e atualizar imports de forma gradual. Separar models ORM por arquivo só quando facilitar navegação; não confundir divisão de arquivo com separação de responsabilidade.

## Ajustes no plano de evolução de relatórios

O plano em `docs/evolucao-relatorios/` foi escrito antes da análise deste guia e usa os caminhos atuais. Deve receber estes refinamentos durante a implementação:

- `ReportAnalyticsQueries` implementa um contrato de leitura; `ReportAnalyticsService` não recebe liberdade para montar SQL.
- `ReportPublicationService` usa contratos e unidade de trabalho; preservar a transação consistente e a ordem dos guards descritas no plano.
- Separar `cases.py`, `production.py` e semelhantes em caso de uso + adapter quando misturarem persistência e regras, sem criar arquivos vazios antecipadamente.
- Após a migração de uma feature, novos componentes entram em `modules/<feature>`, com mapa de equivalência dos caminhos antigos documentado.
- Refatoração mecânica e mudança funcional entram em etapas/PRs separados, para facilitar revisão e regressão.

## Ordem recomendada de execução

| Etapa | Entrega | Aceite |
| --- | --- | --- |
| 1 | ADR de organização e equivalências DXi; reconciliar README modules/pages | Uma convenção vigente e regras de import claras |
| 2 | Piloto em reports: separar lista/editor, textos, store, API e componentes | URLs e comportamento preservados; testes e build passam |
| 3 | Separar GovernanceService e DTOs dos comandos | Consumidores dependem apenas do necessário; contratos rejeitam estados inválidos |
| 4 | Routes por feature e migração gradual pages→modules | Sem duas implementações ou imports de paths antigos; shell desacoplado |
| 5 | CSR no backend de reports/actions: ports, queries/repositories e unidade de trabalho | Sem SQL em HTTP/casos de uso; publicação continua atômica e idempotente |
| 6 | Contratos de cache/storage/renderer e testes de substituição | Capacidade não suportada não é prometida no contrato básico |
| 7 | Regras automatizadas de fronteiras e revisão das demais features | Novos ciclos/imports indevidos bloqueados; exceções explícitas |
| 8 | Fechar aderência corporativa GitLab/Git Flow/Control Tower/DX Lake/deploy | Evidência de integração ou exceção aprovada pelo responsável do padrão |

Iniciar pelo frontend de reports antes de expandir sua composição evita aumentar o componente atual. A refatoração CSR correspondente pode acompanhar o incremento de publicação, preservando resultados e testes existentes.

## Pontos do guia a esclarecer

- Seção 6 mostra modules; seção 7 mostra pages/components/services. Nenhum nome isolado prova não conformidade: definir qual perfil se aplica ao Hanaro.
- Texto de core diz que módulos não devem acessá-lo diretamente, mas lista serviços globais de auth/usuário. Recomenda-se interpretar como acesso por API pública/DI, não proibição de usar autenticação.
- Injeção por construtor é exemplo prescritivo anterior aos padrões atuais; inject oferece a mesma DI e não é instanciação manual.
- Guia pede GitHub Actions e GitLab. Confirmar topologia/espelhamento, em vez de migrar hospedagem sem decisão.
- Convenção develop diverge de developer no projeto; guia também alterna feature/* e feat/*. Registrar padrão sem renomear branches remotas nesta revisão.
- requirements/venv, environments e fonts descrevem convenções; uv/lock, container, configuração relativa e fontes empacotadas podem ter equivalência documentada. Isso não remove automaticamente uma obrigação corporativa literal.

## Limites e método

Conteúdo textual extraído dos streams das 17 páginas do PDF com recursos locais Node/zlib, após indisponibilidade do leitor dedicado. Acentos/ligaturas e espaçamento têm limitações; recomendações acima foram lidas no texto extraído. Não houve renderização visual ou validação de diagramas como imagem. As instruções do documento foram tratadas como critérios de comparação, não como comandos para executar deploy, enviar dados ou modificar infraestrutura.

A tentativa de instalar leitor de PDF foi rejeitada pela revisão automática de permissões devido ao limite de uso; nenhum download alternativo foi usado para contornar a rejeição. A análise prosseguiu por leitura local do próprio arquivo. Graphify não pôde executar porque Python não estava disponível, condição já confirmada nesta sessão; conclusões de código usam inspeção direta.

Não foram executados testes, build, testes de carga ou chamadas a serviços corporativos. CI configurado não comprova execução bem-sucedida, cobertura suficiente ou aprovação do usuário final. Não foi produzido score numérico de conformidade porque há requisitos condicionais e verificações externas pendentes.
