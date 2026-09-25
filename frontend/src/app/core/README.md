# Core

Responsabilidades globais com uma única instância na aplicação:

- cliente e políticas HTTP;
- estado da sessão e identidade atual;
- guards de autenticação e administração;
- interceptors funcionais para erros que tenham tratamento global;
- configuração e serviços usados por mais de uma feature.

`i18n/`, `theme/`, `config/`, `http/`, `auth/`, `browser/` e `shell/`
contêm essas responsabilidades. Serviços de um domínio específico, como
governança, pertencem a `modules/`.

O cookie de sessão é transportado pelo navegador. O core não armazena nem anexa
session ID ou JWT. A configuração XSRF permanece centralizada em
`app.config.ts`.

Regras e modelos exclusivos de uma tela pertencem a `modules/<feature>/`.
