# Persistência implementada e execução dos seeds

Esta entrega acrescenta uma fundação de persistência; não implementa os serviços de negócio nem as telas dos documentos anteriores. O modelo físico adotado está em `backend/src/modules/governance/models.py`, com prefixo `gov_` para manter compatibilidade com as tabelas atuais.

## Conteúdo

25 tabelas para fábricas, linhas/layouts/postos, versões diárias de produção, políticas/decisões de revisão, casos/ocorrências, análises versionadas, ações/eficácia, snapshots/itens, relatórios/edições/análises, jobs/artefatos, ciclos/achados, eventos/outbox/recibos.

Migração estática `20260906_12`, posterior a `20260904_11`. Mantém o schema atual e aceita o bootstrap completo por `create_all`; schema de governança parcialmente existente é rejeitado para reconciliação. `create_tables()` agora registra os modelos explicitamente, corrigindo o caso em que o script standalone executava com metadata incompleta.

Constraints incluem revisão positiva, produção não negativa, FK restritiva, uma produção aprovada por linha/dia, um caso principal ativo por ocorrência e unicidade dos vínculos. Índices atendem filas por fábrica/status/prazo, responsáveis, histórico e outbox pendente. Casos e ações têm concorrência otimista pelo mapper SQLAlchemy; futuras atualizações SQL em lote precisam verificar a versão explicitamente.

Em PostgreSQL, a migração instala triggers para impedir edição de documentos publicados, snapshots selados e seus itens, decisões/eventos append-only e produção aprovada. Produção aprovada só pode passar a `SUPERSEDED` mantendo os demais campos; sua correção exige outra revisão. Há validação de fábrica nos vínculos ação/caso e relatório/análise/snapshot, além da origem transação/ocorrência nos itens congelados. Execute Alembic: `create_all` sozinho não instala esses triggers.

## Seeds

O fluxo existente `seed_demo_data()` continua carregando classificações e fixtures de Material Scrap e agora chama `scripts.seed_demo_governance`. O novo seed usa UUIDs determinísticos, somente insere registros ausentes e serializa execuções concorrentes com advisory lock no PostgreSQL. Preserva registros editados e não cria credenciais ou arquivos de relatório fictícios.

Com pelo menos três ocorrências ativas, cria três cenários, três linhas demonstrativas, 21 apontamentos de produção, casos, análises, ações, decisões de revisão, snapshots, edições, jobs PDF pendentes, ciclo/achado e eventos. Com menos ocorrências, cria menos cenários. Políticas demonstrativas ficam inativas e a origem da produção é `DEMO`. Esses dados não devem alimentar ranking operacional real.

### Banco já migrado com Material Scrap

No diretório `backend`, usando o ambiente virtual e a conexão local de desenvolvimento configurados:

```powershell
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m scripts.seed_demo_governance
```

Para executar todo o fluxo existente de seed com fixtures locais:

```powershell
$env:PYTHONPATH = (Resolve-Path '..').Path
$env:DEMO_DATA_PATH = (Resolve-Path '../automation/fixtures/demo-history').Path
$env:SEED_DEMO_DATA = 'true'
..\.venv\Scripts\python.exe -c "import asyncio; from src.infrastructure.start_production import seed_demo_data; asyncio.run(seed_demo_data())"
```

Confirme o destino da conexão antes de executar. Não é necessário criar usuário administrador novo para o seed de governança. Para banco vazio, usar o bootstrap existente de desenvolvimento, que cria o baseline e reconcilia Alembic; a cadeia histórica pressupõe tabelas-base da aplicação. Não usar `alembic stamp head` para dispensar a instalação dos triggers novos.

## Validação

```powershell
# Teste SQLite com chaves estrangeiras habilitadas:
..\.venv\Scripts\python.exe -m pytest tests/unit/modules/material_scrap/test_governance_persistence.py -k sqlite -q

# Para testar também PostgreSQL, indicar uma conexão local exclusiva de teste:
$env:GOVERNANCE_TEST_DATABASE_URL = '<URL PostgreSQL asyncpg de teste>'
..\.venv\Scripts\python.exe -m pytest tests/unit/modules/material_scrap/test_governance_persistence.py -q
```

O teste PostgreSQL usa schema aleatório e remove somente esse schema no final. Cobre criação pela migração, seed repetido, constraints, imutabilidade e downgrade/upgrade. A suíte existente de Material Scrap permanece necessária para regressão.

## Limites e próximo trabalho

O schema é a fundação, não a totalidade do modelo conceitual proposto. A população/conclusão da auditoria e conteúdo de análise usam JSON versionável nesta primeira etapa. Amostragem relacional detalhada, catálogo de evidências, produção vinculada ao snapshot, layouts sem sobreposição, regras de alçada, transições, alertas/distribuição, mapeamento de fábrica na origem e métricas/rollups ainda precisam das próximas implementações.

Não foi adicionada materialized view sem benchmark e sem mapeamento confiável entre linha de origem e linha física. O fato de scrap existente foi preservado. Não foram alterados o algoritmo de identidade nem a semântica de reconciliação do ERP nesta entrega.

Os serviços futuros precisam controlar autoria, aprovação, escopo completo e transação com outbox, além de validar o conteúdo JSON. Triggers de imutabilidade protegem as tabelas cobertas, mas não substituem essas regras nem autorização. SQLite serve ao teste estrutural; as proteções por trigger são específicas do PostgreSQL.
