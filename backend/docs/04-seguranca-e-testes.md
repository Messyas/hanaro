# Checklist: segurança e testes

Esta revisão combina o OWASP Top 10:2025 para aplicações e o OWASP API
Security Top 10:2023. Execute-a para toda funcionalidade; marque `N/A` somente
com justificativa no PR.

## A01 — Controle de acesso / API1, API3 e API5

- [ ] Autenticação no endpoint e autorização por função e por objeto.
- [ ] Allowlist de campos graváveis; sem mass assignment.
- [ ] Resposta usa schema mínimo e não expõe propriedades internas.
- [ ] Testes com anônimo, usuário comum, proprietário, outro proprietário e admin.
- [ ] Testes alterando IDs em path, query e body.

## A02 — Configuração insegura / API8

- [ ] Docs/debug desabilitados em produção conforme settings.
- [ ] CORS contém origens exatas e exclui `*` quando credenciais estão habilitadas em produção.
- [ ] CORS permanece desabilitado quando frontend e API são publicados pela mesma origem.
- [ ] A allowlist contém somente os métodos, headers e content types necessários.
- [ ] Cookies seguros e CSRF habilitados; TLS termina em infraestrutura confiável.
- [ ] Resposta de erro não contém traceback, SQL, caminho local ou versão interna.
- [ ] Nova configuração passa pelo `production_validator` e possui teste.

## A03 — Cadeia de suprimentos

- [ ] Preferir biblioteca já instalada e API pública estável.
- [ ] Para nova dependência, justificar necessidade, licença, manutenção e superfície de ataque.
- [ ] Fixar via `pyproject.toml` e atualizar o `uv.lock` da raiz.
- [ ] Executar auditoria de dependências disponível no pipeline/equipe.
- [ ] Não instalar pacote por nome semelhante sem conferir projeto e mantenedor.

## A04 — Falhas criptográficas

- [ ] Usar `crudauth.get_password_hash` para senhas.
- [ ] Usar `secrets` para material aleatório e `hmac.compare_digest` para comparação.
- [ ] Reutilizar `APIKeyService` para API keys.
- [ ] Segredos ficam em ambiente/secret manager e são excluídos do código, banco em claro e logs.
- [ ] Dados sensíveis usam TLS em trânsito e proteção adequada em repouso.

## A05 — Injection

- [ ] Queries construídas por FastCRUD ou SQLAlchemy (`select`, filtros tipados).
- [ ] Tratar entrada como dado parametrizado em SQL, shell, templates, logs e nomes de arquivo.
- [ ] Executar subprocessos com argumentos estruturados e `shell=False`.
- [ ] Filtros, ordenação e nomes de campos vêm de allowlist.
- [ ] Testes com aspas, curingas, Unicode, null byte e payloads de injeção.

## A06 — Design inseguro / API6

- [ ] Mapear abuso do fluxo junto aos riscos técnicos.
- [ ] Limitar tentativas, volume, custo e frequência.
- [ ] Operações financeiras/irreversíveis têm idempotência e confirmação.
- [ ] Fluxos em lote possuem teto e autorização por item.
- [ ] Estado válido é imposto no serviço e no banco quando possível.

## A07 — Falhas de autenticação / API2

- [ ] Usar exclusivamente dependências e sessões do `crudauth`.
- [ ] Login e ações sensíveis têm lockout/rate limit.
- [ ] Mensagens não permitem enumeração de contas.
- [ ] Testar sessão expirada/revogada e CSRF inválido.
- [ ] Mudança de senha/permissão revoga ou reavalia sessões conforme requisito.

## A08 — Integridade de software e dados

- [ ] Validar assinatura/checksum quando consumir artefato ou webhook assinado.
- [ ] Aceitar de fontes não confiáveis somente formatos de dados não executáveis e validados.
- [ ] Webhook verifica assinatura sobre bytes crus, timestamp e replay.
- [ ] Job recebe identificadores mínimos e recarrega/autoriza dados atuais.

## A09 — Logging e alertas

- [ ] Registrar falhas de autenticação/autorização, mudanças administrativas e eventos críticos.
- [ ] Incluir correlation/support ID e contexto mínimo estruturado.
- [ ] Não registrar segredos ou dados pessoais desnecessários.
- [ ] Testar que eventos críticos geram log e que payload sensível não aparece.
- [ ] Definir quem monitora aumento de `401/403/429/5xx` e falhas de job.

## A10 — Condições excepcionais

- [ ] Timeout, retry limitado e circuit breaker/falha controlada em I/O externo.
- [ ] Transação faz rollback integral em erro.
- [ ] Exceção inesperada vira `500` genérico com `support_id`.
- [ ] Recursos são fechados por context manager ou `finally`.
- [ ] Testar cancelamento, timeout, resposta parcial, indisponibilidade e concorrência.

## Riscos exclusivos/acentuados de API

- [ ] Consumo de recursos: limitar página, upload, body, arquivo, CPU, memória e custo externo.
- [ ] SSRF: allowlist de host/esquema/porta, bloquear IP privado/metadata e revalidar redirects/DNS.
- [ ] Inventário: registrar nova rota em `/v1`, remover versões obsoletas e não expor endpoint órfão.
- [ ] API externa: tratar retorno como não confiável, validar schema/tamanho, usar TLS e timeout.

## Matriz mínima de testes da funcionalidade

| Grupo | Casos obrigatórios |
| --- | --- |
| Contrato | válido, campo extra, ausente, tipo errado, mínimos/máximos |
| Autenticação | anônimo, sessão inválida, sessão revogada |
| Autorização | proprietário, outro usuário, admin, role forjada |
| Persistência | duplicata, FK, rollback, concorrência, paginação |
| Exceções | domínio, timeout, dependência indisponível, inesperada |
| Dados | resposta mínima, sem segredo, logs sem segredo |
| Abuso | burst/rate limit, payload grande, repetição/idempotência |

Comandos:

```bash
uv run pytest tests/unit/modules/<modulo> -q
uv run pytest tests/integration/api/v1/<modulo> -q
uv run pytest tests/unit/infrastructure/security -q
uv run pytest tests/unit/infrastructure/test_middleware.py -q
uv run pytest tests/unit/infrastructure/rate_limit -q
uv run pytest tests/integration/auth -q
```

Referências oficiais:

- [OWASP Top 10:2025](https://owasp.org/Top10/)
- [OWASP API Security Top 10:2023](https://owasp.org/www-project-api-security/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
