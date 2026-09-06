# 06 — Telas, jornadas e critérios de experiência

[Índice](README.md) · [Roadmap](07-roadmap-e-validacao.md)

Planejamento de interface baseado nas referências recebidas, nas rotas atuais e no tema existente. Não é uma implementação visual nem um redesenho aprovado. A identidade Hanaro, com superfícies claras/escuras, tipografia existente e cor de destaque, deve evoluir preservando consistência.

O uso do Impeccable orientou esta seção a partir de tarefas, hierarquia, estados e contexto de uso. O modo principal é operação: menos esforço para decidir e registrar o que aconteceu, sem pedir ao analista que entenda o schema técnico.

## 1. Navegação proposta

| Área | Tarefa principal | Observação |
| --- | --- | --- |
| Visão executiva | Entender perda, tendência, pendências e prioridades | Evolui o dashboard atual |
| Base de scrap | Consultar origem, rastrear valores e selecionar registros | Mantém visão de ocorrência |
| Casos e análises | Triar, investigar e decidir tratamento | “Minha fila” como entrada operacional |
| Ações de melhoria | Acompanhar execução e comprovar eficácia | Kanban e lista sobre o mesmo dataset |
| Relatórios | Preparar, publicar, emitir e consultar edições | Consulta avulsa não se confunde com documento oficial |
| Auditorias periódicas | Executar ciclos, examinar amostras e acompanhar achados | Separada da trilha técnica |
| Alertas | Reconhecer e tratar eventos relevantes | Agrupados por episódio/escopo |
| Execuções da automação | Investigar falha, replay e atraso do RPA | Preserva monitor atual |
| Configurações | Linhas, produção, políticas, metas, usuários e distribuição | Permissões por capacidade |
| Trilha de alterações | Consultar quem fez o quê e quando | Acesso de auditoria/admin; não precisa ocupar menu de todos |

Modo TV deve abrir uma superfície dedicada em tela cheia a partir da visão executiva. “Componentes” pode começar como análise detalhada filtrada do dashboard/base; só ganha área própria se houver tarefa/catálogo independente, não por constar no protótipo.

## 2. Jornada diária do analista

Entrada em “Minha fila”: obrigatórios vencidos, críticos, sem responsável e a vencer, com filtros de fábrica/linha/período. Itens opcionais e dispensados ficam acessíveis, mas não poluem o mesmo contador de pendências.

Cada linha mostra data, linha, problema/descrição de origem, impacto, obrigatoriedade e motivo, responsável e prazo. Selecionar permite abrir/criar caso ou aplicar template após prévia. Um indicador explica por que o item entrou na fila: “Obrigatório por recorrência — regra v3”.

Detalhe do caso deve ocupar página própria para investigação longa, com seções: visão geral; origem e ocorrências; análise; evidências; ações; documentos; histórico. Drawer serve para triagem rápida, não para todos os formulários e uma tabela complexa no mesmo painel estreito.

O analista compara dados de origem e classificação derivada sem editar a origem. Mudança recente no ERP exibe aviso com valores anteriores/atuais e o que precisa revalidar. Ações principais: salvar rascunho, submeter, publicar conforme permissão, devolver e reabrir com motivo.

Salvar rascunho não exige causa confirmada. Envio final destaca somente o que falta para aquela política. O formulário nunca deve exigir ação obrigatória quando a decisão válida é “sem ação necessária”.

## 3. Ações: evolução das duas primeiras referências

### Lista mestre

Preservar origem, produto/linha/posto, problema, responsável/prazo, status e efeito. Organizar colunas configuráveis e expansão do detalhe. Separar “custo dos casos vinculados”, “resultado observado” e “benefício validado”: a palavra “Antes/Atual/Efeito” sem métrica/janela é ambígua.

Gráficos superiores são resumo opcional recolhível. A tarefa primária é localizar e tratar atraso/bloqueio, por isso filtros e ações não podem ficar abaixo de um grande bloco de gráficos. Contadores devem refletir todo o filtro, não só a página carregada.

### Kanban

Colunas: Planejada, Em execução, Implementada, Em verificação, Eficaz. Canceladas aparecem em filtro/arquivo. Bloqueio é badge/faixa e filtro transversal; mostrar motivo e há quanto tempo.

Cartão: título, linha, dono, prazo, risco, quantidade de casos vinculados e próximo passo. Não colocar relatório completo, várias fotos ou todos os valores do caso no cartão. Abrir detalhe mostra evidências, checklist e plano de eficácia.

Arrastar solicita a mesma transição que o menu “Mover para”. Em transições com evidência obrigatória, abrir formulário curto antes de confirmar. Permitir uso integral por teclado. Atualização concorrente retorna aviso e recarrega o cartão; não desfazer edição de outra pessoa silenciosamente.

### Nova ação

Primeiro escolher origem: casos, achado de auditoria ou cadastro manual. Ao selecionar casos, herdar contexto como sugestão, permitindo escopo múltiplo quando necessário. Cadastro manual explica que não existe impacto financeiro de origem, sem criar valores fictícios.

Campos iniciais: título, condição observada, fábrica/linha, dono, prazo, risco. Causa raiz pode ser preenchida depois; 4M tem ajuda e não é obrigatório se desconhecido. Plano de eficácia pode ser proposto na criação e se torna obrigatório antes da verificação. Não pedir todas as evidências no primeiro passo.

## 4. Relatórios e emissão

Página com abas/tipos: casos, consolidados executivos e auditorias. Mostrar código, edição, escopo, período, status editorial, autoria/aprovação e disponibilidade de formatos. “Relatório publicado” e “arquivo gerado” são badges distintos.

Compositor orientado por template: contexto, dados selecionados, análise/conclusão, ações e anexos. Prévia aponta: filtros, corte, cobertura, itens sem revisão, dispensas e alterações de origem desde a análise. O usuário escolhe incluir seção apropriada, sem transformar registros sem revisão em análises fictícias.

Publicação apresenta resumo da edição e das pendências bloqueantes. Exportação posterior mostra progresso por formato, erro recuperável e data de expiração de arquivos de consulta. Download de edição antiga explica que existe uma mais recente sem redirecionar silenciosamente.

Distribuição pede destinatários/grupos efetivos e edição exata; agendamento permite revisar regra e periodicidade. Não enviar e-mail automaticamente ao salvar rascunho ou abrir relatório.

## 5. Auditoria periódica versus trilha de eventos

Auditoria periódica tem agenda e painel por ciclo: escopo, população, amostra, examinados, achados, respostas e conclusão. Abrir item amostral mostra a edição congelada e um link separado para situação atual. “Conforme”, “Não conforme” e “Não avaliado” exigem critério e, quando necessário, evidência.

A referência “Eventos imutáveis” vira Trilha de alterações: filtros por entidade/ator/período/correlação, detalhes antes/depois e motivo. Não exibir um número de eventos como percentual de conformidade da fábrica. Logs de rotina ficam distintos de decisões de negócio, com filtros para reduzir ruído.

Achados possuem dono e prazo; podem gerar uma ação nova ou vincular uma existente. Parecer final informa limitações, itens não examinados e plano de acompanhamento. Encerramento de auditoria com pendências autorizadas deve ser rotulado claramente.

## 6. Configurações: entrada manual de produção e catálogos

### Produção realizada — MVP confirmado

Grade por semana/mês: linhas nas linhas da grade, dias nas colunas, fábrica e período no topo. Cada célula distingue ausente, zero informado, rascunho, aguardando aprovação, aprovado e corrigido. Não depender exclusivamente de cor.

Permitir digitação/colagem com prévia, total por linha e detecção de duplicidade. Exibir unidade e regra de contagem: unidades acabadas, entradas em produção ou outra definição aprovada. Selecionar célula abre histórico, evidência, autor/aprovador e justificativa de correção.

Importação futura usa tela de reconciliação: dados iguais, novos e conflitantes; origem manual/automática; regra aplicada. Usuário pode aprovar em lote dentro do próprio escopo, com resultado por célula. Ranking mostra “produção pendente de aprovação” quando necessário.

### Linhas, postos e vigência

Catálogo mostra linha física, código externo mapeado, fábrica, atividade e versão do layout. “Configurar mapa” abre editor com postos e ordem; publicação de layout escolhe data de vigência. Eventos antigos continuam associados ao layout do período, não ao mapa atual por acidente.

### Políticas e notificações

Regras de revisão e regras de alerta ficam em seções distintas. Cada editor tem condições, escopo, vigência, prioridade, simulação e histórico. Toggle de habilitação não deve apagar a configuração.

“CRUD de destinatários” vira “Destinatários e distribuição”. Grupos, categorias e escopo são legíveis; mostrar destinatários resultantes antes de enviar. Preferência de comunicação não deve ser chamada automaticamente de consentimento jurídico: a organização define a política apropriada. Mudanças preservam histórico das entregas já realizadas.

## 7. Modo TV

Superfície de consumo à distância, sem sidebar nem tabelas densas. Exibir período, grupo de comparação, indicador/unidade, ranking, evolução e data de cobertura. Destacar avanço das linhas, não pessoas culpadas. Todos os participantes aparecem por rotação/páginas; top 5 isolado não atende “todas as linhas”.

Dimensionar tipografia com teste no equipamento e distância reais. Começar com poucos elementos: ranking e tendência curta; alternar telas automaticamente com intervalo configurável. Evitar animações constantes, números piscando ou transições que dificultem leitura.

Quando falta produção/cobertura, colocar linha em “dados pendentes”, fora das posições competitivas. Última geração válida pode permanecer visível com aviso de atualização atrasada. Falha de rede não substitui o resultado por zero. Modo offline nunca apresenta informação velha como recém-atualizada.

Permitir projeção preliminar diária e resultado mensal fechado, claramente distintos. Após correção, mostrar revisão do ranking e política de contestação; não mudar vencedor histórico sem rastreabilidade. Publicação competitiva usa regras divulgadas para evitar incentivo a subnotificação.

## 8. Estados obrigatórios em todas as telas

| Estado | Comportamento |
| --- | --- |
| Carregando | Skeleton/feedback sem inventar números |
| Sem resultados do filtro | Explicar filtro e oferecer limpar; não sugerir ausência de dados na fábrica |
| Dados não disponíveis | Identificar fonte/produção/mapeamento faltante |
| Sem permissão | Explicar capacidade necessária sem expor conteúdo restrito |
| Conflito de versão | Mostrar mudança, permitir recarregar/comparar; preservar rascunho local quando possível |
| Falha de exportação | Manter edição, mostrar erro compreensível e tentar novamente |
| Operação parcial em lote | Resultado por item e total aplicado/não aplicado |
| Período fechado | Consulta permitida; correção abre fluxo de retificação |
| Texto/anexo longo | Expansão, paginação e limite definido, sem cortar informação essencial |

Filtros compartilháveis por URL, labels persistentes, foco visível, contraste validado, mensagens associadas ao campo e navegação por teclado são critérios de aceite. Estados usam texto/ícone além de cor. Ações destrutivas ou de publicação mostram contexto suficiente para decisão; rascunhos simples não precisam de confirmação repetitiva.

## 9. Integração com o frontend existente

Reutilizar shell, tema, filtros, paginação, alerts e componentes de lista já presentes. Criar rotas carregadas por área e serviços de domínio; não aumentar indefinidamente `settings-page.ts` e `dashboard.store.ts` para conter todo o sistema.

Stores de tela cuidam de filtros, seleção, carregamento e estado de edição. Fórmulas oficiais, elegibilidade e autorização ficam no backend. DTO de API e modelo de formulário podem ser diferentes, mas conversões devem ter nomes claros e testes de contrato.

Preservar pt-BR/en/ko previstos no projeto. Códigos de estado são estáveis e traduzidos na apresentação. Datas/moedas respeitam o locale e a política do relatório; exportações guardam o locale usado na edição. Não duplicar regra financeira em tradução ou label.

## 10. Validação de usabilidade antes do aceite

Executar cenários com analista, responsável de ação, auditor e gestor: dispensar item elegível; agrupar o incidente da esteira; emitir relatório sem ação; mover ação com evidência faltante; corrigir produção; examinar item de auditoria; localizar linha inelegível na TV.

Medir onde usuários hesitam e corrigem dados, não apenas se conseguem clicar. A homologação deve verificar que entendem diferença entre obrigatório/opcional, concluído/eficaz, dado atual/publicado e custo absoluto/taxa. Essas distinções sustentam a governança mais que uma nova paleta de cores.
