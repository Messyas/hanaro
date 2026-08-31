# Recomendacoes de borda Cloudflare

Este documento nao e evidencia de que Cloudflare esteja configurado. O
repositorio nao contem credenciais nem exportacao das regras do painel; portanto,
WAF, mTLS, allowlists, TLS e rate limits de borda devem ser validados pelo time
de infraestrutura antes de serem declarados ativos.

Para uma implantacao que exponha a intranet pela internet, recomenda-se:

1. Restringir a origem para aceitar trafego apenas dos IPs/proxy esperados e
   configurar `TRUSTED_PROXY_HOPS` de acordo com a cadeia real.
2. Aplicar regra de rate limit adicional nas rotas de login e em
   `POST /api/v1/scrap/ingestions`, `POST /api/v1/scrap/executions` e mutacoes de
   execucao. A aplicacao tambem aplica limite global por IP.
3. Permitir a ingestao apenas com `X-API-Key` valido; nao criar regra que aceite
   `Authorization: Bearer`, pois esse nao e o contrato da API.
4. Evitar cache de respostas `/api/*` e verificar no navegador/proxy o
   `Cache-Control: private, no-store` das respostas autenticadas.
5. Manter `/docs`, `/redoc` e `/openapi.json` desabilitados ou protegidos em
   producao, conforme a configuracao do backend.

Em uma topologia estritamente interna sem Cloudflare, esses controles de borda
sao nao aplicaveis. Ainda permanecem necessarios: TLS interno quando houver
trafego sensivel, segmentacao de rede, sessao segura e rate limit da aplicacao.
