# Backlog do KPI de eficiência relativa

Backlog incremental para ativar a aba manual de produção e, depois, evoluir o cálculo relativo. As tarefas estão ordenadas para que as primeiras possam ser executadas com baixo risco e pouca dependência.

## Como usar

Envie o código da tarefa que deseja executar, por exemplo: `implemente KPI-03`. Cada tarefa deve ser implementada, revisada e validada antes de iniciar a próxima.

## Tarefas simples — primeira sequência

| ID | Tarefa | Resultado esperado | Dependências | Status |
| --- | --- | --- | --- | --- |
| KPI-01 | Confirmar textos e nomes do KPI | Definir “valor da produção”, “quantidade produzida” e nome da taxa | Nenhuma | Backlog |
| KPI-02 | Adicionar a aba visual de Configurações | Nova aba “Produção e eficiência” aparece na navegação, inicialmente sem persistência | Nenhuma | Concluída |
| KPI-03 | Criar o modelo de formulário mensal | Grade de janeiro a dezembro com valor, quantidade e observação | KPI-02 | Concluída |
| KPI-04 | Adicionar validação local | Bloquear negativos e valores inválidos sem chamar a API | KPI-03 | Concluída |
| KPI-05 | Adicionar estados da tela | Loading, vazio, parcial, erro, sucesso e somente leitura | KPI-03 | Concluída |
| KPI-06 | Adicionar traduções da aba | Textos em português, inglês e coreano | KPI-02 | Concluída |
| KPI-07 | Criar contrato TypeScript da medição | Tipos para métrica, período, origem, status e versão | Nenhuma | Concluída |
| KPI-08 | Criar serviço frontend de medições | Métodos de leitura e gravação em lote conectados à API | KPI-07 | Concluída |
| KPI-09 | Criar schema backend de leitura/escrita | Contratos FastAPI para medições mensais | KPI-07 | Concluída |
| KPI-10 | Criar migration da medição mensal | Tabela versionada para valor da produção e quantidade agregada | KPI-09 | Concluída |
| KPI-11 | Criar endpoint de leitura | Carregar o ano selecionado na nova aba | KPI-09, KPI-10 | Concluída |
| KPI-12 | Criar endpoint de gravação em lote | Salvar alterações com controle de versão e auditoria | KPI-11 | Concluída |
| KPI-13 | Conectar a aba à API | Trocar estado local pelo dado persistido, mantendo feedback de erro | KPI-08, KPI-12 | Concluída |
| KPI-14 | Exibir cobertura no dashboard | Mostrar meses informados, pendentes e origem dos dados | KPI-13 | Backlog |
| KPI-15 | Corrigir estado de ausência do KPI relativo | Diferenciar dado ausente, zero e taxa não calculável | KPI-14 | Concluída |

## Tarefas simples — ativação do cálculo global

| ID | Tarefa | Resultado esperado | Dependências | Status |
| --- | --- | --- | --- | --- |
| KPI-16 | Criar serviço de cálculo do denominador | Resolver valor/quantidade por mês, ano e escopo global | KPI-12 | Concluída |
| KPI-17 | Calcular taxa financeira mensal | IF Cost / valor da produção × 100 no backend | KPI-16 | Concluída |
| KPI-18 | Calcular taxa física mensal | Scrap / quantidade produzida × 100 para a medida física padronizada do MVP | KPI-16 | Concluída |
| KPI-19 | Calcular acumulado anual ponderado | Somar numeradores e denominadores antes de dividir | KPI-17, KPI-18 | Concluída |
| KPI-20 | Adicionar comparação com ano anterior | Calcular variação da taxa somente quando houver referência válida | KPI-19 | Concluída |
| KPI-21 | Evoluir contrato das séries do dashboard | Retornar denominador, taxa e estado relativo | KPI-17, KPI-18 | Concluída |
| KPI-22 | Consumir o novo contrato no frontend | Remover zeros provisórios e usar os dados oficiais da API | KPI-21 | Concluída |
| KPI-23 | Desativar relativo em semana/filtros incompatíveis | Mostrar explicação sem inventar distribuição mensal ou por linha | KPI-22 | Backlog |
| KPI-24 | Criar testes do cálculo | Cobrir ausência, zero, arredondamento e soma ponderada | KPI-17 a KPI-23 | Backlog |

## Tarefas futuras — granularidade e integrações

| ID | Tarefa | Resultado esperado | Dependências | Status |
| --- | --- | --- | --- | --- |
| KPI-25 | Operacionalizar produção por linha/dia | Usar `gov_production_versions` como fonte aprovada | KPI-24 | Backlog |
| KPI-26 | Adicionar escopo de fábrica e linha | Permitir filtros compatíveis com o denominador | KPI-25 | Backlog |
| KPI-27 | Ativar série semanal | Calcular semanas a partir de dados diários compatíveis | KPI-25 | Backlog |
| KPI-28 | Ativar ranking relativo por linha | Exibir apenas linhas elegíveis e com cobertura suficiente | KPI-26 | Backlog |
| KPI-29 | Criar adaptador ERP/Financeiro | Importar valor da produção com origem e idempotência | KPI-24 | Backlog |
| KPI-30 | Criar adaptador MES/produção | Importar quantidade produzida por linha/dia | KPI-25 | Backlog |
| KPI-31 | Definir indicador dependente de RH | Aprovar fórmula por hora trabalhada ou efetivo antes de integrar RH | KPI-24 | Backlog |
| KPI-32 | Criar adaptador RH/ ponto | Importar somente totais agregados necessários ao novo indicador | KPI-31 | Backlog |
| KPI-33 | Criar reconciliação manual versus automática | Tratar conflitos sem sobrescrever confirmação manual silenciosamente | KPI-29, KPI-30 | Backlog |

## Critério para concluir cada tarefa

Uma tarefa só deve ser marcada como concluída quando:

1. o comportamento estiver implementado no escopo da tarefa;
2. os casos de erro relevantes estiverem tratados;
3. testes ou validação manual proporcional ao risco tiverem sido executados;
4. a documentação ou contrato afetado estiver atualizado;
5. não houver alteração silenciosa em tarefas posteriores.

## Primeira tarefa recomendada

`KPI-01` é a menor tarefa e elimina a principal ambiguidade de negócio: confirmar se o denominador financeiro é realmente **valor da produção** ou se deve representar outro conceito financeiro. Depois dela, `KPI-02` pode ser executada isoladamente para criar a aba visual.
