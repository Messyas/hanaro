# Evolução dos relatórios para apresentações consolidadas

Base: código `350acfc`, revisado em 11/09/2026, e conteúdo da apresentação `Rev04_Capability_IF Cost 1.pptx`. **Status: o primeiro fluxo vertical de fechamento está implementado: escopo → análise → ações/evidências → prontidão → publicação imutável → exportação V2. O backlog registra separadamente os acabamentos ainda pendentes, como idempotência explícita, paginação completa, gráficos editáveis e fotos incorporadas.**

Objetivo: selecionar um período, consolidar resultados e análises, revisar a narrativa e emitir uma apresentação com objetivo, evolução, perdas prioritárias, causas, ações, evidências e resultados.

## Documentos e ordem de leitura

| Documento | Conteúdo |
| --- | --- |
| [01 — Backlog](01-backlog.md) | Itens identificados, dependências, arquivos envolvidos e critérios de aceite |
| [02 — Domínio e jornadas](02-dominio-e-jornadas.md) | Entidades, cardinalidades, estados e regras operacionais |
| [03 — Entidades e tabelas](03-entidades-e-tabelas.md) | Campos, tipos, relacionamentos, constraints e índices |
| [04 — Migrations](04-migrations.md) | Sequência Alembic, preenchimento de legados, triggers e reversão |
| [05 — Backend](05-backend-servicos-e-metodos.md) | Classes, módulos, métodos, transações e integração |
| [06 — API](06-api-e-contratos.md) | Rotas, payloads, paginação, concorrência e autorização |
| [07 — Frontend](07-frontend-componentes.md) | Componentes existentes e novos, contratos, serviços e navegação |
| [08 — Documento e exportação](08-documento-e-exportacao.md) | Conteúdo versionado, snapshots, blocos e renderização PPTX/PDF |
| [09 — Validação e entrega](09-validacao-e-entrega.md) | Cenários de teste, implantação e critérios para liberar cada incremento |
| [10 — Lacunas do frontend](10-lacunas-frontend-dados-recebidos.md) | Dados já recebidos do backend que ainda precisam ser apresentados e editados no Angular |

O [diagnóstico original](../plano-relatorios-apresentacao-consolidada.md) registra a comparação com os 27 slides. O [plano anterior de governança](../evolucao-governanca/README.md) continua como contexto; esta pasta detalha a implementação da evolução de relatórios sobre o código atual. Havendo diferenças, os contratos propostos aqui são a referência desta iniciativa, sujeitos à revisão antes da implementação.

## Convenções

Antes de ampliar as áreas afetadas, consultar o [backlog de arquitetura e SOLID](../backlog-arquitetura-solid.md). Ele registra os ajustes de organização frontend e CSR no backend identificados na avaliação DXi. Os caminhos atuais desta série são a base inspecionada; quando uma feature migrar, atualizar suas referências para o destino definido pela decisão arquitetural.

- **Existente:** encontrado no código. Não implica validação em produção.
- **Ampliar:** preservar a implementação e adicionar contratos/comportamentos.
- **Novo:** proposta ainda sem arquivo ou tabela implementada.
- IDs `REL-xxx`: backlog. IDs `M01`–`M09`: lotes lógicos de migrations, não revisões Alembic já reservadas.
- Todos os caminhos de código são relativos à raiz do repositório.
- Relações/valores exigidos para uma afirmação devem ser validados pelo backend; campo ausente não significa zero.

## Entregas

1. **Incremento A — Fechamento apresentável:** REL-001 a REL-011 e REL-020. Recorte financeiro, indicadores, ações, narrativa, fotos e emissão coerente. Meta incompatível e dados sem classificação aparecem explicitamente.
2. **Incremento B — Investigação:** REL-012 e REL-013. Casos, causas, 4M e porquês.
3. **Incremento C — Resultado medido:** REL-014 e REL-015. Produção, comparação antes/depois e eficácia.
4. **Incremento D — Programa completo:** REL-016 a REL-019. Charter, riscos, implantação e custos complementares.

REL-020 é recorrente: testes, compatibilidade e operação acompanham cada incremento. O fechamento A não depende de concluir riscos ou integrar outras categorias de IF Cost.

## Decisões propostas

- Manter monólito modular, FastAPI/SQLAlchemy, PostgreSQL, Taskiq e Angular existentes.
- Preservar relatório manual como `DOSSIER`; introduzir `PERIOD_CLOSE` para fechamento por período.
- Reutilizar `ActionPlan` como iniciativa/charter no primeiro desenho: um plano pode aparecer em várias edições. Um relatório pode reunir ações de vários planos. Não criar uma entidade paralela de projeto antes de existir necessidade comprovada.
- Criar composição e snapshot V2 sem reescrever snapshots V1.
- Começar com material scrap. A composição completa de IF Cost só estará disponível com fontes verificáveis para seus demais componentes.
- Preservar a política de acesso da intranet: relatórios privados para autenticados; configurações compartilhadas administradas por superusuário. Não introduzir uma nova exigência de aprovação gerencial para publicar.

## Limites desta revisão

Leitura estática de código, schemas, migrations, testes e conteúdo extraído do PPTX. A consulta `python -m graphify query` foi tentada, mas o Python do host não está instalado/acessível; o JSON do grafo foi consultado com Node e confrontado com os arquivos atuais. Nenhuma aplicação, migration ou teste de integração foi executado nesta entrega documental. A implementação deve confirmar o head Alembic e as APIs das dependências na versão instalada antes de codificar.
