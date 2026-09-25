# Plano de transição para a arquitetura DXi

Data: 25/09/2026. Status: estrutura principal de pastas concluída; a extração de responsabilidades de `scrap-base` permanece planejada na etapa 4. A renomeação da raiz `frontend/` para `client/` é opcional.

### Implementação realizada em 25/09/2026

- `pages/{login,users,dashboard}` foi consolidado em `modules/{auth,users,dashboard}`; os caminhos públicos das rotas e os guards foram preservados.
- O estado do cabeçalho passou para `core/shell/shell-status.service.ts`; o layout deixou de importar dashboard.
- `DashboardStore` mantém estado, efeitos e proteção contra respostas antigas. `DashboardDataService` concentra HTTP, parâmetros da consulta, DTOs e conversão dos dados.
- `ReportExportCoordinator` consome `BROWSER_DOWNLOAD`; `app.config.ts` fornece o adapter concreto no injector raiz.
- A exceção de `modules/reports` foi corrigida no `.gitignore` para permitir o versionamento de novos arquivos dessa feature.

Validação da primeira entrega: `npm run build`, `npm run build:cloudflare` e `npm test -- --watch=false` em `frontend/` (45 arquivos, 166 testes).

### Continuação da migração de pastas

- `app/i18n` e serviços de `theme` foram movidos para `core/`; a configuração de marca foi movida para `core/config/`.
- Ícones, componentes de listas/filtros e tokens de tema foram movidos para `shared/components/` e `shared/styles/`.
- Os gráficos passaram a `modules/dashboard/charts/`. O layout passou a `layouts/main-layout/` e o formulário de login a `modules/auth/`.
- Alerts e action-plans foram agrupados em `modules/governance/`, junto de seus serviços, modelos e textos. Reports consome a API pública de governance.
- `settings` passou a consumir `DefectTypesService` pela API pública de scrap-base. As operações de tipos de defeito saíram de `ScrapReviewService`.
- Logos foram movidos para `src/assets/` e copiados pelo build nas URLs antigas; favicon e inicialização do tema permanecem em `public/`.
- `src/environments/` contém a URL pública da API por build. Os serviços Angular usam essa configuração; os builds de produção e Cloudflare selecionam `environment.prod.ts`.
- `npm run check:architecture` valida imports entre `core`, `modules`, `layouts` e `shared`. O layout acessa o formulário de auth por sua API pública.
- `modules/reports/` foi organizado por catálogo, edição, fontes, prévia, publicação, exportação e fechamento de período; as rotas da feature estão em `reports.routes.ts`.
- O lookup de versões usado por planos de ação pertence a governance. A API pública de reports expõe catálogo e publicação, sem exportar detalhes de implementação.

Validação anterior da migração: `npm run build`, `npm run build:cloudflare`, `npm test -- --watch=false` (46 arquivos, 166 testes), `npm run format:check` e `npm run check:architecture`. Nesta continuação, foram executados novamente `npm run build`, `npm run format:check` e `npm run check:architecture`; a suíte de testes não foi repetida.

`fonts/` não foi criado: a fonte usada vem de `@fontsource-variable/fustat`, sem arquivo local a duplicar. O nome `frontend/` foi mantido porque a arquitetura interna já corresponde à seção 6 e renomear a raiz exigiria alterar deploy e CI.

## 1. Decisão de arquitetura

Adotar a estrutura da seção 6 do guia DXi como padrão do frontend: `core/`, `modules/`, `layouts/` e `shared/`. Organizar primeiro por funcionalidade e subdividir somente quando a complexidade justificar.

A seção 7 apresenta uma alternativa simplificada com `components/`, `pages/`, `services/` e `utils/` na raiz. Não combinar esses dois modelos como estruturas permanentes. No Hanaro, consolidar `pages/` dentro de `modules/` é o caminho mais curto, pois boa parte das funcionalidades já está modularizada.

O projeto declara Angular `^22.1.0` em `frontend/package.json`. “6.1” é a numeração da seção do documento, não uma versão do Angular. Manter componentes standalone e rotas lazy; `modules/` representa módulos funcionais e não exige criar classes `NgModule`. A documentação oficial recomenda standalone para código novo: [Angular NgModules](https://angular.dev/guide/ngmodules/overview).

Manter `frontend/` e `backend/` inicialmente. `client/` e `server/` são equivalentes organizacionais, mas renomeá-los não melhora SOLID. Se for necessária correspondência literal ao guia, realizar essa renomeação em uma entrega final independente, atualizando Docker, CI, deploy, scripts e documentação.

## 2. Diagnóstico inicial, antes desta implementação

O grafo foi consultado para orientação e as conclusões abaixo foram verificadas nos arquivos anteriores à implementação registrada acima. As linhas relativas a páginas, dashboard, layout, porta de download e `.gitignore` descrevem problemas já corrigidos nesta entrega. Documentos anteriormente excluídos do workspace não foram restaurados nem usados como evidência.

| Evidência | Implicação para a transição |
| --- | --- |
| `frontend/src/app/{core,modules,layouts,shared}/README.md` | A base organizacional já existe; revisar e consolidar suas regras. |
| `app.routes.ts` carrega login, dashboard e users de `pages/`, e outras funcionalidades de `modules/` | Eliminar dois lugares concorrentes para funcionalidades. |
| `pages/dashboard/dashboard.store.ts` contém estado reativo, DTOs e `HttpClient` | Separar apresentação/estado de transporte e conversão de dados. |
| `layouts/dashboard-shell/dashboard-shell.ts` importa `DashboardStatusService` de `pages/dashboard/` | Layout depende de uma funcionalidade; extrair um contrato de status do shell. |
| `modules/settings/settings-page.ts` consome `scrap-base.public-api.ts` | Existe uma fronteira explícita, mas ela exporta `ScrapReviewService`, mais amplo que o catálogo de defeitos consumido. |
| `pages/governance-copy.ts` é importado por alerts, action-plans e reports | Conteúdo compartilhado está localizado sob uma pasta de páginas. |
| `modules/reports/` já tem stores, coordenadores, builder, port e adapter | Reaproveitar extrações existentes; avaliar responsabilidades antes de acrescentar camadas. |
| `report-export.coordinator.ts` injeta `BrowserDownloadAdapter`, embora exista `BROWSER_DOWNLOAD` | A tipagem por interface ainda não inverte a dependência de construção. |
| `angular.json` publica arquivos de `public/`; não há `src/environments/` ou `src/fonts/` | Adequação literal de assets exige configuração do build e preservação das URLs. |
| `package.json` usa `@fontsource-variable/fustat` | Uma pasta `fonts/` local só é necessária se houver fontes locais; não duplicar o pacote. |

Observação de inventário: `modules/reports/` está versionado, mas a regra ampla `reports/` do `.gitignore` interfere em buscas comuns e pode ocultar novos arquivos. A exceção existente aponta para o caminho antigo `pages/reports/`. Corrigir essa exceção na preparação da migração.

## 3. Estrutura de destino

```text
frontend/
├── public/                         # somente recursos que precisam de URL na raiz
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── auth/                # sessão, autenticação e guards relacionados
│   │   │   ├── http/                # interceptors e políticas de transporte/cache
│   │   │   ├── config/              # configuração global tipada
│   │   │   ├── browser/             # adapters de APIs do navegador
│   │   │   ├── i18n/                # seleção de idioma e infraestrutura de tradução
│   │   │   ├── theme/               # preferência de tema e sua persistência
│   │   │   └── shell/               # contrato e estado global do cabeçalho
│   │   ├── modules/
│   │   │   ├── auth/                # tela de login
│   │   │   ├── dashboard/           # dashboard e sua variante kiosk
│   │   │   ├── users/
│   │   │   ├── profile/
│   │   │   ├── executions/
│   │   │   ├── scrap-base/
│   │   │   ├── settings/
│   │   │   ├── reports/
│   │   │   └── governance/
│   │   │       ├── alerts/
│   │   │       ├── action-plans/
│   │   │       ├── directory/       # participantes compartilhados do domínio
│   │   │       └── governance-copy.ts
│   │   ├── layouts/
│   │   │   └── main-layout/        # evolução do dashboard-shell existente
│   │   ├── shared/
│   │   │   ├── components/         # list-view, list-filters, ui-icon
│   │   │   ├── models/             # contratos de dados realmente compartilhados
│   │   │   ├── contracts/          # ports transversais, sem implementação
│   │   │   ├── utils/              # funções puras com nomes específicos
│   │   │   └── styles/             # tokens visuais e estilos compartilhados
│   │   ├── app.routes.ts           # composição das rotas
│   │   ├── app.config.ts           # composição dos providers globais
│   │   └── app.ts / app.html / app.css
│   ├── assets/                     # imagens e outros arquivos copiados no build
│   ├── environments/               # configuração pública por build, se utilizada
│   ├── fonts/                      # somente fontes locais, se utilizadas
│   └── styles.css
└── angular.json
```

A árvore é um destino conceitual, não uma ordem para criar diretórios vazios. `governance/` é uma proposta de agrupamento para alerts e action-plans que já compartilham conceitos e textos. Reports continua independente, expondo os contratos de versões publicadas usados por governança.

Manter kiosk dentro de dashboard nesta transição: hoje a rota `dashboard/kiosk` exige `adminScopeGuard`. A pasta `modules/tv/` descreve uma funcionalidade pública futura e não deve receber o kiosk automaticamente. Organização de pastas não pode alterar permissões.

Criar `auth-layout/` ou `kiosk-layout/` apenas se existir composição visual própria suficiente para justificá-los. O login atual não exige um novo layout só para reproduzir o exemplo do guia.

### Estrutura interna das funcionalidades

Uma funcionalidade pequena pode continuar plana:

```text
modules/profile/
├── profile.routes.ts
├── profile-page.ts
├── profile-page.html
├── profile-page.css
├── profile.service.ts
└── profile-page.spec.ts
```

Para funcionalidades grandes, agrupar por subfuncionalidade e manter os arquivos relacionados próximos:

```text
modules/reports/
├── reports.routes.ts
├── reports.public-api.ts
├── reports-page.ts / .html / .css
├── catalog/              # listagem, consulta e respectivo estado
├── editor/               # edição e respectivas regras
├── preview/              # preparação e apresentação da prévia
├── publication/          # publicação
├── export/               # exportação, polling, builder e download
└── period-close/         # fechamento de período
```

Não criar obrigatoriamente `components/services/models/utils` dentro de cada feature. A recomendação oficial prioriza organização por funcionalidade e proximidade dos arquivos: [Angular Style Guide](https://angular.dev/style-guide). A divisão técnica de `shared/` é uma adaptação deliberada para aderir à seção 6 da DXi.

### Convenções de nomes

- Pastas e arquivos em inglês e `kebab-case`; manter URLs e textos de interface atuais em português.
- Preservar os nomes de negócio já reconhecidos: `scrap-base`, `action-plans`, `executions`.
- Usar `*-page.ts` para componentes de rota e nomes descritivos para componentes menores; TS, HTML, CSS e spec juntos.
- Manter os sufixos existentes quando úteis: `.store.ts`, `.service.ts`, `.routes.ts`, `.models.ts`, `.port.ts`, `.adapter.ts` e `.coordinator.ts`.
- Um serviço que só acessa HTTP pode ser nomeado `dashboard-api.service.ts`; um store contém estado da tela; um coordinator coordena uma operação. Esses papéis precisam ser distintos.
- `models` locais são contratos da funcionalidade; DTOs externos podem ir em `dashboard-api.dto.ts`, com conversão em `dashboard.mapper.ts`.
- Evitar arquivos genéricos `helpers.ts`, `common.ts` ou `utils.ts`. Preferir `date-range.ts`, `report-filename.ts` etc.
- Evitar renomear todos os arquivos só por estilo. Primeiro consolidar diretórios e fronteiras.

## 4. Mapa de movimentação a partir da estrutura inicial

As movimentações desta tabela foram concluídas, com duas adaptações: os componentes compartilhados foram agrupados em `shared/components/`, e os arquivos de governança foram agrupados em `modules/governance/`. Os diretórios `environments/` e `assets/` também foram configurados.

| Origem atual | Destino proposto | Observação |
| --- | --- | --- |
| `pages/login/` | `modules/auth/` | Separar UI de login da sessão global em `core/auth`. |
| `pages/users/` | `modules/users/` | Criar arquivo de rotas da feature. |
| `pages/dashboard/` | `modules/dashboard/` | Mover testes e kiosk junto; preservar URLs. |
| `layouts/dashboard-shell/` | `layouts/main-layout/` | Renomeação expressa que o shell atende toda a aplicação; fazer após remover dependência do dashboard. |
| `pages/dashboard/dashboard-status.service.ts` | `core/shell/shell-status.service.ts` | Contrato transversal para status; não levar regras de dashboard. |
| `i18n/language.service.ts` | `core/i18n/language.service.ts` | Depois separar dicionários de negócio para suas funcionalidades. |
| `theme/theme.service.ts` | `core/theme/theme.service.ts` | Preferência global de tema. |
| `theme/hanaro.theme.css` | `shared/styles/hanaro.theme.css` | Atualizar import de `src/styles.css`. |
| `theme/brand.config.ts` | `core/config/brand.config.ts` | Configuração global de marca. |
| `ui-icon.ts` | `shared/components/ui-icon/ui-icon.ts` | Manter API visual existente. |
| `shared/list-view/`, `shared/list-filters/` | `shared/components/list-view/`, `shared/components/list-filters/` | Adequação nominal ao guia; mover imports e referências CSS. |
| `charts/` | `modules/dashboard/charts/` ou `shared/components/charts/` | Decidir por consumidores: gráfico específico fica no dashboard; primitiva realmente genérica vai para shared. |
| `modules/alerts/`, `modules/action-plans/` | `modules/governance/alerts/`, `modules/governance/action-plans/` | Agrupar depois da migração mecânica; URLs não mudam. |
| `core/governance/governance-directory.service.ts` | `modules/governance/directory/` | Consulta de participantes pertence ao domínio; expor API limitada quando necessário. |
| `core/governance/governance.models.ts` | Separar entre modelos locais de governança e contratos públicos necessários | Não mover indiscriminadamente todos os tipos para shared. |
| `core/governance/governance-capabilities.service.ts` | Revisar papel: políticas de domínio em governance; sessão/permissões globais em core/auth | Exige inventário dos consumidores antes da extração. |
| `pages/governance-copy.ts`, `pages/governance.css` | Textos/estilos locais de governance; extrair só as partes reutilizadas por reports | Textos genéricos podem ir para shared; não criar dependência de reports na UI de governance. |
| `public/` | Imagens em `src/assets/`; bootstrap e favicon podem permanecer em `public/` | Configurar cópia e verificar todas as URLs, inclusive logos por idioma/tema. |

`environments/`: se adotado, centralizar o prefixo público da API, preservando inicialmente `/api/v1` e o proxy atual. Configurar substituições para produção e cloudflare; criar arquivos sem ligar o build a eles não resolve a configuração. Credenciais não pertencem ao bundle. Não substituir a configuração de runtime de deploy sem necessidade.

`fonts/`: manter Fustat via pacote enquanto essa for a fonte utilizada. Se uma exigência formal pedir arquivos locais, migrar a origem e configurar cópia, URLs e preload em uma entrega separada.

## 5. Regras de dependência

Fluxo típico de uma funcionalidade com estado:

```text
Página → Store ou Facade → Serviço de API → HttpClient
                         ↘ Mapper / regras puras
Página → Componentes visuais
```

Uma facade não é obrigatória quando o store já oferece a API de aplicação necessária. Não empilhar Page → Facade → Store → Coordinator → Service sem responsabilidades independentes.

| Área | Pode depender de | Restrições |
| --- | --- | --- |
| `shared` | Angular, bibliotecas visuais e outros elementos shared | Sem imports de core, layouts ou modules; sem endpoints e decisões específicas de negócio. |
| `core` | Shared e infraestrutura externa | Sem importar funcionalidades ou layouts. Contratos transversais expostos explicitamente. |
| `layouts` | Shared e APIs públicas de core | Sem importar internals de uma feature ou consultar endpoints. |
| `modules/<feature>` | Shared, contratos globais e arquivos internos | Outra feature apenas por API pública pequena, justificada e sem ciclos. |
| `app.config.ts` / rotas | Providers, layouts e entradas de features | Composição de dependências, sem regras de negócio. |

A frase do guia que proíbe acesso direto dos módulos ao core precisa de uma interpretação registrada: a proposta permite consumo de contratos/facades públicos e proíbe dependência de seus detalhes internos. Isso é uma adaptação, não uma afirmação de aderência literal. Se a exigência institucional for proibir qualquer import de `core/`, colocar os contratos transversais em `shared/contracts/` e registrar as implementações de core no ponto de composição.

Estado de tela deve ter escopo de página/feature, escolhido conforme o ciclo de vida esperado. Não converter todos os stores em singletons. Sessão, preferência de idioma e tema podem ter escopo global. Verificar que navegação, logout e troca de usuário limpam estado e caches adequadamente.

A API pública de uma feature deve exportar apenas o contrato necessário. Evitar barrels que reexportem páginas e todos os serviços, pois eles facilitam dependências circulares e carregamento acidental de código.

## 6. SOLID aplicado ao Hanaro

| Princípio | Aplicação concreta | Critério de verificação |
| --- | --- | --- |
| **S — Responsabilidade única** | Separar HTTP e DTOs do `DashboardStore`. Extrair da página de scrap a coordenação de busca/revisão quando ela puder ser testada sem template. | Alterar payload da API não exige alterar a página; alterar layout não exige alterar regra de cálculo. |
| **O — Aberto/fechado** | Políticas de métricas absoluta/relativa podem usar funções ou estratégias quando tiverem comportamentos distintos. | Adicionar uma variante não espalha condicionais por página, store e gráficos. Não criar Strategy para simples seleção de rótulo. |
| **L — Substituição de Liskov** | Adapter real e fake de download, ou implementações de consulta, precisam cumprir o mesmo contrato observável. | Testes verificam semântica de erros, resultado, ausência de dados e cancelamento quando aplicável; não basta compartilhar uma assinatura. |
| **I — Segregação de interfaces** | Settings precisa de um catálogo de defeitos, não de toda a revisão de scrap. Reports já possui serviços separados por operação. | Consumidor depende somente das operações necessárias; evitar `AppService` ou `Repository<T>` universal. |
| **D — Inversão de dependência** | Coordenador de exportação consumir `BROWSER_DOWNLOAD`; composição fornece `BrowserDownloadAdapter`. | Teste substitui a porta sem importar o adapter real; coordenador não escolhe sua implementação. |

Para completar a inversão de download existente, a futura alteração é conceitualmente:

```ts
// No coordenador:
private readonly browserDownload = inject(BROWSER_DOWNLOAD);

// No ponto de composição compatível com o escopo do coordenador:
{ provide: BROWSER_DOWNLOAD, useExisting: BrowserDownloadAdapter }
```

Como o coordenador atual é `providedIn: 'root'`, registrar o token no injector raiz ou migrar ambos para o mesmo escopo local. Registrar só na rota mantendo o coordenador root pode produzir falha de resolução. `InjectionToken` dá identidade em runtime ao contrato; a interface TypeScript sozinha não faz isso. Referência: [providers de DI do Angular](https://angular.dev/guide/di/dependency-injection-providers).

SOLID não exige uma interface para cada serviço, nem herança de componentes. Preferir composição; introduzir portas nos limites cuja substituição ou isolamento tenha utilidade demonstrável.

## 7. Design patterns: onde usar e onde evitar

| Padrão | Uso recomendado | Limite |
| --- | --- | --- |
| **Facade / Application Service** | API de ações e estado para dashboard e scrap-base complexos. | Store pode exercer esse papel; evitar facade que apenas repassa cada método. |
| **Ports and Adapters** | Download, armazenamento e outras APIs do navegador; integrações substituíveis. | Aproveitar `BrowserDownloadPort`; não transformar cada chamada HTTP em três novas classes. |
| **Mapper / Adapter de DTO** | Converter payload de dashboard em modelos usados pela interface. | Funções puras bastam; preservar números, nulabilidade e semântica dos indicadores. |
| **Strategy** | Cálculos/apresentações com variantes reais, como métricas absoluta e relativa. | Começar com funções tipadas; classes só se trouxerem benefício. |
| **Observer** | RxJS para HTTP, debounce, cancelamento e polling; signals para estado da interface. | Não introduzir event bus global. Preservar descarte de assinaturas e prevenção de respostas antigas. |
| **Builder** | Revisar e manter `ReportExportRequestBuilder` quando garantir montagem válida do pedido. | Para objeto simples, uma função é mais clara; builder não justifica arquivo de modelos monolítico. |
| **Coordinator** | Exportação, publicação e fechamento com várias etapas. | Coordenador não deve acumular renderização, transporte e todo o estado da página. |
| **Singleton via DI** | Sessão, idioma, tema e políticas globais. | Usar escopo Angular, não Singleton manual com instância estática; estado de tela permanece local. |
| **Repository** | Backend: separar persistência de regra de negócio. Frontend: apenas se houver abstração real de fonte de dados. | Para API REST simples, serviço HTTP é suficiente; não simular banco de dados no cliente. |

## 8. Sequência de execução

Cada entrega deve poder ser revisada e revertida independentemente. Não misturar movimentação extensa de arquivos, troca de comportamento e atualização de dependências.

| Etapa | Entrega | Critério de conclusão |
| --- | --- | --- |
| **0. Baseline e convenções** | Concluída: decisão registrada, inventário realizado, exceção de reports no `.gitignore` corrigida e validação inicial documentada. | Concluída. |
| **1. Consolidar funcionalidades** | Concluída: login, users e dashboard estão em `modules/`, com rotas por feature e URLs/guards preservados. | Concluída; não há páginas em `app/pages`. |
| **2. Consolidar core/shared/layouts** | Concluída: idioma, tema, ícones, componentes, status do shell e gráficos estão nos diretórios definidos. | Concluída; layout não importa dashboard e o checker protege as fronteiras. |
| **3. Piloto de responsabilidades** | Concluída para dashboard: API service, DTO, mapper e store separados, incluindo proteção contra respostas antigas. | Concluída; builds e suíte previamente executados passaram. |
| **4. Scrap e settings** | Parcial: settings consome o contrato pequeno de tipos de defeito; o coordenador da revisão em lote foi implementado em `fb003e3`, e a fila ganhou store de IDs, índice e metadados com cancelamento de consultas antigas. Revisão/anexos, modelos, listagem e organização interna seguem no [plano de execução de scrap-base](plano-execucao-scrap-base.md). | A fronteira de settings e o build da primeira extração passaram; concluir a cobertura de regressão e as demais entregas antes de marcar esta etapa como concluída. |
| **5. Reports e governance** | Concluída: reports organizado por subfuncionalidade; porta de download conectada; governance agrupado e API pública limitada. | Concluída; rotas de reports preservam guards e caminhos. |
| **6. Assets e ambientes** | Concluída: recursos visuais em `src/assets/`, configuração em `src/environments/` e fonte mantida via pacote. | Concluída; builds de produção e Cloudflare validados. |
| **7. Proteção da arquitetura** | Concluída: checker de imports, APIs públicas e READMEs atualizados; checker adicionado aos workflows de CI. | Concluída; violações cobertas pelo checker falham localmente e no CI. |

O agrupamento de governança pode ser adiado se o inventário revelar custo elevado sem benefício suficiente. A consolidação em `modules/` e a correção das dependências indevidas têm prioridade maior.

## 9. Validação, riscos e reversão

Na implementação, executar a partir de `frontend/` os scripts existentes: `npm run build`, `npm run build:cloudflare`, `npm run format:check` e `npm run check:architecture`. Os dois builds, o formatador e o checker passaram nesta continuação. A suíte de testes passou na etapa anterior (46 arquivos, 166 testes), mas não foi repetida nesta continuação. A extração completa da coordenação de scrap permanece como trabalho futuro; a migração de assets e ambientes foi concluída.

Testes de comportamento prioritários:

- Login/logout, sessão por cookie e XSRF: preservar a configuração de `app.config.ts`; não trocar por JWT por causa do exemplo genérico de interceptor no guia.
- Rotas de dashboard, kiosk, usuários, scrap e relatórios: preservar URL, guard, links diretos e parâmetros.
- SSR/hydration e build static: código dependente do navegador não pode passar a executar no servidor por causa de uma mudança de provider.
- Dashboard: filtro rápido não exibe resposta antiga, métricas absoluta/relativa e denominadores ausentes mantêm significado.
- Scrap: revisão em lote, anexos e descarte de URLs de objetos mantêm comportamento.
- Reports: exportação/polling/download, publicação e fechamento continuam corretos; fakes exercitam as portas.
- Governança: leitura, ações permitidas e vínculos com versões publicadas preservados.

Para movimentos mecânicos, usar build e testes existentes; acrescentar testes quando houver nova fronteira comportamental ou caso antes não coberto. Não escrever testes que apenas reproduzam nomes de pastas.

O projeto não declara hoje um script de lint no `package.json`. A proteção arquitetural é trabalho adicional explícito: escolher um verificador de imports ou configurar ESLint com regras de fronteira, incluindo imports dinâmicos e reexports. Começar sem nova violação sobre uma baseline temporária e reduzir as exceções até zero; não deixar uma lista permanente sem responsável.

Manter commits por feature. Em caso de regressão, reverter a entrega afetada; preservar endpoints e contratos externos durante a transição permite essa reversão sem mudança de banco. Atualizar o grafo após cada alteração de código conforme `AGENTS.md`:

```powershell
& (Get-Content graphify-out/.graphify_python) -m graphify update .
```

## 10. Backend e aderência literal ao guia

O backend atual usa `backend/src/{interfaces,infrastructure,modules}` e já está dividido por domínios. O escopo detalhado desta proposta é frontend; a leitura do backend nesta análise foi estrutural, não uma auditoria dos seus fluxos.

Aplicar Controller–Service–Repository como separação de responsabilidades: rota recebe/valida a requisição e traduz a resposta; serviço coordena regras; repositório encapsula persistência. Mapear primeiro os arquivos existentes para esses papéis. Não achatar todos os domínios em quatro diretórios globais só para copiar a árvore de exemplo.

Se a exigência for literal, uma segunda proposta deverá mapear cada rota, serviço, repositório e modelo para `server/app/controller`, `services`, `repository` e `models`, incluindo imports, discovery, migrations, testes e deploy. Renomear `frontend/backend` para `client/server` deve ser a última etapa dessa adequação. Preservar `pyproject.toml` como fonte de dependências; avaliar a geração de `requirements.txt` apenas se for um artefato obrigatório do processo DXi.

## 11. Resultado esperado

A transição está concluída quando as funcionalidades têm uma localização única, cada serviço tem um papel verificável, o layout não depende de detalhes de páginas, shared não conhece endpoints, contratos entre features são pequenos, estado tem escopo explícito e builds/testes validam os mesmos fluxos anteriores.

Prioridade recomendada: **consolidar pastas → corrigir dependências → separar responsabilidades → automatizar fronteiras**. A quantidade de patterns, interfaces ou diretórios não é uma medida de aderência a SOLID.

Fontes: `DXi_Developer.pdf`, seções 3.4, 5, 6 e 7 (trechos extraídos das páginas físicas 7–10); código atual citado acima; documentação oficial Angular vinculada neste plano. O PDF foi tratado como referência arquitetural; as propostas e adaptações deste plano são decisões recomendadas para o Hanaro.
