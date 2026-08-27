# Ingestão de Material Scrap

Esta entrega simula a saída futura do bot Smart Office, transforma o TSV do
GERP e publica snapshots transacionais consumíveis pelo frontend. Não contém
automação gráfica, scheduler, deploy no Smart Office nem frontend.

## Componentes

```text
Fixture CP1252 ou arquivo bruto sem extensão
        ↓
simulator.py (contrato Smart Office 1.0)
        ↓
job.py ou tasks.py (CLI / Taskiq)
        ↓
transformer.py (reconstrução, Decimal e classificações)
        ↓
service.py + repository.py (snapshot transacional)
        ↓
PostgreSQL
        ↓
query_service.py (modelo de leitura indexado)
        ↓
routes.py (FastAPI)
        ↓
Frontend e dashboard
```

O parser lê CP1252 com `errors="strict"`, reconhece as duas colunas
`Description`, remove a coluna vazia final e remonta TABs excedentes dentro de
`REQ Comment`. Uma linha estruturalmente inválida interrompe a carga; nenhuma
linha é descartada silenciosamente.

## Banco e publicação

A migration `20260826_02` cria:

- `scrap_ingestion_runs`: execução, janela lógica, contagens, estado e snapshot ativo;
- `scrap_ingestion_source_files`: hash SHA-256 e metadados da extração;
- `scrap_exchange_rates`: cotação Decimal usada na carga;
- `scrap_transactions`: valores brutos, derivados, flags e proveniência.

Um hash já concluído na mesma janela retorna a execução anterior. Um hash novo
cria outra versão e só troca o snapshot ativo após todas as linhas terem sido
gravadas e validadas na mesma transação. Em falha, a nova versão fica `FAILED`
e a anterior continua ativa. `source_row_number` diferencia linhas idênticas
legítimas.

Foi escolhido um modelo de leitura por consultas indexadas e `is_active`, sem
view materializada. O volume inicial ainda é desconhecido e o snapshot ativo
torna as consultas simples; materialização e `pg_trgm` devem ser reavaliados
com métricas reais de cardinalidade e latência. Os KPIs usam `ABS` somente na
consulta do dashboard; a base persiste e devolve os sinais originais.

## Executar

Na raiz, suba o PostgreSQL e aplique a migration:

```powershell
docker compose up -d postgres redis
docker compose run --rm backend alembic upgrade head
```

Ingestão da fixture anonimizada com a cotação 5.15:

```powershell
docker compose run --rm backend python -m src.modules.material_scrap.job `
  --source fixtures/Other_Account_Transaction_Text_anonymized `
  --exchange-rate 5.15
```

A fixture contém seis registros, quatro organizações, setores mapeados e não
mapeados, uma organização não mapeada, valor positivo, valores negativos, uma
linha com TAB interno e duas linhas idênticas legítimas. Para a cotação 5.15:

- total bruto assinado em BRL: `-146.50`;
- KPI positivado em BRL: `246.50`;
- KPI positivado em USD: `47.864079`;
- linhas reconstruídas: `1`;
- linhas persistidas: `6`.

O worker existente registra a tarefa `material_scrap.ingest`, que recebe o
mesmo contrato JSON. Ele pode ser iniciado com o profile `worker`; nenhum
scheduler foi adicionado.

## API

Endpoints públicos de leitura:

- `GET /api/v1/scrap`
- `GET /api/v1/scrap/filters`
- `GET /api/v1/dashboard/scrap/summary`
- `GET /api/v1/dashboard/scrap/trend?group_by=day|week|month`
- `GET /api/v1/dashboard/scrap/breakdown?group_by=organization&metric=amount_brl`

Exemplos:

```text
GET /api/v1/scrap?organizations=NWK&organizations=NW1&page=1&page_size=50
GET /api/v1/scrap?receipt_departments=NOVO_SETOR&sort_by=issue_amount_brl&sort_order=desc
GET /api/v1/dashboard/scrap/trend?date_from=2026-08-01&date_to=2026-08-31&group_by=day
GET /api/v1/dashboard/scrap/breakdown?group_by=department&metric=amount_usd
```

Decimais são serializados como strings JSON. `sort_by`, `sort_order`,
`group_by` e `metric` são enums e entradas fora da allowlist recebem HTTP 422.

## Testes

```powershell
docker compose run --rm backend pytest tests/unit/modules/material_scrap -q
docker compose run --rm backend pytest tests/integration/api/v1/material_scrap -q
```

Os testes de integração usam o PostgreSQL fornecido por Testcontainers e
exigem Docker. O arquivo corporativo real não é versionado; quando o bot real
for integrado, ele deverá produzir `MaterialScrapPayload` e conservar os mesmos
campos, hash, janela, encoding e semântica de snapshot.
