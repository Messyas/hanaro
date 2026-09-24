# Backlog de arquitetura e SOLID

Status: **pendente de implementação**. Registrado em 10/09/2026 a partir da [avaliação do guia DXi](avaliacao-dxi-arquitetura-solid.md). Este documento transforma os achados em tarefas para execução posterior; nenhuma refatoração foi aplicada.

P1: priorizar antes de ampliar significativamente a funcionalidade afetada. P2: melhoria posterior ou alinhamento corporativo. IDs ARCH identificam este backlog e não substituem os itens REL da [evolução de relatórios](evolucao-relatorios/README.md).

## Tarefas

### ARCH-01 — Definir a organização oficial do frontend

- [ ] **P1 · Pendente.** Registrar uma decisão arquitetural adotando `modules/<feature>` como destino proposto, preservando componentes standalone.
- **Arquivos:** `frontend/src/app/core/README.md`, `modules/README.md`, `shared/README.md`, `layouts/README.md` e documentação frontend.
- **Escopo:** documentar responsabilidades de core, shared, layouts e features; esclarecer que o guia também apresenta `pages/` para Quick Solutions. A decisão deve estabelecer uma convenção única para o Hanaro.
- **Aceite:** árvore alvo, regras de importação e estratégia de migração documentadas; nenhuma orientação contraditória entre os READMEs vigentes.
- **Dependências:** nenhuma.

### ARCH-02 — Separar responsabilidades de ReportsPage

- [ ] **P1 · Pendente.** Separar listagem, editor, fontes, prévia, histórico e emissão.
- **Arquivos:** `frontend/src/app/pages/reports/reports-page.ts`, `.html`, `.css`, `.spec.ts` e `reports.service.ts`.
- **Escopo:** extrair traduções da classe, componentes de apresentação e store por instância de editor; separar autosave, coordenação da exportação e download. Evitar mover todo o componente para uma facade igualmente ampla.
- **Aceite:** URLs e comportamento preservados; edição não mistura estado entre relatórios; testes de autosave, conflitos, publicação e exportação passam; build frontend aprovado.
- **Dependências:** ARCH-01. Pode preceder a mudança física das pastas.
- **Relação com relatórios:** preparar REL-008 e REL-011.

### ARCH-03 — Dividir GovernanceService e tipar comandos

- [ ] **P1 · Pendente.** Separar clientes HTTP de planos/ações, alertas e regras de notificação.
- **Arquivos:** `frontend/src/app/pages/governance.service.ts`, `governance.models.ts`, consumidores em action-plans, alerts e reports.
- **Escopo:** substituir requests `object` e comandos `string` por DTOs e uniões discriminadas de move/validate/reopen/comment. Manter capabilities em contrato pequeno próprio.
- **Aceite:** consumidores recebem apenas as operações necessárias; requests inválidos são detectados pelo TypeScript; endpoints e payloads válidos permanecem compatíveis.
- **Dependências:** ARCH-01.

### ARCH-04 — Migrar features e eliminar dependências invertidas

- [ ] **P1 · Pendente.** Migrar gradualmente `pages/<feature>` para `modules/<feature>` e criar rotas locais por funcionalidade.
- **Arquivos:** `frontend/src/app/app.routes.ts`, `pages/`, `modules/`, `layouts/dashboard-shell/dashboard-shell.ts`, `charts/dashboard-performance-chart.ts`.
- **Escopo:** começar por reports; depois action-plans e demais features. Retirar dependência do shell em `DashboardStatusService` específico; manter gráfico de dashboard na feature ou extrair contrato neutro se houver reuso real. Consolidar mecanismo global de tema/i18n em core; textos específicos ficam nas features.
- **Aceite:** URLs preservadas, lazy loading funcional, imports antigos removidos após migração e ausência de implementações duplicadas. Core/shared não importam internals das features.
- **Dependências:** ARCH-01, ARCH-02 e ARCH-03 para os consumidores afetados.

### ARCH-05 — Aplicar CSR em relatórios e planos de ação

- [ ] **P1 · Pendente.** Remover SQL de handlers e casos de uso, introduzindo contratos específicos de leitura/persistência.
- **Arquivos:** `backend/src/modules/governance/workflow_routes.py`, `routes.py`, `service.py`, `actions.py`; adapters e contratos novos no módulo correspondente.
- **Escopo:** controllers adaptam HTTP; serviços coordenam regras; repositories executam SQL. Incluir contratos tipados de resposta, evitando serialização genérica de entidades como API pública.
- **Aceite:** handlers e serviços migrados não montam consultas SQL; regras podem ser testadas com doubles dos contratos; publicação mantém atomicidade, deduplicação, auditoria/outbox e proteção das versões antigas.
- **Dependências:** testes de caracterização do fluxo atual antes de mover responsabilidades.
- **Relação com relatórios:** ajustar REL-002, REL-006 e os novos serviços previstos no plano.

### ARCH-06 — Separar consultas e cálculos do dashboard

- [ ] **P1 · Pendente.** Extrair leitura financeira para contrato próprio e manter cálculos independentes de ORM.
- **Arquivos:** `backend/src/modules/material_scrap/dashboard_service.py`, `query_service.py`, `repository.py`, `dependencies.py` e futuros serviços analíticos de relatórios.
- **Escopo:** isolar SQL, regras de agregação e montagem da resposta. Contratos retornam DTOs/agregados adequados ao volume, sem obrigar materialização de toda a base em memória.
- **Aceite:** valores permanecem reconciliados; cálculos são testáveis sem banco; adapters têm integração PostgreSQL; correções semânticas são identificadas separadamente de refatoração mecânica.
- **Dependências:** definir contrato de indicador em REL-001 antes de alterar fórmulas.
- **Relação com relatórios:** REL-004 e REL-007.

### ARCH-07 — Melhorar inversão de dependências e controle transacional

- [ ] **P1 · Pendente.** Injetar contratos de storage, persistência e capacidades externas nos casos de uso que precisam de substituição.
- **Arquivos:** `material_scrap/service.py`, `material_scrap/dependencies.py`, `governance/exports/service.py`, `governance/evidence.py` e factories correspondentes, sob `backend/src/modules/`.
- **Escopo:** tirar construção de serviços concretos dos casos de uso; usar Protocols pequenos e composition root. Definir unidade de trabalho para comandos com várias escritas, sem commit independente em cada repository.
- **Aceite:** casos de uso testáveis com adapters substitutos; commit/rollback continuam cobrindo toda a operação; locks, snapshot e outbox não são enfraquecidos.
- **Dependências:** coordenar com ARCH-05/06; não criar abstrações sem consumidor ou necessidade concreta.

### ARCH-08 — Corrigir contrato de capacidades do cache

- [ ] **P2 · Pendente.** Separar exclusão por padrão do contrato básico de cache.
- **Arquivos:** `backend/src/infrastructure/cache/base.py`, `backends/memcached.py`, `backends/redis.py`, `provider.py`, `decorator.py` e testes relacionados.
- **Escopo:** contrato básico de leitura/escrita e capacidade específica de invalidação; Memcached não deve prometer operação que sempre rejeita. Mapear consumidores ativos antes de alterar interfaces.
- **Aceite:** testes de contrato para ausência, TTL, serialização, falhas e capacidades; substituição de adapter não quebra uma operação prometida pelo contrato consumido.
- **Dependências:** levantamento dos consumidores. Não exige remover um backend nem trocar tecnologia.

### ARCH-09 — Consolidar contratos de renderizadores

- [ ] **P2 · Pendente.** Centralizar registro de formato, MIME, schema/template e capacidades suportadas.
- **Arquivos:** `backend/src/modules/governance/exports/renderers/__init__.py`, `exports/document.py`, `exports/service.py`, `schemas.py`.
- **Escopo:** contratos comportamentais de renderer, mantendo V1/V2 e identidade dos artefatos. Adicionar formato não deve exigir condicionais espalhadas por regras de negócio.
- **Aceite:** combinações inválidas rejeitadas explicitamente; testes compartilhados dos renderizadores; arquivos históricos permanecem acessíveis e intactos.
- **Dependências:** coordenar com REL-009; não generalizar formatos que ainda não têm uso.

### ARCH-10 — Automatizar regras de arquitetura

- [ ] **P1 · Pendente.** Adicionar verificação de fronteiras e ciclos ao CI.
- **Arquivos:** configuração de análise frontend/backend, testes arquiteturais e `.github/workflows/quality-gate.yml`.
- **Escopo:** bloquear imports de features em core/shared, acesso a internals entre features e dependência HTTP/SQL indevida nas camadas migradas. Escolher ferramenta compatível sem introduzir plataforma de monorepo como pré-requisito.
- **Aceite:** exemplos controlados de violação falham no CI; exceções temporárias são explícitas e rastreáveis; baseline legado não bloqueia toda entrega sem estratégia incremental.
- **Dependências:** ARCH-01 e primeiro piloto de ARCH-04/05.

### ARCH-11 — Confirmar aderência aos processos corporativos DXi

- [ ] **P2 · Pendente de confirmação externa.** Registrar evidências ou exceções dos requisitos corporativos.
- **Arquivos:** `docs/ci-cd.md`, documentação de operação, workflows, `render.yaml`, `automation/README.md` e uma decisão de compatibilidade DXi.
- **Escopo:** esclarecer GitLab/GitHub Actions, develop/developer, padrões de branch/commit, revisão obrigatória, homologação pelo area owner, deploy Render/Cloudflare versus Portainer/Nginx, Smart Office e Metadata API/DX Lake. Confirmar também equivalência uv/lock versus requirements/venv e configuração de assets/ambientes do Angular.
- **Aceite:** cada requisito tem responsável funcional, evidência verificável ou exceção formal; integrações ausentes recebem backlog próprio com contrato e escopo.
- **Dependências:** responsável pelo padrão corporativo e pelas integrações. Não renomear branches, migrar hospedagem ou enviar dados a serviços externos automaticamente.

## Ordem de execução sugerida

1. ARCH-01: fixar convenção e limites.
2. ARCH-02/03: reduzir responsabilidades e melhorar contratos no frontend.
3. ARCH-04: migrar fisicamente por feature, preservando URLs.
4. ARCH-05/06/07: aplicar CSR e DIP nas áreas que vão receber a evolução de relatórios.
5. ARCH-10: proteger os limites introduzidos; ampliar conforme os demais módulos forem migrados.
6. ARCH-08/09: melhorar contratos de infraestrutura conforme seu uso e a evolução de exportação.
7. ARCH-11: acompanhar alinhamento corporativo sem bloquear refatorações locais independentes.

## Regras para executar depois

- Separar mudança mecânica de paths de mudança funcional sempre que possível.
- Não considerar uma tarefa concluída apenas porque classes e arquivos foram divididos: verificar dependências, comportamento e critérios de aceite.
- Preservar testes, URLs, payloads compatíveis, transações e documentos publicados.
- Rodar testes pertinentes e build frontend quando houver alteração Angular; validar guards/migrations em PostgreSQL quando afetados.
- Após alterar código, atualizar Graphify conforme AGENTS.md.
- Atualizar o checkbox, registrar evidências e apontar o commit/PR quando cada tarefa for concluída.
