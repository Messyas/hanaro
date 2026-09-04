# Arquitetura de publicação na intranet: Docker, WAF e SSO

## Objetivo

Definir como o Hanaro deve ser publicado na intranet corporativa usando Nginx como reverse proxy e separar as responsabilidades do código das responsabilidades da infraestrutura.

## Fluxo recomendado

```text
Usuário corporativo
        |
        v
Nginx (reverse proxy/WAF corporativo, se habilitado)
  - TLS
  - regras anti-abuso e DDoS
  - allowlist de rede
  - logs de borda
        |
        +--> SSO corporativo (OIDC/SAML/MFA), quando adotado
        |
        v
Frontend Hanaro
  - shell Angular
  - Dashboard público por decisão de produto
  - rotas operacionais protegidas pelo AuthGuard
        |
        v
Backend FastAPI (rede privada)
  - sessão server-side + CSRF
  - autorização por usuário/superusuário
  - rate limit por IP/usuário
  - ingestão e workers
        |
        +--> Redis privado (sessão, fila Taskiq e rate limit)
        +--> PostgreSQL privado (dados da aplicação)
```

O Docker executa e isola os componentes. O Nginx será o ponto de entrada; ele não substitui, por si só, uma solução dedicada de WAF/DDoS caso a empresa possua uma camada adicional.

## Publicação com Nginx

O Nginx deve ser o único serviço exposto aos usuários. Ele encaminha o frontend e a API para a rede Docker privada, preservando o esquema e o IP original:

```nginx
location /api/ {
    proxy_pass http://hanaro-backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
}

location / {
    proxy_pass http://hanaro-frontend:4200;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

O nome dos upstreams e as portas devem ser ajustados ao ambiente real. PostgreSQL, Redis e a porta do backend não devem ser publicados diretamente no firewall da intranet.

No backend, configure `TRUSTED_PROXY_HOPS=1` quando houver somente o Nginx entre o cliente e a API. Se existir outro balanceador/WAF antes do Nginx, use a quantidade real de proxies e aceite esses headers apenas de redes confiáveis.

O Nginx também deve aplicar, conforme a política corporativa:

- TLS e redirecionamento HTTP→HTTPS;
- allowlist da rede interna;
- limites de requisições por IP para login, upload e API;
- limites de tamanho e timeout para uploads;
- bloqueio de métodos e caminhos não utilizados;
- headers de segurança e logs de acesso;
- integração com o SSO, caso o Nginx faça a autenticação na borda.

### Módulos do Nginx a revisar

| Módulo/recurso | Configuração esperada |
|---|---|
| `ngx_http_proxy_module` | Proxy para frontend/backend, timeouts, HTTP/1.1 e headers encaminhados |
| `ngx_http_realip_module` | Confiar em `X-Forwarded-For` somente dos proxies/WAF corporativos; alinhar com `TRUSTED_PROXY_HOPS` |
| `ngx_http_ssl_module` | TLS, certificados corporativos, protocolos/cifras aprovados e redirect HTTP→HTTPS |
| `ngx_http_limit_req_module` | Limites por IP para login, upload, ingestão e endpoints mutáveis; retornar 429 sem substituir o rate limit da aplicação |
| `ngx_http_headers_module` | HSTS, `X-Content-Type-Options`, `X-Frame-Options`/CSP conforme política corporativa |
| `auth_request` ou módulo OIDC/SAML | Somente se o Nginx for integrar o SSO; o backend ainda deve validar autorização própria |
| ModSecurity + OWASP CRS (se aprovado) | WAF de borda para padrões de ataque; operar em modo de teste antes de bloquear para evitar falsos positivos |

### Variáveis do backend a revisar

```env
ENVIRONMENT=production
SESSION_SECURE_COOKIES=true
SESSION_BACKEND=redis
CSRF_ENABLED=true
RATE_LIMITER_ENABLED=true
RATE_LIMITER_BACKEND=redis
RATE_LIMITER_FAIL_OPEN=false
LOGIN_MAX_ATTEMPTS=3
TRUSTED_PROXY_HOPS=1
TRUSTED_HOSTS=<hostnames publicados>
CORS_ENABLED=false
```

`TRUSTED_PROXY_HOPS=1` é apenas o exemplo para o cenário “usuário → Nginx → backend”. Se houver WAF ou balanceador antes do Nginx, a equipe deve informar a quantidade real e restringir as redes autorizadas a enviar headers de proxy.

### O que não deve ser configurado no Nginx

- Não expor Redis, PostgreSQL ou a porta interna do backend.
- Não confiar no Nginx para autorização de usuário ou superusuário.
- Não remover CSRF ou rate limit da aplicação porque existe um limite na borda.
- Não aceitar `X-Forwarded-For` arbitrário vindo diretamente de clientes.
- Não ativar regras bloqueadoras do WAF sem observar falsos positivos em staging.

## O que o projeto já fornece

- Serviços separados para frontend, backend, worker, PostgreSQL e Redis em `docker-compose.yaml`.
- Redis compartilhado para sessões, rate limit e tarefas assíncronas.
- Sessão server-side com CSRF, `HttpOnly`, `SameSite=Lax` e timeout configurável.
- Lockout de login após três tentativas (`LOGIN_MAX_ATTEMPTS=3`).
- Rate limit global por IP e políticas específicas por usuário/nível.
- Health checks para frontend, backend, PostgreSQL e Redis.
- `TRUSTED_PROXY_HOPS` configurável para preservar o IP real atrás de proxies.
- CORS desativado no cenário same-origin, reduzindo superfície de origem cruzada.
- Rotas operacionais protegidas pelo `AuthGuard`; Dashboard e Preferences são públicos por desenho.

## Diferenças entre Compose local e produção

O Compose atual é apropriado para desenvolvimento e demonstração. Ele publica portas do frontend, backend, PostgreSQL e Redis no host para facilitar testes. Na intranet, essas portas internas não devem ficar acessíveis aos usuários.

Valores de produção obrigatórios:

```env
ENVIRONMENT=production
SESSION_SECURE_COOKIES=true
SESSION_BACKEND=redis
RATE_LIMITER_ENABLED=true
RATE_LIMITER_BACKEND=redis
RATE_LIMITER_FAIL_OPEN=false
TRUSTED_PROXY_HOPS=<número de proxies reais>
```

O backend deve ficar em uma rede privada. PostgreSQL e Redis não devem ter publicação direta para a rede de usuários.

## Responsabilidades do código

- Validar sessão, CSRF, autenticação e autorização em cada endpoint.
- Não confiar apenas no bloqueio visual do frontend.
- Aplicar rate limit de aplicação em login, upload, ingestão e operações mutáveis.
- Emitir logs estruturados com correlação de requisição.
- Respeitar `X-Forwarded-For` somente quando `TRUSTED_PROXY_HOPS` estiver configurado para proxies controlados.
- Manter segredos fora do repositório e recebê-los por variáveis/secret manager.
- Expor apenas endpoints necessários e manter documentação administrativa protegida.

## Responsabilidades da infraestrutura

- Terminar TLS e encaminhar `X-Forwarded-Proto`/`X-Forwarded-For` corretamente.
- Publicar somente o ponto de entrada do frontend/proxy.
- Bloquear acesso externo a backend, Redis e PostgreSQL.
- Aplicar WAF, allowlists, proteção contra DDoS e limites por IP na borda.
- Integrar SSO/MFA corporativo, caso seja requisito da empresa.
- Centralizar logs no SIEM e configurar alertas para brute force, 429, uploads anômalos e falhas de autenticação.
- Fornecer certificados, DNS interno, balanceamento, backups e rotação de segredos.
- Definir a estratégia de rollout, rollback e atualização das imagens Docker.

## O que ainda precisa ser decidido com Infra/Security

- Qual WAF/reverse proxy será usado (Nginx, HAProxy, Traefik, appliance corporativo ou outro).
- Qual provedor de SSO será usado e se o Hanaro será um cliente OIDC/SAML ou continuará com login local.
- Quantos proxies existem entre o usuário e o backend, para definir `TRUSTED_PROXY_HOPS`.
- Quais limites de requisição serão aplicados na borda e na aplicação.
- Como será feita a proteção DDoS dentro da rede corporativa.
- Onde ficarão Redis e PostgreSQL e quais regras de firewall/segmentação serão aplicadas.
- Como os logs de autenticação e rate limit chegarão ao SIEM.
- Como serão feitos certificados, backups, restauração e rollback.
- Qual política de expiração, rotação e armazenamento dos segredos será adotada.

## Checklist de homologação

- [ ] Usuário acessa somente o endereço publicado pelo WAF.
- [ ] Portas 8000, 5432 e 6379 não são acessíveis pela rede de usuários.
- [ ] TLS está ativo e o cookie de sessão contém `Secure`.
- [ ] O backend recebe o IP real corretamente, sem aceitar spoofing de headers.
- [ ] SSO/MFA funciona, se adotado pela empresa.
- [ ] Login inválido gera bloqueio após três tentativas.
- [ ] Rate limit da aplicação e do WAF retornam 429 conforme política.
- [ ] Falha do Redis bloqueia requisições em produção (`RATE_LIMITER_FAIL_OPEN=false`).
- [ ] Rotas protegidas não retornam dados sem sessão válida.
- [ ] Dashboard público não expõe dados que exigem autenticação.
- [ ] Logs de proxy, backend, autenticação e rate limit chegam ao SIEM.
- [ ] Existe procedimento testado de rollback e restauração do banco.

## Conclusão

O código está preparado para operar atrás de WAF, proxy e SSO, mas a proteção de borda, segmentação de rede, DDoS, certificados e identidade corporativa não pode ser resolvida apenas no repositório. A implantação só deve ser considerada pronta após a equipe de Infra/Security preencher o checklist acima.
