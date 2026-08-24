# Textos e títulos de páginas

A página de Perfil é a referência para textos de páginas internas. A fonte é
`Fustat, sans-serif`, já definida globalmente em `styles.css`; não declare outra
fonte no componente.

| Uso                          | Elemento         | Tamanho e linha                                 | Cor no tema claro                                                 |
| ---------------------------- | ---------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| Título da página             | `h1.page-title`  | 24px/32px no mobile; 32px/1.2 a partir de 640px | `#121217`                                                         |
| Título de seção ou card      | `h2`             | 20px/28px, peso 600                             | `#121217`                                                         |
| Texto principal e descrições | `p`              | 14px/20px                                       | `#6B7280` para descrição; `#121217` quando for conteúdo principal |
| Label e informação auxiliar  | `small` ou label | 12px/16px                                       | `#83899F`                                                         |

Os tokens correspondentes são `--app-page-title`, `--app-text-description` e
`--app-text-muted-detail`. No tema escuro eles assumem valores equivalentes com
contraste adequado; não use hexadecimais locais em novos componentes.

## Estrutura de uma seção funcional

Todo card ou área que representa uma função começa diretamente pelo seu título e,
quando necessário, uma descrição abaixo dele. Não adicione ícone decorativo antes
do título: o próprio texto deve comunicar a função.

```html
<article class="settings-card">
  <header class="settings-card-header">
    <h2>Idioma do sistema</h2>
    <p>Selecione o idioma de preferência para a interface.</p>
  </header>

  <!-- controles da seção -->
</article>
```

Ícones são permitidos apenas quando possuem função própria: ação em botão,
indicador de estado, navegação ou representação de um item. Um ícone não deve
ser usado apenas para decorar ou anteceder o título de card, seção ou área.

Use um único `h1` para a página, `h2` para suas seções e `h3` somente para um
subgrupo dentro de uma seção. Não pule níveis de heading.
