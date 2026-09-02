# Autenticacao e autorizacao

O backend usa `crudauth` com sessao em cookie para contas locais provisionadas.
O unico login suportado e `username` e senha; nao ha OAuth nem login social.

| Uso | Dependencia no backend |
| --- | --- |
| Dashboard/TV publico | nenhuma |
| Valores de filtro publico | nenhuma (`GET /api/v1/scrap/filters`) |
| Relatorio detalhado | `CurrentUserDep` (`GET /api/v1/scrap`) |
| Escrita administrativa | `CurrentSuperUserDep` |
| Ingestao do robo | `require_material_scrap_ingestion_key` e cabecalho `X-API-Key` |

As dependencias de sessao recarregam o usuario persistido e rejeitam conta
apagada, sessao invalida e CSRF ausente em metodos inseguros. Guards do Angular
sao apenas experiencia de uso: toda decisao de acesso deve existir na rota ou
servico do backend.

## Provisionamento inicial

Nao existe interface SQLAdmin nem credenciais administrativas separadas das
contas do sistema. Para inicializar uma base local, defina temporariamente
`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_USERNAME` e `ADMIN_PASSWORD` e execute:

```bash
python -m scripts.setup_initial_data
```

O script cria o tier inicial e um superusuario local. Depois, use esse usuario
para entrar normalmente e gerenciar as contas pelos fluxos protegidos. Os valores
de bootstrap nao devem ser versionados nem mantidos como segredo de runtime.

## Rate limit

Quando `RATE_LIMITER_ENABLED=true`, `RateLimiterMiddleware` aplica antes de cada
request o limite padrao por IP de cliente. As respostas limitadas retornam `429`
e `Retry-After`; os cabecalhos `X-RateLimit-*` sao adicionados quando a contagem
esta disponivel. Politicas por tier existem para rotas que incluam explicitamente
`check_rate_limit`; o middleware global nao infere usuario da sessao.
