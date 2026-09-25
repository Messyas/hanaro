# Reports

Feature responsável pelo catálogo, edição, fontes, prévia, publicação, exportação
e fechamento de relatórios.

- `catalog/`: lista paginada e histórico.
- `editor/`: edição de rascunhos.
- `sources/`: busca e vínculo de fontes.
- `preview/`: prévia do dossiê e visualização.
- `publication/`: publicação de versões.
- `export/`: exportação assíncrona e download no navegador.
- `period-close/`: montagem e publicação do fechamento de período.

Os caminhos de rota são declarados em `reports.routes.ts` e compostos sob as
políticas de autenticação em `app.routes.ts`. Tipos compartilhados dentro da
feature continuam em `reports.models.ts`; `reports.public-api.ts` expõe somente
os serviços de catálogo e publicação usados por outras features.
