# Layouts

Estruturas de composição reutilizadas por páginas:

- `main-layout/`: navegação, cabeçalho, regiões de conteúdo e breadcrumbs.

Outros layouts são criados quando houver composição visual própria. O layout
principal usa a API pública da funcionalidade de autenticação para abrir o login.

Layouts não consultam a API diretamente nem contêm regras de negócio. Eles
recebem estado de componentes/serviços e expõem pontos de composição.

O cadastro de seções, subseções e seus breadcrumbs está documentado no
[guia do layout principal](main-layout/README.md).
