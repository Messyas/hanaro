# Ingestão de Material Scrap

O processamento do TSV GERP pertence a `automation/`. O backend aceita apenas
o contrato JSON canônico versão `1.0.0`, valida sua reconciliação e o persiste.
Assim, o futuro bot Windows só precisa implementar `GerpSource.obtain_file()` e
entregar o arquivo ao mesmo processador local: a API não conhece TSV, CP1252,
tabs em comentários nem regras de classificação.

## Fluxo

```text
arquivo GERP -> automation.material_scrap.process -> JSON canônico
    -> POST /api/v1/scrap/ingestions -> PostgreSQL -> endpoints de leitura
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

O endpoint de ingestão valida o contrato e enfileira o lote no Redis/Taskiq,
retornando `202 QUEUED`. O worker é o único componente que reconcilia contagens,
totais, período, USD e hashes e grava o snapshot. O mesmo arquivo na mesma
janela é idempotente; uma nova versão só substitui o snapshot ativo depois de
persistir todas as linhas. Dados históricos em USD não são recalculados quando
uma cotação futura é registrada.

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
- `GET /api/v1/dashboard/scrap/summary`
- `GET /api/v1/dashboard/scrap/trend?group_by=day|week|month`
- `GET /api/v1/dashboard/scrap/breakdown?group_by=organization&metric=amount_brl`

Exemplos: `?organizations=NWK&account_aliases=D-DIRECT`,
`?to_be_counted=true|false|unmapped`, e
`?date_from=2026-08-01&date_to=2026-08-31`.

## Pendências de homologação

1. Confirmar se `Organization Code = ALL` retorna todas as NWS no Runner.
2. Homologar matrizes de organização, departamento, item type e To be Counted.
3. Confirmar formalmente que `Issue Amount` é BRL.
4. Definir fornecedor/política de cotação de produção e possível fallback.
5. Verificar se o GERP expõe um identificador estável por transação.
6. Definir janelas reais de consulta e reconciliação.

Não há automação visual, scheduler interno ou credenciais GERP nesta entrega.
