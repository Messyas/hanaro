# Modules

Cada pasta representa uma funcionalidade navegável e contém apenas seus
componentes, rotas, serviços, tipos e testes.

Funcionalidades atuais:

- `auth/`, `users/` e `dashboard/`: páginas consolidadas de `pages/`;
- `executions/`, `scrap-base/`, `settings/`, `reports/`, `alerts/` e
  `action-plans/`: áreas funcionais existentes;
- [`profile/`](profile/README.md): telefone e preferências do usuário autenticado.

Funcionalidade planejada:

- [`tv/`](tv/README.md): dashboard contínuo, público, somente leitura e sem dados pessoais;

Outras áreas são criadas quando houver contrato de UI e API definido.

O módulo declara seus estados de loading, vazio, sucesso, erro e permissão. Código
promovido para `core/` ou `shared/` deve ter consumidores reais em mais de uma
feature.
