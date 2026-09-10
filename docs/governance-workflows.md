# Relatórios, alertas e planos de ação

## Modelo e migrations

A migration `20260909_14` amplia o modelo existente sem substituir `Report`, `OutboxEvent`, `ConsumerReceipt`,
`ImprovementAction` ou as identidades de Scrap. Ela adiciona evidências publicadas, lease de exportação, planos,
participantes, vínculos fixos com versões publicadas, alertas, leitura individual, regras, avaliações, emails
simulados e tentativas de consumo. Ações legadas são migradas para planos próprios, com o estado anterior gravado
em `AuditEvent`; estados legados que não equivalem a uma validação humana ficam em `UNDER_VERIFICATION`.

`ImprovementAction` é a tarefa do Kanban. `ActionPlan` contém tarefas; `PlanReport` fixa exatamente a
`ReportVersion` que fundamentou o plano; `ActionParticipant` não cria hierarquia entre participantes. A conclusão
de tarefa exige o comando `validate` e a conclusão do plano é um comando manual independente.

## Contratos HTTP

- Relatórios: `/api/v1/reports`, versões, prévia, fontes e publicação mantêm os contratos existentes.
- Exportações: `POST /api/v1/report-versions/{id}/exports`, histórico paginado por versão, status, download e retry.
- Capacidades: `GET /api/v1/governance/capabilities` informa disponibilidade do worker, formatos e templates.
- Evidências: `GET /api/v1/report-evidence/{id}` exige autenticação e nunca revela a chave interna do storage.
- Alertas: `GET /api/v1/alerts` aceita tipo, severidade, período e leitura; `POST /alerts/{id}/read` altera somente a
  leitura do usuário atual.
- Configuração: `/api/v1/notification-rules` é restrito a superusuários e aceita somente enums, filtros e limites
  validados.
- Email simulado: `GET /api/v1/notification-emails` mostra conteúdo próprio ao usuário; superusuários podem
  inspecionar todas as simulações.
- Planos: `/api/v1/action-plans`, `/action-plans/{id}/tasks`, `/actions/{id}/commands` e `/actions/{id}/history`.
  Escritas usam `expected_version`; conflitos retornam HTTP 409.

## Catálogo de eventos e canais

| Evento | Sistema | Email simulado |
|---|---:|---:|
| `SCRAP_RELEVANT` | sim | sim |
| `COST_EXCEEDED` | sim | sim |
| `GOAL_ACHIEVED` | sim | sim |
| `INGESTION_FAILED` | sim | sim |
| `UPDATE_LATE` | sim | sim |
| `REPORT_EXPORT_FAILED` | sim | sim |
| `TASK_OVERDUE` | sim | sim |
| `TASK_ASSIGNED` | não | sim |
| `TASK_DUE` | não | sim |
| `TASK_VERIFICATION` | não | sim |
| `TASK_VALIDATED` | não | sim |
| `REPORT_EXPORT_COMPLETED` | não | sim, quando `notify_on_completion=true` |

Os comandos também gravam `PLAN_SAVED`, `TASK_SAVED`, `TASK_CHANGED`, `REPORT_EXPORT_REQUESTED`,
`REPORT_EXPORT_ACCESSED` e o histórico já existente de relatórios. Regras podem reduzir canais e destinatários.
Leitura não resolve alertas. Avaliações usam uma identidade estável por regra, janela e assunto; agravamentos,
cooldown e lembretes ficam separados pela sequência persistida.

## Worker, storage e recuperação

O worker Taskiq inicia um dispatcher periódico de 30 segundos. O fato de negócio e `OutboxEvent` são gravados na
mesma transação. O dispatcher usa consumo idempotente, tentativas persistidas, backoff limitado e erros
sanitizados. Uma aceitação do broker pode produzir entrega duplicada; o claim atômico e o token de lease do job
impedem duas renderizações de concluírem o mesmo job. Execuções abandonadas são retomadas e falham definitivamente
depois do limite. Nenhuma transação fica aberta durante renderização ou I/O de arquivos.

`scrap_review_images` e `report_artifacts` devem ser volumes compartilhados entre API e worker. A publicação copia
cada evidência para uma chave imutável, com SHA-256, MIME type, tamanho e nome congelados. Exportações usam escrita
atômica sem sobrescrita e verificam tamanho e SHA-256 no download. Um artefato ausente ou corrompido torna o job
falho e habilita uma nova tentativa.

Para desenvolvimento com worker:

```text
docker compose --profile worker up --build
```

Os emails continuam estritamente simulados. Consulte `/alertas`, abra “Email simulado” ou use
`GET /api/v1/notification-emails`; o campo `status` será `SIMULATED`, nunca `DELIVERED`. Um provider SMTP futuro
deve conservar a chave idempotente, mas não pode prometer exactly-once: existe uma janela entre a aceitação externa
e o commit local na qual o resultado é incerto.

## Validação ponta a ponta

1. Revise uma ocorrência na Base de Scrap, inclua evidência e publique um relatório.
2. Edite ou apague a evidência original e confirme que a versão histórica e sua evidência publicada continuam
   acessíveis.
3. Exporte CSV, PDF, PPTX e Markdown com opções diferentes; recarregue a página, acompanhe os jobs e valide os
   hashes no download.
4. Crie regras de Scrap individual e acumulado, ultrapassagem de custo e meta fechada. Execute o tick com
   `python -m src.modules.governance.notifications.worker` ou aguarde o worker; confirme dedupe, severidade, leitura
   individual e email `SIMULATED`.
5. Crie um plano a partir de uma versão publicada, adicione participantes e mova tarefas pelo drag-and-drop e pelos
   selects acessíveis. Passe por `UNDER_VERIFICATION`, valide, reabra e confira o histórico.
6. Faça duas escritas com a mesma versão e confirme que a segunda recebe 409 e mantém a edição local.

## Perfil sem worker e monitoramento externo

Quando `TASKIQ_ENABLED=false`, a API informa indisponibilidade e rejeita novas exportações antes de criar jobs.
Alertas periódicos e emails simulados também não são processados. Relatórios, versões históricas e planos continuam
disponíveis. O backend não consegue alertar sobre sua própria queda total; o contrato para monitor externo é o
endpoint `/health`, que deve ser consultado fora do processo e da infraestrutura do Hanaro.
