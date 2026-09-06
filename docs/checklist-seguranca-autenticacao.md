# Checklist de segurança, autenticação e autorização

**Data da revisão:** 04/09/2026  
**Escopo:** frontend Angular, API FastAPI/CRUDAuth e configuração de sessão/rate limit.  
**Legenda:** ✅ coberto por código e teste automatizado; ◐ parcial ou depende de validação no ambiente; ❌ não há cobertura/implementação comprovada.

> Este documento é um checklist de validação. Um item marcado como ✅ significa que existe uma evidência automatizada, não que a proteção foi validada contra todos os cenários de produção.

## Resultado executivo

- A API usa sessão server-side (Redis em produção), cookie seguro e CSRF. Há testes de login, logout, sessão anônima, CSRF e autorização de superusuário.
- A rota pública `/dashboard` é intencional. Rotas operacionais usam `authenticatedGuard`, mas o guard redireciona para o shell do dashboard (que abre o login), não para uma URL `/login`.
- `/configuracoes` continua sendo uma rota pública para permitir Preferences, mas agora as abas de classificações, tipos de scrap e targets são ocultadas e bloqueadas para anônimos, e as APIs protegidas não são carregadas sem sessão. Ainda é necessária validação E2E de acesso direto/deep link.
- Não existe evidência de trilha de auditoria específica para downloads. Os endpoints que servem arquivos devem registrar ator, recurso, horário, IP e resultado antes de serem considerados conformes.
- CAPTCHA, detecção por jitter e mitigação de DDoS não são responsabilidades suficientes da aplicação. O rate limit existente é uma camada de aplicação; DDoS deve ser validado/configurado no proxy/WAF da implantação.

## Matriz de requisitos

| Requisito | Evidência encontrada | Status | Validação pendente / critério de aceite |
|---|---|---:|---|
| Acessar sem senha | `backend/tests/integration/auth/test_endpoints.py`: login válido/inválido; dependências retornam 401 sem principal | ✅ | Tentar cada endpoint protegido sem cookie: sempre 401/403, sem dados |
| Acessar nível não autorizado | `get_current_superuser` e dependências de `CurrentUserDep`/`CurrentSuperUserDep`; testes em `test_dependencies.py` | ✅ | Usuário comum tentando endpoint admin deve receber 403 e não alterar dados |
| Tokens, sessão e tempo de acesso | `SessionTransport`, CSRF, timeout configurável (`SESSION_TIMEOUT_MINUTES=30`) e testes de refresh/CSRF | ◐ | Em staging, verificar cookie, expiração absoluta/inatividade e revogação após logout/rotação |
| Impedir navegador de gravar senha | Login usa `autocomplete="current-password"` | ◐ | Não é possível impedir gravação controlada pelo navegador. Confirmar política UX; nunca armazenar senha no app/localStorage |
| AuthGuard | `frontend/src/app/core/auth/auth.guard.ts`, rotas protegidas e `auth.guard.spec.ts` | ✅ | Complementar com E2E em refresh/deep link |
| Roteamento e XSS | wildcard Angular redireciona para dashboard; interpolação Angular escapa HTML | ◐ | Testar `<script>alert(1)</script>` em todos os campos e confirmar que nunca é executado/renderizado como HTML; revisar uso futuro de `innerHTML` |
| Rotas sem autenticação levam ao login | Shell abre diálogo de login; guard redireciona para `/dashboard` | ◐ | Política atual não é “redirect para `/login`”. Decidir contrato e testar navegação direta, refresh e deep link |
| Sessão ao fechar página | Não há logout em `beforeunload` | ❌ (não implementado) | Não exigir logout por fechamento como mecanismo de segurança; validar expiração/revogação server-side. Se obrigatório, especificar UX e teste de risco |
| Evitar 404 que revele rotas | wildcard frontend redireciona para dashboard; APIs ainda respondem conforme FastAPI | ◐ | Testar URLs inexistentes sem expor stack trace, nomes internos ou dados; validar resposta uniforme no edge |
| Regex/sanitização em todos os campos | Não há regex global; há limites/validação por schema e escaping do Angular | ◐ | Não usar regex como defesa primária. Testar payloads XSS/SQL em cada formulário e validar persistência/saída codificada |
| Bloqueio após 3 tentativas | `LOGIN_MAX_ATTEMPTS=3`, configuração do `SessionTransport` e tratamento frontend de 429/`Retry-After`; spec valida a política | ✅ | Complementar com teste de integração usando Redis real para confirmar contadores distribuídos |
| Sem cadastro/troca de senha pública | `create_user` exige `CurrentSuperUserDep`; rotas externas/recovery não são registradas; teste confirma 404 de auth externa | ✅ | Enumerar OpenAPI em produção e confirmar que criação/troca só funciona autenticado/admin |
| Bot/CAPTCHA/DDoS | `RateLimiterMiddleware` aplica limite por IP; Redis/memcached configurável; fail-closed agora é o padrão (`RATE_LIMITER_FAIL_OPEN=false`) | ◐ | CAPTCHA/jitter foram excluídos. Validar limites no WAF/Cloudflare e teste de carga autorizado |
| Auditar downloads | Há `FileResponse` para imagem de perfil e anexos; não foi encontrada trilha específica de download | ❌ | Criar evento de auditoria (usuário/sessão, recurso, IP, user-agent, status, timestamp) e teste de autorização + registro |
| Dashboard sem login | `/dashboard` não usa guard por decisão de produto | ✅ (por desenho) | Confirmar que o dashboard anônimo só mostra dados permitidos e não chama endpoints protegidos com dados sensíveis |
| Settings: somente Preferences anônimo | `SettingsPage` oculta/bloqueia abas protegidas e não carrega suas APIs para anônimos; teste cobre esse contrato | ✅ | Confirmar também autorização no backend e acesso direto em E2E |

## Testes já existentes

### Backend

- `backend/tests/integration/auth/test_endpoints.py`: login válido/inválido, usuário excluído, logout, CSRF, refresh de CSRF e `check-auth` anônimo/autenticado.
- `backend/tests/unit/infrastructure/auth/test_routes.py`: contratos das rotas de autenticação e ausência de rotas externas.
- `backend/tests/unit/infrastructure/auth/test_dependencies.py`: 401 sem principal, usuário inexistente/excluído e 403 para não-superusuário.
- `backend/tests/unit/infrastructure/test_middleware.py`: headers de segurança por ambiente.
- `backend/tests/unit/infrastructure/security/test_production_validator.py`: validações de configuração de produção.
- `backend/tests/unit/infrastructure/rate_limit/` e `backend/tests/unit/modules/rate_limit/`: backend e políticas de rate limit; não substituem teste de lockout de login nem teste de DDoS.

### Frontend

- `frontend/src/app/core/auth/auth.service.spec.ts`: `check-auth` anônimo e fluxo de login.
- `frontend/src/app/core/auth/auth.guard.spec.ts`: sessão válida libera rota; sessão ausente retorna UrlTree para dashboard.
- `frontend/src/app/app.routes.spec.ts`: política de rotas protegidas e wildcard.
- `frontend/src/app/app.routes.server.spec.ts`: renderização client-side das rotas API-backed.
- `frontend/src/app/pages/settings/settings-page.spec.ts`: abas e operações de settings, atualmente com usuário autenticado.
- `frontend/src/app/pages/settings/settings-page.spec.ts`: acesso anônimo limitado a Preferences e escaping de texto controlado pelo usuário.

## Plano de execução recomendado

1. **Unitário:** adicionar spec do `authenticatedGuard` e specs de SettingsPage com `isAuthenticated=false`, verificando que somente Preferences fica acessível.
2. **Integração de autenticação:** usar um cliente sem cookies; cobrir matriz 401/403 para cada router protegido; testar 3 tentativas inválidas e expiração da sessão.
3. **E2E em staging:** abrir diretamente `/execucoes`, `/relatorios`, `/perfil` e cada aba de `/configuracoes` em janela anônima; confirmar que não há dados nem mutações.
4. **XSS:** inserir `<script>alert(1)</script>` e atributos/eventos (`"><img src=x onerror=alert(1)>`) em campos de texto; verificar DOM, resposta e banco.
5. **Downloads:** baixar perfil/anexo como anônimo, usuário autorizado e usuário sem permissão; confirmar status esperado e evento de auditoria.
6. **Edge/WAF:** executar teste de carga autorizado, conferir limites por IP/usuário, `Retry-After`, logs correlacionáveis e proteção DDoS do provedor. Não usar CAPTCHA/jitter como substituto de autorização.

## Comandos de referência

```powershell
cd backend
uv run --no-sync pytest tests/integration/auth tests/unit/infrastructure/auth tests/unit/infrastructure/rate_limit tests/unit/infrastructure/test_middleware.py

cd ../frontend
npm test -- --watch=false
```

## Critério de conclusão

O checklist só pode ser marcado como concluído quando os itens ◐ tiverem evidência no ambiente de implantação e os itens ❌ tiverem correção acompanhada de testes automatizados (especialmente Settings, lockout, encerramento/expiração da sessão e auditoria de downloads).

## Execução desta revisão

- Backend: **90 testes passaram** (autenticação, dependências, rate limit e middleware) com `DEBUG=false`; o novo teste de configuração de lockout também passou.
- Frontend: **20 testes passaram** nos specs de autenticação, guard, Settings, política de rotas e rotas SSR.
- O primeiro comando do backend falhou antes da coleta porque o ambiente local tinha `DEBUG=release`, valor incompatível com o campo booleano `DEBUG`; isso é configuração do ambiente de teste, não falha funcional de autenticação.
