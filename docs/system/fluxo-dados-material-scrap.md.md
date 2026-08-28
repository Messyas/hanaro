sequenceDiagram
autonumber
participant SO as Smart Office / CRON
participant BOT as Bot Python
participant GERP as GERP
participant BCB as PTAX / Banco Central
participant API as API Hanaro
participant Q as Redis / Taskiq
participant W as Worker Hanaro
participant DB as PostgreSQL
participant FE as Frontend

    SO->>BOT: Iniciar execução agendada
    activate BOT
    BOT->>BOT: Criar execution_id e diretório isolado
    BOT->>GERP: Validar sessão e abrir relatório Material Scrap
    BOT->>GERP: Consultar Organization = ALL e janela de datas
    GERP-->>BOT: Request ID da solicitação

    loop Até concluir ou atingir timeout
        BOT->>GERP: Consultar Phase e Status do Request ID
        GERP-->>BOT: Running ou Completed / Normal
    end

    alt Requisição concluída normalmente
        BOT->>GERP: Baixar arquivo da execução
        GERP-->>BOT: TSV bruto sem extensão
        BOT->>BOT: Validar nome, tamanho e estabilidade do download
        BOT->>BOT: Ler TAB e CP1252/Latin-1 sem descartar linhas
        BOT->>BOT: Reconstruir REQ Comment e desambiguar Description
        BOT->>BCB: Solicitar PTAX de venda da data de processamento

        alt Cotação da data disponível
            BCB-->>BOT: Taxa BRL/USD e data efetiva
        else Cotação indisponível e fallback permitido
            BCB-->>BOT: Última taxa disponível + fallback_used
        end

        BOT->>BOT: Normalizar datas, textos e Decimal
        BOT->>BOT: Aplicar mapeamentos sem filtrar setores
        BOT->>BOT: Calcular amount_usd e gerar JSON canônico
        BOT->>BOT: Reconciliar linhas, totais e hashes
        BOT->>API: POST /api/v1/scrap/ingestions
        API->>Q: Enfileirar contrato canônico validado
        API-->>BOT: 202 Accepted + task_id ou erro de contrato
        Q->>W: Entregar lote
        W->>W: Reconciliar hashes, valores e contagens
        W->>W: Pré-calcular projeção do dashboard
        W->>DB: Transação: linhas + projeção + snapshot + revisão
        DB-->>W: Commit atômico
    else Erro, status anormal ou timeout
        BOT->>BOT: Registrar erro, Request ID e evidência
        BOT-->>SO: Encerrar execução como falha
    end

    deactivate BOT

    FE->>API: GET /api/v1/dashboard/scrap?year=...&currency=...
    API->>DB: Ler revisão e agregados ativos
    DB-->>API: KPIs e rollups pré-calculados
    API-->>FE: Contrato pronto: séries, rankings e metas
