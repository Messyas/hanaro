# Shared

Componentes visuais, pipes, directives e tipos reutilizados por funcionalidades
independentes.

Um item compartilhado:

- não conhece endpoints;
- não depende de uma feature específica;
- usa tokens do tema;
- possui API de entrada/saída tipada;
- inclui testes de comportamento e acessibilidade.

Componentes usados por apenas uma funcionalidade permanecem dentro do módulo.
Os componentes compartilhados ficam em `components/` e os tokens visuais em
`styles/`. `shared/` não importa `core/`, `layouts/` nem `modules/`.
