# CI/CD e publicação

## Fluxo de deploy

O push em `main` executa o quality gate. Após a aprovação, o GitHub publica o frontend Angular na Cloudflare; o Render detecta o mesmo push e publica a API automaticamente. Não há deploy hook, nem serviço Worker Taskiq, nesta configuração.

## Secrets no GitHub

No ambiente `production`, mantenha somente:

| Secret                  | Uso                                            |
| ----------------------- | ---------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Token restrito para publicar o Worker e assets |
| `CLOUDFLARE_ACCOUNT_ID` | Conta Cloudflare de produção                   |

## Variáveis no Render

Sincronize `.github/deploy/render.yaml` como Blueprint e configure, no painel do serviço `hanaro-api`:

- `DATABASE_URL`: URL Aiven PostgreSQL no formato `postgresql+asyncpg://USUARIO:SENHA@HOST:PORT/defaultdb?ssl=require`. Uma URL Aiven com `postgresql://` e `sslmode=require` também é normalizada automaticamente.
- `REDIS_URL`: URL Aiven Valkey com TLS, por exemplo `rediss://avnadmin:SENHA@HOST:PORT/0`.
- `SECRET_KEY`: valor aleatório forte.
- `CORS_ORIGINS`: origem do Cloudflare Pages/Worker, por exemplo `https://seu-projeto.pages.dev`.
- `TRUSTED_HOSTS`: hostname da API Render, por exemplo `hanaro-api.onrender.com`.

O Blueprint limita o pool PostgreSQL a 5 conexões com overflow de 2, habilita cache, sessões e rate limiting Redis, e deixa Taskiq desativado. As credenciais Aiven ficam somente no Render, nunca no GitHub.

## Cloudflare Workers

Defina `API_ORIGIN` em `frontend/wrangler.jsonc` com a URL pública da API Render. O workflow usa `cloudflare/wrangler-action@v4` e o build Angular `cloudflare`.

Quando a hospedagem externa não for mais necessária, siga o roteiro de [operação local após a hospedagem](operacao-local-pos-hospedagem.md) antes de cancelar serviços ou remover configurações.
