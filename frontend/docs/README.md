# Guia de desenvolvimento do frontend

Este documento define o padrão para novas telas e integrações Angular. O desenho
segue o guia DXi sem criar camadas antes de existir uma responsabilidade real.

## Estrutura

```text
src/app/
├── core/       serviços globais, autenticação, guards e interceptors
├── modules/    funcionalidades e páginas
├── layouts/    estruturas de navegação e composição de páginas
└── shared/     componentes e utilitários reutilizáveis sem regra de negócio
```

O código existente pode migrar para essa estrutura conforme cada funcionalidade
for alterada. Uma mudança não deve mover arquivos sem benefício funcional ou sem
cobertura de testes.

## Modelo de acesso

Consulte também o [modelo de acesso canônico](../../docs/modelo-de-acesso.md),
que separa explicitamente dashboard/TV públicos, relatórios autenticados,
aliases administrativos, perfil e provisionamento de contas.

| Superfície    | Identidade                       | Regras                                                      |
| ------------- | -------------------------------- | ----------------------------------------------------------- |
| Dashboard     | anônimo                          | somente leitura e sem dados pessoais                        |
| Modo TV       | anônimo                          | somente leitura, sem sessão e sem controles administrativos |
| Relatórios    | sessão autenticada               | dados detalhados; backend também deve exigir autenticação    |
| Aliases       | sessão / superusuário            | leitura compartilhada; escrita somente administrativa       |
| Perfil        | sessão autenticada               | leitura e alteração apenas do próprio usuário               |
| Administração | superusuário/role administrativa | interface separada e eventos auditáveis                     |

Elementos visuais e guards melhoram navegação, mas o backend continua sendo a
fonte de autorização para cada operação.

## HTTP, sessão e CSRF

`app.config.ts` fornece `HttpClient` com `withFetch()` e configura o contrato do
`crudauth`:

```typescript
withXsrfConfiguration({
  cookieName: 'csrf_token',
  headerName: 'X-CSRF-Token',
});
```

- [ ] Usar URLs relativas iniciadas por `/api/v1/`.
- [ ] Deixar o navegador transportar o cookie `session_id` `HttpOnly`.
- [ ] Manter JWT e session ID fora de `localStorage`,
      `sessionStorage` e código Angular.
- [ ] Manter a proteção XSRF habilitada em `POST`, `PUT`, `PATCH` e `DELETE`.
- [ ] Tratar `401` como sessão ausente/expirada e `403` como acesso negado.
- [ ] Tratar `429` respeitando `Retry-After`.
- [ ] Mostrar mensagem pública; detalhes técnicos e payloads ficam fora do console.
- [ ] Adicionar interceptor funcional com `withInterceptors(...)` somente quando
      existir comportamento global concreto.

O proxy local está em `proxy.conf.json`; no container de desenvolvimento é usado
`proxy.docker.conf.json`. Em produção, o Nginx assume `/api/`. CORS permanece
desabilitado enquanto frontend e API estiverem na mesma origem.

## Nova funcionalidade

- [ ] Seguir o [padrão de conteúdo e títulos de página](page-layout.md).
- [ ] Aplicar a [escala e hierarquia de textos](page-text.md).
- [ ] Seguir a [separação entre Perfil, Configurações e tradução reativa](profile-settings-i18n.md).
- [ ] Normalizar os ícones conforme a [animação dos ícones da sidebar](sidebar-icon-animation.md).
- [ ] Seguir o [contrato do login no shell público](login.md) em mudanças de autenticação.
- [ ] Seguir o [guia do Monitor de Execuções GERP](gerp-executions-monitor.md) na implementação do histórico de rotinas da automação.
- [ ] Criar `modules/<funcionalidade>/` com componente, rotas, serviço e testes
      necessários à própria feature.
- [ ] Lazy-load da rota quando a funcionalidade não fizer parte da primeira tela.
- [ ] Manter estado local no componente/serviço da feature; promover ao `core`
      somente estado realmente global.
- [ ] Definir loading, vazio, sucesso, permissão negada, erro e retry.
- [ ] Usar tipos explícitos para request e response; evitar `any`.
- [ ] Usar signals para estado síncrono local e RxJS para fluxos assíncronos.
- [ ] Cancelar subscriptions/efeitos no ciclo de destruição.
- [ ] Preservar SSR: acesso a `window`, `document`, storage e media queries ocorre
      apenas no navegador.
- [ ] Usar os tokens de `theme/hanaro.theme.css` em vez de cores locais.
- [ ] Cobrir interação, acessibilidade, erro HTTP e autorização visual em testes.

## Modo TV

- [ ] Criar como feature própria em `modules/tv/`.
- [ ] Consumir apenas endpoints públicos e somente leitura.
- [ ] Excluir telefone, nomes completos e outras informações pessoais.
- [ ] Não iniciar ou persistir sessão de usuário no dispositivo.
- [ ] Atualizar dados com intervalo configurável, timeout, backoff e jitter.
- [ ] Manter o último estado válido durante indisponibilidade e mostrar horário da
      última atualização.
- [ ] Projetar para execução contínua: sem diálogos bloqueantes, rotação opcional
      de painéis e contraste legível à distância.
- [ ] Testar reconexão, resposta vazia, perda de rede e execução prolongada.

## Perfil e preferências

- [ ] Criar como feature própria em `modules/profile/`.
- [ ] Carregar a identidade pelo endpoint de sessão; o frontend não escolhe o ID
      do usuário alterado.
- [ ] Validar formato do telefone no cliente para feedback e novamente no backend.
- [ ] Confirmar o número antes de usá-lo para alertas ou recuperação de acesso.
- [ ] Exibir somente os campos editáveis e enviar uma allowlist mínima.
- [ ] Informar sucesso sem repetir o telefone completo em logs ou telemetria.
- [ ] Encerrar a sessão explicitamente em estações compartilhadas.

## Segurança do navegador

- [ ] Renderizar texto pela interpolação do Angular.
- [ ] Revisar todo uso de `innerHTML`, `DomSanitizer` e bypass de sanitização.
- [ ] Manter dependências bloqueadas por `package-lock.json` e revisar alertas.
- [ ] Limitar arquivos, imagens e conteúdos remotos por tipo e tamanho.
- [ ] Preservar a Content Security Policy aplicada pelo Nginx.
- [ ] Excluir credenciais, dados pessoais e respostas completas de logs do browser.

## Portão de qualidade

```bash
npm test -- --watch=false
npm run test:coverage
npm run build
```

- [ ] Testes e build passam.
- [ ] O bundle respeita os budgets de `angular.json`.
- [ ] A funcionalidade funciona pela URL pública, sem acessar a porta do backend.
- [ ] Operações autenticadas enviam cookie e `X-CSRF-Token` pelo proxy.
- [ ] Dashboard/TV continuam utilizáveis sem login e sem dados privados.

Referências externas:

- [Angular](https://angular.dev/)
- [Angular HttpClient](https://angular.dev/guide/http)
- [Angular interceptors](https://angular.dev/guide/http/interceptors)
- [Angular security](https://angular.dev/best-practices/security/)

## Tema sem piscadas

O tema deve estar definido **antes da primeira pintura** e sua troca deve ser uma
atualização atômica dos tokens CSS. `public/theme-init.js` resolve a preferência
persistida ainda no `<head>`; `ThemeService` aplica a mudança no elemento raiz e
desabilita transições por dois frames. Não adicione transições globais de
`background`, `color`, borda ou sombra para componentes que consomem tokens de tema.

Antes de aprovar uma tela ou alterar o sistema visual, valide:

- [ ] Carregamento direto com preferência clara, escura e do sistema, sem flash da cor oposta.
- [ ] Troca claro/escuro e alteração do tema do sistema sem piscar, reflow visível ou placeholder.
- [ ] Imagens dependentes do tema (incluindo logos) estão disponíveis antes de serem exibidas.
- [ ] Nenhum componente criou uma transição global ou animou propriedades controladas por tokens de tema.
