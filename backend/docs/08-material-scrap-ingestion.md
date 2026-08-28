# Ingestão de Material Scrap

O processamento do TSV GERP pertence a `automation/`. O backend aceita apenas
o contrato JSON canônico versão `1.0.0`, valida sua reconciliação e o persiste.
Assim, o futuro bot Windows só precisa implementar `GerpSource.obtain_file()` e
entregar o arquivo ao mesmo processador local: a API não conhece TSV, CP1252,
tabs em comentários nem regras de classificação.

## Fluxo

```text
arquivo GERP -> automation.material_scrap.process -> JSON canônico
    -> POST /api/v1/scrap/ingestions -> Taskiq worker
    -> PostgreSQL (write model + read model) -> cache -> endpoints de leitura
```

O JSON contém linhagem do arquivo (SHA-256, tamanho e encoding), janela
consultada, datas de processamento, taxa diária BRL/USD, versão dos
mapeamentos, totais de controle, flags de qualidade e `content_hash` de cada
registro. Decimais são sempre strings JSON, nunca `float`.

## Banco e publicação

As migrations `20260826_02` e `20260827_03` mantêm snapshots versionados:

- `scrap_ingestion_runs` registra execução, janela, status, totais e flags;
- `scrap_ingestion_source_files` registra arquivo e hash;
- `daily_exchange_rates` reaproveita a cotação diária por data/moedas/tipo/fonte;
- `scrap_transactions` armazena todos os campos canônicos, incluindo
  `source_line`, `content_hash`, valores BRL/USD e atributos derivados.

O endpoint de ingestão aplica a validação estrutural Pydantic e enfileira o lote
no Redis/Taskiq, retornando `202 QUEUED`. A reconciliação completa não é
duplicada durante a requisição HTTP: o worker é o único componente que valida
contagens, totais, período, USD e hashes e grava o snapshot. O mesmo arquivo na mesma
janela é idempotente; uma nova versão só substitui o snapshot ativo depois de
persistir todas as linhas. Dados históricos em USD não são recalculados quando
uma cotação futura é registrada.

O contrato limita a janela a 366 dias, o lote a 50.000 registros, a lista de
organizações a 1.000 valores e as listas de filtros a 50 valores. Strings que
participam de índices ou colunas limitadas são validadas antes de chegar ao
banco. Campos extras são rejeitados e todo decimal canônico deve ser string
JSON.

## Read model e cache

O dashboard não agrega `scrap_transactions` durante a requisição. O worker usa
`ProjectionBuilder` para gerar `scrap_dashboard_aggregates` no grão diário e nas
dimensões filtráveis. A publicação das transações, da projeção, do snapshot ativo
e da nova revisão ocorre no mesmo commit.

`scrap_dashboard_state` contém a revisão usada nas chaves de cache. Respostas do
dashboard recebem TTL explícito por `DASHBOARD_CACHE_TTL_SECONDS` (300 segundos
por padrão). Ingestões e alterações de meta trocam a revisão; chaves antigas
expiram naturalmente, inclusive em Memcached. Se o cache estiver indisponível,
a leitura usa o read model sem alterar autorização ou contrato.

As metas de IF Cost ficam em `scrap_targets`, uma linha global por mês e moeda.
A leitura é pública como o dashboard; escrita é idempotente e exclusiva de
superusuário autenticado, com a proteção CSRF da sessão.

## Executar localmente

Com API já disponível, no diretório raiz:

```powershell
python -m automation.material_scrap.process `
  --input "C:\caminho\Other_Account_Transaction_Text_250826_" `
  --reference-date 2026-08-26 `
  --exchange-rate 5.15 `
  --exchange-rate-source manual_fixture `
  --output automation/artifacts/material_scrap.json `
  --backend-url http://localhost:8000 `
  --api-key "fai_..."
```

Sem `--backend-url`, o JSON é gerado e mantido para repetição segura. O endpoint
de escrita exige `X-API-Key` com permissão `material_scrap:create`.

## API de leitura

- `POST /api/v1/scrap/ingestions` (assíncrono, retorna `task_id`)
- `GET /api/v1/scrap`
- `GET /api/v1/scrap/filters`
- `GET /api/v1/dashboard/scrap` (contrato completo para a tela)
- `GET /api/v1/dashboard/scrap/summary`
- `GET /api/v1/dashboard/scrap/trend?group_by=day|week|month`
- `GET /api/v1/dashboard/scrap/breakdown?group_by=organization&metric=amount_brl`
- `GET /api/v1/dashboard/scrap/targets?year=2026`
- `PUT /api/v1/dashboard/scrap/targets/{year}/{month}` (superusuário)

Exemplos: `?organizations=NWK&account_aliases=D-DIRECT`,
`?to_be_counted=true|false|unmapped`, e
`?date_from=2026-08-01&date_to=2026-08-31`.

O endpoint completo aceita `year`, `currency=BRL|USD`,
`impact_mode=absolute|signed`, `week=1..53`, `ranking_limit=1..20` e os filtros
dimensionais existentes. A resposta entrega:

- KPIs realizado, target, atingimento, referência e variação anual;
- séries mensal e semanal;
- rankings de produto, componente, linha, modelo e ofensor;
- top 5 ocorrências prioritárias;
- revisão, data de geração e data máxima dos dados.

Mapeamento atual: linha = `receipt_department`, componente = `item_type`, modelo
= `item_code` e ofensor = `account_alias`. O frontend não deve reinterpretar
essas dimensões nem recalcular percentuais.

## Pendências de homologação

1. Confirmar se `Organization Code = ALL` retorna todas as NWS no Runner.
2. Homologar matrizes de organização, departamento, item type e To be Counted.
3. Confirmar formalmente que `Issue Amount` é BRL.
4. Definir fornecedor/política de cotação de produção e possível fallback.
5. Verificar se o GERP expõe um identificador estável por transação.
6. Definir janelas reais de consulta e reconciliação.
7. Homologar `account_alias` como dimensão de ofensor; trocar o mapeamento no
   backend se o GERP fornecer um campo mais específico.

Não há automação visual, scheduler interno ou credenciais GERP nesta entrega.
