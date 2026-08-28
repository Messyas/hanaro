# CI/CD e publicação

## Fluxo de branches

1. Cada funcionalidade nasce de `developer`, em uma branch `feat/<nome>`.
2. O pull request da feature aponta para `developer` e exige o check `CI / quality-gate`.
3. No fechamento da semana, abre-se um pull request de `developer` para `main`.
4. O push em `developer` inicia o quality gate e, se aprovado, publica o ambiente `staging` para o cliente acompanhar o desenvolvimento.
5. O merge em `main` inicia somente o quality gate; a publicação final da intranet será definida em um workflow de produção separado.

O deploy de staging não deve ser configurado como auto-deploy por push nos provedores. O arquivo `render.yaml` já define `autoDeploy: false`; o deploy ocorre somente no workflow `Deploy staging`.

## Proteções obrigatórias no GitHub

Em `Settings > Branches`, crie regras para `developer` e `main`:

- exigir pull request antes do merge;
- exigir pelo menos uma aprovação;
- exigir que a branch esteja atualizada antes do merge;
- exigir o status check `CI / quality-gate`;
- bloquear push direto e permitir somente usuários/automação autorizados;
- exigir resolução das conversas e rejeitar force-push.

Em `Settings > Environments`, crie o ambiente `staging` e associe os secrets de demonstração a ele. Se o cliente precisar aprovar cada publicação, habilite revisores obrigatórios; caso contrário, o staging será atualizado automaticamente após o quality gate.

## Secrets do GitHub

Adicionar no ambiente `staging`:

| Secret                                  | Uso                            |
| --------------------------------------- | ------------------------------ |
| `RENDER_STAGING_API_DEPLOY_HOOK_URL`    | Hook do serviço web de staging |
| `RENDER_STAGING_WORKER_DEPLOY_HOOK_URL` | Hook do worker de staging      |
| `CLOUDFLARE_STAGING_API_TOKEN`          | Token restrito para Workers    |
| `CLOUDFLARE_STAGING_ACCOUNT_ID`         | Conta Cloudflare do staging    |

Os deploy hooks são credenciais: não os coloque no código, em issues ou em logs. O workflow acrescenta o SHA exato que passou no quality gate ao hook do Render.

## Render

Sincronize `render.yaml` como Blueprint de staging e deixe os dois serviços sem auto-deploy. O serviço web usa `GET /health` como health check e a imagem inclui as migrações Alembic. O pre-deploy do Render deve executar:

```text
CONFIRM_PRODUCTION_MIGRATION=yes alembic upgrade head
```

Preencha no painel do Render:

- `DATABASE_URL`: URL do PostgreSQL Aiven. Use o esquema `postgresql+asyncpg://` e TLS (`ssl=require`); a aplicação normaliza uma URL Aiven `postgresql://...?sslmode=require`.
- `SECRET_KEY`: segredo aleatório com pelo menos 32 caracteres.
- `TRUSTED_HOSTS`: hostname do serviço Render que recebe o proxy do Worker, por exemplo `hanaro-api.onrender.com`.
- `OAUTH_REDIRECT_BASE_URL`: URL pública do frontend, se OAuth estiver habilitado.
- `CACHE_REDIS_URL`, `RATE_LIMITER_REDIS_URL` e `TASKIQ_REDIS_URL`: URLs `rediss://` do Redis/Valkey gerenciado. Use bancos lógicos separados, por exemplo `/0`, `/1` e `/3`.

O PostgreSQL da Aiven é suficiente para os dados relacionais, mas não substitui Redis: sessões, rate limiting, cache e fila Taskiq precisam de um Redis/Valkey persistente e com TLS. Aiven Valkey ou Render Key Value são opções compatíveis.

## Cloudflare Workers

Em `frontend/wrangler.jsonc`, altere `API_ORIGIN` para o hostname real do serviço web de staging no Render. O Worker publica `dist/frontend/browser`, encaminha `/api/*` para o Render e entrega o restante como SPA. Isso conserva a mesma origem no navegador, cookies de sessão e CSRF, mantendo `CORS_ENABLED=false`.

Crie um token Cloudflare com somente as permissões necessárias para Workers e limite-o à conta correta. O workflow fixa Wrangler na major version 4 e constrói o Angular com a configuração `cloudflare` (modo estático); o build SSR continua sendo usado pelo Docker/local.

## Rollback do staging

O deploy de staging é por SHA. Para reverter, faça um novo push/revert em `developer` ou execute novamente o workflow a partir de um commit conhecido. Migrações devem ser compatíveis para trás: primeiro adicione mudanças, publique código compatível e só remova colunas/contratos em uma janela posterior. Nunca faça downgrade automático do banco em rollback de aplicação.

Quando a intranet final estiver pronta, crie um workflow separado acionado por `main`, com environment `production`, secrets distintos e banco/Redis próprios. Não reutilize os recursos de staging.
