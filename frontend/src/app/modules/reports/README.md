# Reports

Feature responsável pelo catálogo, edição, fontes, prévia, publicação, exportação
e fechamento de relatórios.

- `catalog/`: componente do catálogo, lista paginada, criação e histórico.
- `editor/`: edição de rascunhos.
- `sources/`: busca, vínculo e seleção de fontes no drawer.
- `preview/`: prévia do dossiê e visualização.
- `publication/`: publicação de versões.
- `export/`: histórico de versões, exportação assíncrona e download no navegador.
- `period-close/`: montagem e publicação do fechamento de período.

Os caminhos de rota são declarados em `reports.routes.ts` e compostos sob as
políticas de autenticação em `app.routes.ts`. Tipos compartilhados dentro da
feature continuam em `reports.models.ts`; `reports.public-api.ts` expõe somente
os serviços de catálogo e publicação usados por outras features.

`ReportsPage` coordena a navegação e o workspace. `ReportCatalog` mantém os
filtros, a paginação e o formulário de criação, e emite o ID do relatório aberto.
`ReportVersionHistory` apresenta as revisões e cuida das opções e tarefas de exportação.
`ReportSourceDrawer` mantém a seleção visual de fontes e solicita à página a busca
e a gravação das escolhas.
