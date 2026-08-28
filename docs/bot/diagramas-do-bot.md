# Diagramas do bot

Esta pasta contém os diagramas específicos da automação de Material Scrap. Os
diagramas gerais do sistema ficam em [`docs/system`](../system/).

- [material-scrap-current-state.puml](material-scrap-current-state.puml): estados
  desde a leitura do arquivo até a publicação atômica do snapshot e da projeção
  analítica.
- [material-scrap-data-architecture.puml](material-scrap-data-architecture.puml):
  componentes, limites de segurança, persistência, cache e consumo pelo frontend.

## Decisões representadas

- `automation/` é responsável por TSV, encoding, normalização, cotação e JSON
  canônico. O backend não conhece detalhes do arquivo GERP.
- `POST /api/v1/scrap/ingestions` valida o contrato Pydantic, exige API key com
  `material_scrap:create` e apenas enfileira o processamento.
- O worker reconcilia valores, hashes e contagens. Na mesma transação ele grava
  as transações, cria `scrap_dashboard_aggregates`, ativa o snapshot e altera a
  revisão de `scrap_dashboard_state`.
- O frontend lê `GET /api/v1/dashboard/scrap`; KPIs, comparações, séries e
  rankings vêm prontos. O navegador não recalcula indicadores financeiros.
- O cache de resposta usa chave com revisão e TTL. Uma ingestão ou alteração de
  meta cria outra revisão; falha do cache faz bypass seguro para o PostgreSQL.
- Metas mensais globais são públicas para leitura, mas `PUT
  /api/v1/dashboard/scrap/targets/{year}/{month}` exige superusuário e CSRF da
  sessão.

## Mapeamento atual dos gráficos

| Conceito da tela | Campo canônico |
| --- | --- |
| Produto / área | `product` |
| Linha | `receipt_department` |
| Divisão | `division` |
| Componente | `item_type` |
| Modelo | `item_code` |
| Ofensor | `account_alias` |
| Semana | semana ISO de `transaction_date` |

O mapeamento de “ofensor” deve ser homologado com o negócio antes da produção;
até lá, o contrato explicita a origem para evitar inferência silenciosa no
frontend.
