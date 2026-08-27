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

Os serviços `material-scrap-simulation` e `material-scrap-worker-simulation`
sobem juntos: o primeiro gera/enfileira o lote e o segundo o persiste. A
simulação usa a fixture anonimizada por padrão, salva o JSON em
`automation/artifacts/` e o envia ao backend. Para apenas gerar o artefato sem enviar, defina
`HANARO_SIMULATION_SEND=false`. Para usar o arquivo real em Downloads, defina
`HANARO_SIMULATION_HOST_INPUT_DIR=C:/Users/User/Downloads` e
`HANARO_SIMULATION_INPUT=/input/Other_Account_Transaction_Text_250826_` no
`.env`; o Compose monta essa pasta como somente leitura.
