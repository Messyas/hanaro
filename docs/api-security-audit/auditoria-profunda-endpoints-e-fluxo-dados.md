# Revisao de seguranca da API

**Data:** 30 de agosto de 2026
**Escopo:** codigo e configuracao versionados. Configuracoes de Cloudflare,
identidade da rede e servicos externos nao foram acessiveis nesta revisao.

## Resultado

Foram corrigidas tres divergencias entre os relatorios anteriores e o codigo:

1. `RateLimiterMiddleware` estava registrado, mas nao chamava a verificacao de
   limite. Agora ele aplica o limite padrao por IP antes de entregar a request ao
   handler e responde `429` com `Retry-After` quando bloqueia.
2. `GET /api/v1/scrap` era publico embora seja a fonte de linhas detalhadas do
   relatorio. Agora exige `CurrentUserDep`.
3. SQLAdmin usava usuario e senha de ambiente independentes das contas locais.
   A interface e suas dependencias foram removidas. O bootstrap cria um
   superusuario local provisionado pelo fluxo normal.

`GET /api/v1/scrap/filters` permanece deliberadamente publico. Ele entrega
opcoes distintas de filtro, nao a listagem de transacoes; seus parametros e
limites continuam validados pelo schema.

## Fronteiras verificadas

| Superficie | Controle confirmado |
| --- | --- |
| Dashboard e TV | Leituras em `/api/v1/dashboard/scrap*` sao publicas por decisao de negocio; escrita de metas exige superusuario. |
| Relatorio detalhado | `GET /api/v1/scrap` exige sessao local valida. |
| Filtros | `GET /api/v1/scrap/filters` e publico; somente leitura e schema limitado. |
| Execucoes | Consultas exigem `CurrentUserDep`; mutacoes do robo exigem API key com escopo. |
| Ingestao | Aceita somente `X-API-Key`; a alegacao anterior de suporte a `Authorization: Bearer` era falsa. |
| Usuarios, tiers e regras | Rotas administrativas usam dependencia de superusuario. |

## Controles presentes e limites

- Consultas usam SQLAlchemy e validacao Pydantic; isto reduz injecao, mas novas
  consultas raw precisam de revisao propria.
- Cookies de sessao sao configurados como `HttpOnly` pelo provedor de sessao e
  `SameSite=Lax`; `Secure` depende de `SESSION_SECURE_COOKIES` e deve estar ativo
  fora do ambiente HTTP local.
- O validador de producao bloqueia segredo de aplicacao inseguro e senha de banco
  vazia ou padrao. CORS permissivo, documentacao exposta, Redis sem protecao e
  parametros de sessao geram aviso: eles nao bloqueiam o boot.
- CSP esta no template Nginx. WAF, allowlist, mTLS, TLS na borda e regras de
  Cloudflare sao recomendacoes operacionais, nao controles comprovados pelo repo.

## Verificacao executada

A suite do backend concluiu com `296 passed, 71 skipped` quando executada com
as fixtures de automacao montadas. Os skips sao testes de integracao que dependem
de infraestrutura Docker aninhada; nao devem ser interpretados como validacao de
runtime desses caminhos.

## Pendencias operacionais

- Em producao, configure `RATE_LIMITER_FAIL_OPEN=false`, backend de rate limit
  disponivel e monitore respostas `429`.
- Se houver proxy reverso, configure `TRUSTED_PROXY_HOPS` corretamente; IP errado
  enfraquece a chave por cliente do limitador.
- Se a intranet voltar a ser exposta por Cloudflare, valide as regras de borda
  no painel e teste-as no ambiente implantado.
