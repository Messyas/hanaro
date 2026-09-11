# Validação, implantação e critérios de entrega

[Índice](README.md) · [Backlog](01-backlog.md).

## Dataset de homologação

Criar fixture pequena, identificada como sintética, com duas linhas, dois períodos comparáveis, uma ocorrência não revisada, uma ocorrência excluída do indicador, ajuste/estorno, uma duplicidade de fonte, duas ações sobre um caso, uma foto antes/depois, mês com cobertura parcial e meta global incompatível com filtro de linha.

Calcular resultados esperados independentemente do serviço implementado. Acrescentar produção conhecida e ausente no incremento C. Não copiar fórmulas da implementação para produzir os valores esperados.

## Matriz de validação

| Cenário | Resultado exigido | Camada / backlog |
| --- | --- | --- |
| Fechamento inclui item sem review | Custo entra; cobertura de análise permanece parcial | Serviço + API / 004 |
| Remover caso destacado | Total financeiro não muda | Serviço + UI / 004, 008 |
| Mesma ocorrência em duas fontes | Custo contado uma vez | Domínio + integração / 004, 006 |
| Meta anual e corte parcial | Meta do recorte ou indisponível; sem atingimento anual enganoso | Cálculo / 001, 004 |
| Sem carga confirmada | Desconhecido/parcial, não zero | Cobertura / 003 |
| Linha sem mapeamento | Bucket explícito; sem atribuição inventada | SQL + UI / 003 |
| Pareto | Soma categorias + demais + não classificado fecha com universo | Cálculo / 004, 013 |
| Edição concorrente | 409 e conteúdo local recuperável | API + frontend / 002, 008 |
| Fonte alterada após prévia | Publicação revalida e pede atualização | PostgreSQL / 006 |
| Dois pedidos iguais de publicação | Uma edição e recibo consistente | PostgreSQL / 006 |
| INSERT em snapshot selado | Rejeitado, inclusive corrida com selamento | PostgreSQL real / 006 |
| Análise ligada à edição | Vínculo inserido antes de published_at; escopo validado | PostgreSQL / 012, 013 |
| Fonte corrigida após publicação | Documento/valores anteriores permanecem | Integração / 006, 010 |
| Fotografia selecionada | Bytes incorporados, proporção e legenda corretas | Artefato / 005, 009 |
| Fonte original removida | Edição antiga usa cópia preservada | Storage + export / 005, 009 |
| Seleção além de 100 itens | Paginação e seleção funcionam sem truncamento | API + UI / 008 |
| Valores iguais em saídas | Prévia/edição/PPTX/PDF reconciliam no mesmo dataset | Artefato / 009 |
| Tarefa concluída sem medição | Eficácia não avaliada | Domínio + UI / 015 |
| Duas ações contribuem para ganho | Benefício único, sem soma duplicada | Cálculo / 015 |
| Produção em granularidade diferente | Erro tipado, sem taxa enganosa | Serviço / 014, 015 |
| Implantações diferentes por linha | Estado local, sem declarar conclusão global | Serviço + documento / 017 |
| Fonte complementar ausente | IF Cost incompleto explícito | Serviço + documento / 019 |
| Worker indisponível | UI informa indisponibilidade; não cria job impossível de executar | API + UI / 011 |
| Retry/worker duplicado | Lease e fencing preservados; um artefato associado | Integração / 020 |

## Arquivos de testes propostos

Backend: ampliar `backend/tests/unit/modules/governance/test_reports.py` e `test_workflows.py`; criar `test_report_calculations.py`, `test_report_composition.py`, `test_report_readiness.py`, `test_report_document_v2.py`, `test_effectiveness.py`. Criar testes de integração PostgreSQL para migrations, concorrência e guards em pasta de integração conforme convenção do projeto; não declarar SQLite como prova desses mecanismos.

Frontend: ampliar specs de ReportsService/ReportsPage; adicionar testes da store, formulário de escopo, seletores paginados, prévia stale e painel de exportação. Testar interação, acessibilidade e estados de erro; não cada propriedade interna.

Artefatos: abrir ZIP/XML de PPTX para confirmar blocos, imagens e valores; conferir PDF extraído; renderizar amostra representativa e inspecionar cada slide/página para overflow, fotos e caracteres PT/EN/KO. Prefixo `PK` sozinho não valida conteúdo. Gerar amostras com texto longo, várias ações e imagens de proporções diferentes.

## Critérios por incremento

### A — Primeiro fechamento

REL-001 a 011 entregues, M01–M04 aplicadas e regressão V1 aprovada. Usuário escolhe período, confere cobertura, inclui ações/fotos, publica e abre uma apresentação utilizável. Relatório antigo continua acessível. Sem afirmação de causa/eficácia não sustentada.

### B — Investigação

M05 e REL-012/013 entregues. Campos estruturados alimentam casos e Pareto; análise publicada tem revisão e evidência; não classificados continuam visíveis.

### C — Resultado

M06 e REL-014/015 entregues. Produção aprovada, janelas comparáveis e avaliações reproduzíveis. Resultados conjuntos deduplicados e limitações explícitas.

### D — Programa

M07–M09 entram conforme os respectivos itens. Charter, riscos e custos só são habilitados com fontes/configuração necessárias. Cada ampliação preserva snapshots publicados.

## Implantação

1. Confirmar head Alembic e compatibilidade dos readers V1/V2.
2. Aplicar migrations aditivas e validar guards/dados históricos em homologação.
3. Implantar backend que lê ambos os schemas, mantendo escrita V2 desabilitada até o frontend correspondente estar pronto.
4. Preparar catálogos, mapeamento, metas e confirmação de cobertura. Não inserir dados da apresentação como registros reais automaticamente.
5. Implantar frontend e worker compatíveis; expor capabilities suportadas.
6. Rodar fechamento piloto com dataset conhecido e comparar com cálculo independente.
7. Habilitar V2 gradualmente; registrar erros, duração de consulta/exportação, memória e volume dos arquivos.
8. Em regressão, desabilitar novas escritas V2, mantendo leitura das edições criadas; não apagar tabelas/documentos para fazer rollback.

Se uma feature flag for necessária, usar configuração existente ou simples capability do backend. Não adicionar plataforma externa como dependência desta entrega.

## Comandos e verificações durante a implementação

Usar os scripts de desenvolvimento/teste do projeto e Docker conforme README. Antes de alterar migrations, executar Alembic heads/history no ambiente backend. Para mudanças Angular, executar testes pertinentes e `npm run build` no ambiente frontend. Após código alterado, executar `python -m graphify update .` no ambiente em que Graphify estiver disponível.

Não houve alteração de código nesta entrega documental; portanto não foram executados build, migrations ou testes de aplicação. A verificação desta etapa cobre arquivos Markdown, links locais, presença dos itens do backlog e consistência da especificação.

## Decisões em aberto, com responsável funcional

| Decisão | Responsável a designar | Bloqueia |
| --- | --- | --- |
| Definição material scrap/IF Cost, sinal, elegibilidade e câmbio | Controle de custos + dono do produto | REL-001/004 |
| Calendário e autoridade de fechamento/cobertura | Operação + dono dos dados | Fechamento declarado completo |
| Escopos de meta e importação do legado | Administrador + controle de custos | Comparação com meta |
| Critérios de causa confirmada e eficácia | Engenharia/qualidade | REL-012/015 |
| Fonte de produção e granularidade | Operação | Taxas normalizadas |
| Demais componentes de IF Cost | Controle de custos | REL-019 |

As responsabilidades acima são papéis funcionais propostos, não novos privilégios já aprovados no sistema. A política atual de acesso continua sendo a referência até decisão explícita de mudança.
