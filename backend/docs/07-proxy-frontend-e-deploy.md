# Proxy e comunicação com o frontend

Frontend e API usam a mesma origem em todos os ambientes. O navegador chama
URLs relativas `/api/...`; o proxy escolhe o container de destino.

```text
Desenvolvimento: http://localhost:4200/api/ → Angular dev proxy → backend:8000
Produção:        https://<host>/api/        → Nginx             → backend:8000
                https://<host>/            → Nginx             → frontend:4000
```

## Desenvolvimento

- [ ] Manter `CORS_ENABLED=false` no Compose.
- [ ] Usar `frontend/proxy.conf.json` fora do Docker.
- [ ] Usar `frontend/proxy.docker.conf.json` dentro do container.
- [ ] Consumir somente URLs relativas no Angular.
- [ ] Acessar a aplicação por `localhost:4200`; a porta `8000` serve diagnóstico
      direto e documentação local, não chamadas do browser da aplicação.
- [ ] Manter `SESSION_SECURE_COOKIES=false` apenas durante HTTP local.
- [ ] Manter CSRF habilitado também no desenvolvimento.

## Produção

A stack de referência está em `deploy/compose.production.yaml` e a configuração
do proxy em `deploy/nginx/default.conf.template`.

- [ ] Publicar somente portas `80/443` do Nginx.
- [ ] Manter frontend, backend, PostgreSQL e Redis sem `ports` públicos.
- [ ] Redirecionar HTTP para HTTPS.
- [ ] Instalar certificado e chave fora do Git.
- [ ] Definir `PUBLIC_HOST` e incluí-lo em `TRUSTED_HOSTS`.
- [ ] Usar `SESSION_SECURE_COOKIES=true`, `CSRF_ENABLED=true` e
      `TRUSTED_PROXY_HOPS=1` com um Nginx.
- [ ] Manter `CORS_ENABLED=false` para a topologia de mesma origem.
- [ ] Encaminhar `Host`, `X-Real-IP`, `X-Forwarded-For`,
      `X-Forwarded-Host` e `X-Forwarded-Proto`.
- [ ] Confiar nos headers encaminhados somente enquanto a API não publicar porta
      no host e as redes do backend aceitarem apenas containers controlados por
      esta stack. Restrinja `--forwarded-allow-ips` se outra carga for anexada.
- [ ] Aplicar CSP, HSTS, `nosniff`, política de frames, referrer e permissions no
      proxy que responde pelo frontend.
- [ ] Manter documentação OpenAPI e SQLAdmin indisponíveis publicamente.

## CORS quando houver outra origem

CORS só entra quando um cliente de browser legítimo usa domínio, protocolo ou
porta diferente. Nesse caso:

- [ ] Definir `CORS_ENABLED=true`.
- [ ] Informar origens completas e exatas em `CORS_ORIGINS`.
- [ ] Listar métodos e headers; credenciais são incompatíveis com qualquer `*`.
- [ ] Incluir `X-CSRF-Token` entre os headers permitidos para sessão por cookie.
- [ ] Testar preflight permitido e negado, origem desconhecida e resposta de erro.

O startup rejeita uma política CORS com credenciais e wildcard.

## Contrato de autenticação do browser

- `session_id`: cookie `HttpOnly`, emitido pelo `crudauth`.
- `csrf_token`: cookie legível pelo Angular.
- `X-CSRF-Token`: header enviado automaticamente pelo `HttpClient` em escritas.
- URLs relativas: permitem que cookies e XSRF permaneçam same-origin.
- Tokens OAuth: permanecem no backend; o navegador recebe uma sessão local.

## Testes de aceitação

```bash
docker compose config --quiet
docker compose -f deploy/compose.production.yaml --env-file deploy/.env.production config --quiet
```

- [ ] `/` retorna o frontend pelo host público.
- [ ] `/api/v1/...` chega ao backend sem expor a porta `8000`.
- [ ] HTTP redireciona para HTTPS.
- [ ] Login define cookies seguros em produção.
- [ ] Escrita sem CSRF recebe `403`; com CSRF válido executa.
- [ ] Host desconhecido é rejeitado.
- [ ] PostgreSQL e Redis não aceitam conexão pela interface pública.
- [ ] Headers de segurança estão presentes em páginas, assets e respostas da API.
