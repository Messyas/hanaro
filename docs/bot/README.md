# Diagramas do bot

O arquivo [material-scrap-current-state.puml](material-scrap-current-state.puml)
descreve o estado atual da simulacao do bot em orientacao vertical. Ele pode
ser aberto por extensoes PlantUML do VS Code ou de outro visualizador local.

O processamento e a normalizacao acontecem em `automation/`. O backend recebe
somente o JSON canonico; a automacao visual real do GERP permanece como um
adaptador futuro.

A ingestao e exclusivamente assincrona: a API coloca o lote no Redis/Taskiq e
o worker executa a persistencia no PostgreSQL. Nao existe mais caminho sincrono
de escrita.

O diagrama [material-scrap-data-architecture.puml](material-scrap-data-architecture.puml)
mostra o fluxo de dados e as entidades persistidas: o bot, a API/backend,
PostgreSQL, Redis e o servidor que hospeda o frontend.
