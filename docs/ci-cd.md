# CI/CD e publicação

## Fluxo de deploy

O push em `main` executa o quality gate. Após a aprovação, o GitHub publica o frontend Angular na Cloudflare; o Render detecta o mesmo push e publica a API automaticamente. Antes de servir a nova versão, o container aplica as migrations e garante os dados iniciais configurados. Não há deploy hook nem serviço Worker Taskiq nesta configuração.

O `npm audit` não bloqueia o CI/CD porque depende da disponibilidade da API externa do registry npm. A auditoria das dependências de produção continua disponível para execução local em `frontend` com `npm run audit:prod`, especialmente após alterações no `package-lock.json`.

## Secrets no GitHub

No ambiente `production`, mantenha somente:

| Secret                  | Uso                                            |
| ----------------------- | ---------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Token restrito para publicar o Worker e assets |
| `CLOUDFLARE_ACCOUNT_ID` | Conta Cloudflare de produção                   |

## Variáveis no Render

Sincronize o `render.yaml` da raiz como Blueprint e configure, no painel do serviço `hanaro-api`:

- `DATABASE_URL`: URL Aiven PostgreSQL no formato `postgresql+asyncpg://USUARIO:SENHA@HOST:PORT/defaultdb?ssl=require`. Uma URL Aiven com `postgresql://` e `sslmode=require` também é normalizada automaticamente.
- `SECRET_KEY`: valor aleatório forte.
- `CORS_ORIGINS`: origem do Cloudflare Pages/Worker, por exemplo `https://seu-projeto.pages.dev`.
- `TRUSTED_HOSTS`: hostname da API Render, por exemplo `hanaro-api.onrender.com`.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_USERNAME` e `ADMIN_PASSWORD`: credenciais do primeiro usuário local. O bootstrap é idempotente e não duplica a conta.

O Blueprint limita o pool PostgreSQL a 5 conexões com overflow de 2, usa sessões
em memória e deixa cache, rate limiter e Taskiq desabilitados. Essa é uma
configuração deliberadamente reduzida para demonstração/testes no plano gratuito
do Render; ela não é a configuração de produção do Hanaro. Sem Redis/Valkey e
sem Worker Taskiq, ingestões e exportações assíncronas (CSV, PDF e PPTX) não são
processadas nesse ambiente. Como as sessões ficam na memória do processo, elas
podem ser perdidas em reinícios e não funcionam entre múltiplas réplicas.

O startup aplica `alembic upgrade head`, cria o tier/usuário inicial e carrega a
fixture de demonstração quando `SEED_DEMO_DATA=true`; essas operações podem ser
repetidas sem duplicar dados. As credenciais externas ficam somente no Render,
nunca no GitHub.

### Diferença obrigatória para a implantação real

Na implantação Docker da intranet, não copie as limitações do `render.yaml`.
Use [deploy/compose.production.yaml](../deploy/compose.production.yaml), que deve
manter:

- `TASKIQ_ENABLED=true`;
- Redis privado habilitado para sessões, rate limit, cache e broker Taskiq;
- serviço `worker` ativo e usando o mesmo banco e Redis da API;
- volume `report_artifacts` montado simultaneamente na API e no worker;
- `RATE_LIMITER_FAIL_OPEN=false`;
- `CREATE_TABLES_ON_STARTUP=false`, com migrations Alembic executadas pelo
  serviço `migrate`.

Ao retirar o ambiente de testes externo, o `render.yaml`, as configurações da
Cloudflare e quaisquer variáveis de serviços externos devem ser removidos ou
arquivados em uma mudança de infraestrutura separada. Não remova Redis, Taskiq,
o worker ou o volume de artefatos da implantação Docker real.

## Cloudflare Workers

Defina `API_ORIGIN` em `frontend/wrangler.jsonc` com a URL pública da API Render. O workflow usa `cloudflare/wrangler-action@v4` e o build Angular `cloudflare`.

Quando a hospedagem externa não for mais necessária, siga o roteiro de [operação local após a hospedagem](operacao-local-pos-hospedagem.md) antes de cancelar serviços ou remover configurações.
