# Layouts

Estruturas de composição reutilizadas por páginas:

- layout principal com navegação;
- layout de autenticação;
- layout do modo TV sem controles pessoais;
- regiões de conteúdo, cabeçalho e navegação responsiva.

Layouts não consultam a API diretamente nem contêm regras de negócio. Eles
recebem estado de componentes/serviços e expõem pontos de composição.

O cadastro de seções, subseções e seus breadcrumbs está documentado no
[guia do dashboard shell](dashboard-shell/README.md).
