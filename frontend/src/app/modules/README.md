# Modules

Cada pasta representa uma funcionalidade navegável e contém apenas seus
componentes, rotas, serviços, tipos e testes.

Funcionalidades atuais:

- `auth/`, `users/` e `dashboard/`: páginas consolidadas de `pages/`;
- `executions/`, `scrap-base/`, `settings/` e `reports/`: áreas funcionais existentes;
- `governance/alerts/` e `governance/action-plans/`: fluxos agrupados pelo domínio;
- [`profile/`](profile/README.md): telefone e preferências do usuário autenticado.

Funcionalidade planejada:

- [`tv/`](tv/README.md): dashboard contínuo, público, somente leitura e sem dados pessoais;

Outras áreas são criadas quando houver contrato de UI e API definido.

O módulo declara seus estados de loading, vazio, sucesso, erro e permissão. Código
promovido para `core/` ou `shared/` deve ter consumidores reais em mais de uma
feature.

Dependências entre funcionalidades usam apenas seus arquivos `*.public-api.ts`.
`npm run check:architecture` verifica essas fronteiras.

A autentica��o exporta LoginDialog e LoginPage diretamente de seus arquivos; a verifica��o de arquitetura permite esses dois pontos de entrada fora do m�dulo.
