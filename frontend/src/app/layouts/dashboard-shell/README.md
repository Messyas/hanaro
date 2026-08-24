# Sidebar e breadcrumbs

O `DashboardShell` usa a mesma árvore `navigation` para montar a sidebar e o
breadcrumb. Uma entrada sem `children` gera um breadcrumb simples, como
`[gráfico] Dashboard`. Uma entrada com filhos gera a trilha completa, como
`[loja] Sua Loja / [sacola] Produtos`.

## Cadastrar uma seção com subseções

Primeiro, registre as rotas filhas em `app.routes.ts`. O caminho do pai redireciona
para a subseção padrão para que o clique em "Sua Loja" sempre abra uma tela válida:

```typescript
{
  path: 'loja',
  children: [
    { path: '', pathMatch: 'full', redirectTo: 'produtos' },
    {
      path: 'produtos',
      title: 'Produtos',
      loadComponent: () =>
        import('./pages/products/products-page').then((module) => module.ProductsPage),
    },
  ],
},
```

Depois, inclua a mesma hierarquia em `navigation` dentro de
`dashboard-shell.ts`:

```typescript
const t = this.language.translations();

{
  path: '/loja',
  icon: 'store',
  label: t.navStore,
  children: [
    {
      path: '/loja/produtos',
      icon: 'shopping-bag',
      label: t.navProducts,
    },
  ],
},
```

Com esse cadastro:

- a sidebar exibe "Sua Loja" e "Produtos" como submenu;
- o pai permanece selecionado enquanto uma rota filha está aberta;
- o breadcrumb é derivado automaticamente, sem HTML específico por página;
- o último item recebe `active` e `aria-current="page"`;
- cada texto pode encolher e usar reticências sem deformar os ícones de `17px`.

`icon` identifica o ícone usado na sidebar e no breadcrumb. Quando os dois
lugares precisarem de desenhos diferentes, informe também `breadcrumbIcon`:

```typescript
{
  path: '/dashboard',
  icon: 'home',
  breadcrumbIcon: 'chart-columns',
  label: t.navDashboard,
}
```

Os nomes aceitos pertencem ao tipo `IconName` em `ui-icon.ts`. Para um desenho
novo, adicione o nome ao tipo e um novo `@case` SVG no mesmo componente. Não
carregue uma segunda biblioteca de ícones apenas para uma entrada da navegação.

Cadastre `navStore` e `navProducts` em `AppTranslations` e nos catálogos `pt`,
`en` e `ko`. Labels da sidebar e do breadcrumb devem vir de
`language.translations()` para mudar imediatamente com o idioma; `$localize` não
é usado nessa árvore reativa.

## Menu do perfil

O shell é público. Sem sessão, o rodapé exibe `Entrar` no lugar da identidade; o
botão abre `LoginDialog`, sem navegar para uma tela exclusiva. Dashboard e suporte
continuam disponíveis, enquanto itens com `requiresAuthentication` ficam ocultos
e suas rotas usam `authenticatedGuard`.

Depois do login, o rodapé mostra a identidade devolvida por `check-auth`. O item
`Perfil` não aparece na navegação principal: ele é marcado com
`visibleInSidebar: false` para ser exibido apenas no menu dos três pontos. Esse
menu usa Angular CDK Menu e oferece `Perfil` e `Sair`.

`Configurações` é uma rota pública visível na sidebar e contém tema e idioma.
`Perfil` é autenticado e contém somente os dados pessoais e operacionais do
usuário. O contrato completo está no
[guia de Perfil, configurações e idiomas](../../../../docs/profile-settings-i18n.md).

`Sair` chama `POST /api/v1/auth/logout`, aproveitando a proteção XSRF configurada
no `HttpClient`, e retorna ao dashboard público quando a sessão é encerrada (ou
quando ela já não existe).

Antes do logout, abra `LogoutConfirmDialog` com o Angular CDK Dialog. A modal usa
overlay com backdrop opaco e desfoque, fica centralizada e oferece `Cancelar` e
`Sim, sair.`. O botão de voltar, o botão de fechar, `Escape` e um clique no
backdrop cancelam a ação; apenas a confirmação positiva chama o endpoint.

## Brilho da logo

No hover, a logo recebe um gradiente branco animado e recortado pela transparência
do próprio SVG. A variável `--brand-logo-shimmer-mask` deve acompanhar exatamente
o arquivo visível: assinatura latina para português/inglês, assinatura coreana
para coreano e símbolo compacto quando a sidebar estiver recolhida. As versões
clara e escura também possuem máscaras próprias.

Não aplique o gradiente diretamente ao container, pois isso cria um retângulo de
brilho nas áreas transparentes. Em `prefers-reduced-motion: reduce`, o efeito fica
desativado.

## Animação dos ícones de páginas

Todos os ícones dos links de páginas usam a mesma SVG Line Drawing Animation no
hover e no foco de teclado. A classe `nav-page-icon` limita o efeito ao ícone
principal, sem atingir chevrons ou outros controles da navegação.

O contrato para criar, adaptar e testar esses ícones está no
[guia de animação dos ícones da sidebar](../../../../docs/sidebar-icon-animation.md).

## Regras visuais

- Ícone: `17px × 17px`, com `flex-shrink: 0`.
- Espaçamento entre ícone, texto e separador: `12px`.
- Desktop (`>= 768px`): texto `18px`, linha `28px`.
- Mobile: texto `12px`, linha `16px`.
- Ancestrais usam a cor secundária; a página atual usa
  `--app-breadcrumb-text`.
- O separador `/` é apenas visual e deve permanecer com `aria-hidden="true"`.
- Caminhos de filhos devem começar pelo caminho do pai, por exemplo
  `/loja/produtos` dentro de `/loja`.
