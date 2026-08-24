# Conteúdo e títulos de página

Páginas internas de detalhe, formulário e listagem usam um único `h1` visível
com a classe global `page-title`. O título identifica a tela por si só: o
cabeçalho não recebe kicker, subtítulo nem parágrafo explicativo. Nomes de cards
e seções internas continuam em `h2` ou `h3`, respeitando a hierarquia do documento.

```html
<section class="page-stack" aria-labelledby="products-title">
  <header>
    <h1 class="page-title" id="products-title">Produtos</h1>
  </header>

  <div><!-- conteúdo da página --></div>
</section>
```

`page-title` concentra a apresentação do `h1`:

- mobile: `24px` de fonte e `32px` de linha;
- telas a partir de `640px`: `32px` de fonte e linha `1.2`;
- peso `600`;
- espaçamento entre letras `-0.025em`;
- margem e padding zerados;
- `#121217` no tema claro, por meio de `--app-page-title`;
- cor clara equivalente no tema escuro, preservando contraste.

O espaçamento vertical não pertence ao `h1`. Use `page-stack` no container para
obter fluxo em coluna e `gap: 24px`. O próximo elemento após o cabeçalho deve ser
o conteúdo da página, como uma grade de cards, formulário ou lista. Ações podem
ficar alinhadas na própria região de conteúdo, mas não acompanham texto descritivo
no cabeçalho.

## Quando não exibir o título

Uma visão agregada, como um dashboard composto apenas por indicadores e widgets,
pode omitir o `page-title` visível quando o breadcrumb do shell já fornece o
contexto. Não renderize um `h1` vazio. Cada widget deve manter seu próprio título
sem pular arbitrariamente a hierarquia de headings.

Para páginas de detalhe, formulários, configurações e listagens, o `h1` é o
padrão e não deve ser substituído por texto visual em uma `div` ou `span`.
