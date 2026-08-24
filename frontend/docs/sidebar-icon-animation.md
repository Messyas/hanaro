# Animação dos ícones da sidebar

Os links que levam às páginas da aplicação usam uma **SVG Line Drawing
Animation** no hover e no foco de teclado. O desenho é feito apenas com CSS: não
depende de JavaScript, rolagem da página ou animação infinita.

## Contrato do SVG

Cada parte desenhável do ícone deve ser um elemento `path` independente com
`pathLength="1"`:

```html
<ui-icon class="nav-page-icon" name="chart-bar" />

<!-- Dentro do componente ui-icon -->
<path pathLength="1" d="..." />
<path pathLength="1" d="..." />
<path pathLength="1" d="..." />
```

O `pathLength="1"` normaliza caminhos de tamanhos diferentes. Assim,
`stroke-dashoffset: 1` sempre esconde o caminho inteiro e
`stroke-dashoffset: 0` sempre exibe o desenho completo.

Não adicione `stroke` a um ícone criado com `fill` para forçar o efeito. Nesse
caso, crie ou escolha uma versão outline adequada. Sem `pathLength="1"`, os
valores `1 1` produzem pequenos tracejados que parecem girar em vez de revelar o
ícone.

## Gatilho e movimento

O link recebe a classe `nav-button` e somente seu ícone principal recebe
`nav-page-icon`. Essa separação impede que chevrons, menus e outros controles
sejam animados por acidente.

```css
.nav-button .nav-page-icon svg path {
  stroke-dasharray: 1 1;
  stroke-dashoffset: 0;
}

.nav-button:hover .nav-page-icon svg path,
.nav-button:focus-visible .nav-page-icon svg path {
  animation: sidebar-page-icon-line-draw 420ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes sidebar-page-icon-line-draw {
  from {
    stroke-dashoffset: 1;
  }

  to {
    stroke-dashoffset: 0;
  }
}
```

Os caminhos são revelados em sequência, com intervalos de `60ms`. O CSS atual
define atrasos para até quatro `path`: `0ms`, `60ms`, `120ms` e `180ms`. Ao criar
um ícone com mais partes, estenda conscientemente os seletores `nth-child` ou
reduza a quantidade de caminhos para preservar o ritmo.

## Escopo e acessibilidade

- A animação vale para todos os botões de páginas da sidebar.
- Breadcrumbs, chevrons, perfil e botões utilitários não usam esse efeito.
- Hover e `focus-visible` têm o mesmo comportamento.
- Com `prefers-reduced-motion: reduce`, a animação é desativada e o ícone continua
  completamente visível.

## Checklist para um novo item

1. Cadastre o ícone em `IconName` e no template de `ui-icon.ts`.
2. Separe as partes visuais em elementos `path` com `pathLength="1"`.
3. Use o ícone como filho de `nav-button` com a classe `nav-page-icon`.
4. Verifique hover, foco por teclado, estado ativo e preferência por movimento
   reduzido.

O ícone `cog` de Configurações segue o mesmo contrato: engrenagem externa e
círculo central são dois `path` normalizados. Não volte a usar `circle` nesse
ícone sem ampliar também os seletores da animação, pois hoje o efeito é
intencionalmente restrito a `path`.
