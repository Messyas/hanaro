# Checklist: autenticação e autorização

O padrão de autenticação do backend é o `crudauth`, com sessão em cookie, CSRF,
lockout progressivo e armazenamento Redis ou memória. Toda autenticação passa
por esse fluxo; o frontend apenas utiliza a sessão emitida pelo backend. As
contas são provisionadas administrativamente e o único login disponível usa
username e senha local.

## Modelo de acesso da aplicação

O contrato completo e as decisões de produto estão em
[`docs/modelo-de-acesso.md`](../../docs/modelo-de-acesso.md). Em especial, o
dashboard agregado é público para suportar o modo TV, enquanto relatórios,
perfil e configurações de domínio seguem fronteiras próprias.

| Superfície | Dependência | Requisitos |
| --- | --- | --- |
| Dashboard público | nenhuma | `GET`, dados não pessoais e schema mínimo |
| Modo TV | nenhuma | somente leitura, sem sessão e sem controles administrativos |
| Relatórios | `CurrentUserDep` | dados detalhados disponíveis apenas para conta provisionada |
| Aliases | leitura autenticada / escrita `CurrentSuperUserDep` | configuração compartilhada; somente administrador altera |
| Perfil/preferências | `CurrentUserDep` | usuário derivado da sessão e CSRF em escritas |
| Administração | `CurrentSuperUserDep` | autorização explícita e evento auditável |

Rotas públicas são uma decisão por caso de uso, não um padrão do módulo inteiro.
Cada consulta pública define campos, limites, cache e rate limit próprios. O modo
TV usa endpoints dedicados para impedir que futuras alterações em endpoints
autenticados exponham dados pessoais.

`GET /api/v1/scrap` e `GET /api/v1/scrap/filters` são endpoints detalhados e
devem ser protegidos antes de alimentar a tela de Relatórios. Eles não fazem
parte do contrato público agregado de `/api/v1/dashboard/scrap`.

O payload de Perfil aceita somente campos editáveis pelo próprio usuário.
Campos desconhecidos, tier e privilégios são rejeitados pelo schema.

## Dependências obrigatórias

Escolha explicitamente uma:

- Rota pública: nenhuma dependência de usuário, após revisão de abuso/rate limit.
- Usuário opcional: `OptionalUserDep`.
- Usuário autenticado: `CurrentUserDep`.
- Apenas administrador: `CurrentSuperUserDep`.
- Metadados da sessão: `Depends(get_current_principal)`.

Importe os aliases de `src/infrastructure/dependencies.py`. As implementações em
`src/infrastructure/auth/dependencies.py` já:

- validam a sessão com `auth.current_user()`;
- aplicam CSRF em métodos inseguros;
- recarregam o usuário filtrando `is_deleted=False`;
- levantam `UnauthorizedException` (`401`) e `ForbiddenException` (`403`).

## Checklist por endpoint protegido

- [ ] Definir quem pode chamar a função (`CurrentUserDep` ou `CurrentSuperUserDep`).
- [ ] Verificar autorização por objeto: proprietário, tenant e estado do recurso.
- [ ] Derivar o ID do ator exclusivamente de `current_user["id"]`.
- [ ] Negar por padrão; exceções de acesso devem ser explícitas e testadas.
- [ ] Verificar autorização também em leitura, exportação, busca e contagem.
- [ ] Derivar `is_superuser`, role, tier e permissões do estado persistido no servidor.
- [ ] Usar resposta uniforme para “não existe” e “pertence a outro usuário” quando houver risco de enumeração.
- [ ] Revalidar privilégio no backend para cada ação sensível.
- [ ] Aplicar rate limit a login, recuperação, convite, exportação, cobrança e geração de chaves.

Exemplo de regra por objeto no serviço:

```python
resource = await crud_widgets.get(db=db, id=widget_id)
if resource is None:
    raise ResourceNotFoundError("Widget not found")
if resource["owner_id"] != current_user["id"] and not current_user.get("is_superuser"):
    raise PermissionDeniedError("Access denied")
```

Sempre que possível, filtre por `id` e `owner_id` na própria query para reduzir
risco de BOLA e condições de corrida.

## Senhas, sessões e chaves

- [ ] Gerar hash de senha exclusivamente com `crudauth.get_password_hash(password=...)`.
- [ ] Para login, manter `crud_auth.authenticate_password(...)`; ele inclui verificação endurecida e lockout.
- [ ] Criar/revogar sessões com `crud_auth.sessions.create_session(...)` e `.revoke(...)`.
- [ ] Definir cookies com `.set_session_cookies(...)` e limpar com `.clear_session_cookies(...)`.
- [ ] Manter `SESSION_SECURE_COOKIES=true` e `CSRF_ENABLED=true` fora de testes HTTP locais.
- [ ] Manter session ID restrito ao cookie de sessão, fora de JSON, URL e logs.
- [ ] Persistir senha e API key somente como hash; access tokens seguem armazenamento criptografado e retenção mínima quando forem necessários.
- [ ] Gerar segredo aleatório com `secrets.token_urlsafe()` ou `secrets.token_bytes()`.
- [ ] Comparar segredo derivado com `hmac.compare_digest()`.
- [ ] Centralizar geração e validação de API keys em `APIKeyService`.
- [ ] Exibir uma nova API key apenas uma vez e persistir somente hash + prefixo indexado.
- [ ] Manter o modo TV sem cookie de sessão.
- [ ] Dimensionar a sessão de perfil para o turno de trabalho; estações
      compartilhadas exigem logout explícito e sessão não persistente.

## Testes específicos

- [ ] Ausência, expiração, revogação e adulteração do cookie retornam `401`.
- [ ] Usuário soft-deleted não autentica.
- [ ] Usuário comum em função administrativa recebe `403`.
- [ ] Usuário A não lê, altera, remove nem lista recurso de B.
- [ ] Alterar `owner_id`, `user_id`, role ou `is_superuser` no payload não eleva privilégio.
- [ ] Métodos POST/PATCH/PUT/DELETE sem CSRF válido falham quando usam sessão.
- [ ] Login inválido não revela se username/email existe.
- [ ] Repetidas falhas de login acionam `429` e `Retry-After`.
- [ ] Logout revoga sessão e remove cookies.
- [ ] Rotas de autenticação externa não estão registradas e respondem `404`.
- [ ] API key inválida, expirada, inativa ou sem permissão falha.
- [ ] Comparação de API key ocorre por hash e resposta de listagem não contém a chave.

```bash
uv run pytest tests/unit/infrastructure/auth -q
uv run pytest tests/integration/auth -q
uv run pytest tests/unit/modules/api_keys -q
uv run pytest tests/integration/api/v1/<modulo> -q
```

Referências: [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/),
[OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
e [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
