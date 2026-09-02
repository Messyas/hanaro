# Operação local após encerrar a hospedagem externa

Este guia deve ser usado quando o Hanaro não precisar mais ser acessível pela internet e passar a operar apenas na rede/local. Ele descreve a retirada de Render, Aiven e Cloudflare, com descarte definitivo dos dados hospedados e revogação das credenciais externas.

> Os dados do PostgreSQL e Valkey na Aiven serão descartados. Confirme apenas que não há nenhuma informação externa que precise ser preservada antes do cancelamento.

## 1. Executar a aplicação localmente

O repositório já possui `docker-compose.yaml` para PostgreSQL e Redis locais. Partindo da raiz do projeto:

```bash
copy .env.example .env
docker compose up --build
```

No Linux/macOS, use `cp .env.example .env`. Ajuste no `.env` local, quando necessário:

```ini
BACKEND_ENVIRONMENT=local
BACKEND_DEBUG=true
CREATE_TABLES_ON_STARTUP=true
CACHE_ENABLED=true
RATE_LIMITER_ENABLED=true
TASKIQ_ENABLED=false
SECRET_KEY=gere-um-novo-segredo-para-este-ambiente
```

Para desenvolvimento local, deixe `REDIS_URL` vazio. O Compose usa o serviço `redis` e as configurações `CACHE_REDIS_*`, `RATE_LIMITER_REDIS_*` e `TASKIQ_REDIS_*` como fallback. Se for usar um Redis local externo, defina `REDIS_URL=redis://HOST:PORT/0`.

O frontend local é servido em `http://localhost:4200` e usa o proxy configurado para a API. Não use as URLs `rediss://` da Aiven no `.env` local depois da migração.

## 2. Alterações de configuração e código

Estas alterações devem ser feitas depois de confirmar que a operação local funciona com dados novos/vazios:

- Remova `REDIS_URL` e `DATABASE_URL` das variáveis configuradas no Render. No código, eles podem permanecer: são overrides opcionais e não impedem a execução local.
- Se a integração Aiven não for mais desejada no código, remova primeiro os testes e a documentação referentes a `rediss://` e `DATABASE_URL`; depois remova as variáveis e os fallbacks associados. Faça isso em um commit separado da migração de dados.
- Mantenha `SESSION_BACKEND=redis`, `CACHE_BACKEND=redis` e `RATE_LIMITER_BACKEND=redis` se o Redis local estiver ativo. Para uma demonstração sem Redis, use `SESSION_BACKEND=memory`, `CACHE_ENABLED=false` e `RATE_LIMITER_ENABLED=false`.
- Deixe `TASKIQ_ENABLED=false` enquanto não existir worker local. Para reativá-lo, suba Redis, configure `TASKIQ_ENABLED=true` e execute o worker no mesmo ambiente.
- Ajuste `CORS_ORIGINS` e `TRUSTED_HOSTS` para hosts locais, ou mantenha CORS desativado se o proxy do frontend continuar garantindo mesma origem.

Não é necessário modificar o driver PostgreSQL: sem `DATABASE_URL`, a aplicação já monta a URL assíncrona pelas variáveis `POSTGRES_*`.

## 3. Retirar o deploy externo do repositório

Quando a decisão for definitiva, faça uma revisão em pull request separada:

1. Desative ou remova o workflow [deploy-staging.yml](../.github/workflows/deploy-staging.yml). Hoje ele publica o frontend na Cloudflare a cada push em `main`.
2. Remova ou arquive [render.yaml](../.github/deploy/render.yaml), para não recriar o serviço Render por engano.
3. Remova do GitHub os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` e apague o ambiente GitHub `production` se ele não tiver outro uso.
4. Revogue o token da Cloudflare e confirme que o Worker/Pages não recebe mais tráfego.
5. Remova as variáveis `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `CORS_ORIGINS` e `TRUSTED_HOSTS` do Render antes de excluir o serviço.
6. Cancele os serviços Aiven e descarte seus dados. Revogue usuários, tokens e integrações associadas.

Não cancele as contas antes de confirmar que o ambiente local está funcionando conforme esperado.

## 4. Checklist de aceite

- [ ] Banco PostgreSQL e Redis locais iniciados e acessíveis.
- [ ] Login, sessões, cache e rate limit testados na máquina/rede local, se forem necessários.
- [ ] Frontend acessa a API local sem depender do domínio Cloudflare.
- [ ] Migrações Alembic executam no banco local.
- [ ] Nenhuma credencial Aiven, Render ou Cloudflare permanece em `.env`, commits ou logs.
- [ ] Workflow de deploy externo desativado ou removido em PR próprio.
- [ ] Dados Aiven descartados e serviços externos/tokens cancelados ou revogados após os testes acima.

## Pontos a decidir antes da retirada

- **Acesso na rede interna:** escolha um hostname interno ou IP fixo e ajuste `TRUSTED_HOSTS`/CORS conforme ele.
- **Dados locais futuros:** defina se os novos dados locais precisarão de backup recorrente e onde eles serão armazenados.
- **HTTPS local/interno:** se usuários acessarem por navegador em outra máquina, use um proxy interno e certificado confiável para manter os cookies de sessão `Secure` funcionando corretamente.
- **Atualizações:** sem Cloudflare/Render, a pessoa responsável deverá executar `git pull`, `docker compose up --build` e as migrações de forma controlada.
