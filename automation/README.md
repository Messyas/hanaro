# Automação de Material Scrap

Este diretório é o limite do futuro bot Smart Office. O adaptador atual é
`LocalFileSource`; o futuro RPA deve implementar `GerpSource` e retornar apenas
o caminho do download concluído e seus metadados. Parser, normalização e envio
permanecem os mesmos.

```powershell
python -m automation.material_scrap.process --input "<TSV GERP>" --reference-date 2026-08-26 --exchange-rate 5.15 --exchange-rate-source manual_fixture
```

O parser valida CP1252/UTF-8, header posicional, coluna final vazia e tabs
fragmentados em `REQ Comment`; qualquer ambiguidade falha o lote inteiro. Os
artefatos de execução ficam em `automation/artifacts/` e não são versionados.
`fixtures/material_scrap_payload_example.json` é uma amostra anonimizada do
contrato enviado à API.

## Gerar TSV sintético histórico

Para simular dados próximos do export GERP sem reutilizar identificadores de
pessoas, gere arquivos TSV brutos a partir de uma amostra. Por padrão, o
comando gera três anos até a data corrente e nunca produz datas futuras. Cada
arquivo cobre no máximo 366 dias, portanto pode ser processado e ingerido de
forma independente pelo contrato atual da API.

```powershell
python -m automation.material_scrap.synthetic `
  --template "C:\Users\User\Downloads\Other_Account_Transaction_Text_250826_ (1)" `
  --output-directory automation/artifacts/synthetic `
  --years 3 `
  --average-rows-per-day 24
```

O gerador mantém a estrutura, códigos e distribuição da amostra, recalcula
quantidade/preço/valor de cada registro e substitui responsáveis, comentários
e identificadores operacionais por valores sintéticos. Use `--years 2` para
dois anos, `--seed` para repetibilidade e `--end-date` quando quiser uma data
anterior; se uma data futura for informada, ela é limitada automaticamente ao
dia corrente.

O RPA real ainda deve autenticar no GERP, submeter uma única requisição,
acompanhar `Completed/Normal`, conferir estabilidade do download e então chamar
este comando. Não usar `sleep` como confirmação de término nem registrar
credenciais ou conteúdo integral de comentários nos logs.

## Simulação pelo Docker Compose

Copie `.env.example` para `.env`, informe uma `HANARO_API_KEY` com a permissão
`material_scrap:create` e inicie o profile `simulation` pelo Docker Desktop ou:

```powershell
docker compose --profile simulation up --build
```

Os serviços `material-scrap-simulation` e `material-scrap-worker`
sobem juntos: o primeiro gera/enfileira o lote e o segundo o persiste. O worker
também faz parte do ambiente local padrão para processar uploads manuais. A
simulação usa a fixture anonimizada por padrão, salva o JSON em
`automation/artifacts/` e o envia ao backend. Para apenas gerar o artefato sem enviar, defina
`HANARO_SIMULATION_SEND=false`. Para usar o arquivo real em Downloads, defina
`HANARO_SIMULATION_HOST_INPUT_DIR=C:/Users/User/Downloads` e
`HANARO_SIMULATION_INPUT=/input/Other_Account_Transaction_Text_250826_` no
`.env`; o Compose monta essa pasta como somente leitura.
