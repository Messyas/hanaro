# Guia de mudanças no backend

Use estes checklists como definição de pronto para qualquer mudança em
`backend/`. Todos os arquivos ficam neste diretório para facilitar a leitura por
pessoas e agentes de código.

## Escolha o checklist

- Nova tabela, coluna, índice ou relação: [tabelas e migrações](01-tabelas-e-migracoes.md).
- Novo módulo, serviço, rota ou “controller”: [módulos, serviços e endpoints](02-modulos-servicos-e-endpoints.md).
- Login, sessão, permissão, API key ou operação por proprietário:
  [autenticação e autorização](03-autenticacao-e-autorizacao.md).
- Revisão de ameaças e testes de segurança: [segurança e testes](04-seguranca-e-testes.md).
- Logs, exceções, transações e liberação de recursos:
  [logging, exceções e recursos](05-logging-excecoes-e-recursos.md).
- Cache, rate limit, tarefas ou API externa: [infraestrutura e integrações](06-infra-e-integracoes.md).
- Frontend, CORS, proxy reverso ou produção: [proxy e comunicação com o frontend](07-proxy-frontend-e-deploy.md).

> A camada HTTP deste backend é implementada em `routes.py`. As rotas fazem a
> conversão entre HTTP e os contratos da aplicação e delegam as regras de
> negócio aos serviços.

## Estrutura padrão de uma funcionalidade

```text
src/modules/<funcionalidade>/
├── __init__.py
├── models.py          # SQLAlchemy: persistência
├── schemas.py         # Pydantic: contratos de entrada e saída
├── crud.py            # FastCRUD e consultas simples
├── service.py         # regras, autorização por objeto e transações
├── dependencies.py    # aliases Annotated + Depends
└── routes.py          # HTTP, status codes e response_model

tests/unit/modules/<funcionalidade>/
tests/integration/api/v1/<funcionalidade>/
```

Cada funcionalidade contém apenas as camadas que utiliza. `models.py`, `crud.py`
e migrações são aplicáveis quando existe persistência própria.

## Checklist universal antes de codificar

- [ ] Definir atores, permissões e proprietário de cada recurso.
- [ ] Definir entradas, saídas e estados de erro sem expor dados internos.
- [ ] Identificar dados pessoais, credenciais, tokens e requisitos de retenção.
- [ ] Definir limites: tamanho de payload, paginação, quantidade, frequência e timeout.
- [ ] Verificar concorrência, idempotência e efeitos de repetição da operação.
- [ ] Escolher a transação: quais escritas devem confirmar ou reverter juntas.
- [ ] Confirmar se cache, tarefa assíncrona ou integração externa é realmente necessária.
- [ ] Escrever os casos de teste de autorização antes da implementação.

## Checklist universal de implementação

- [ ] Validar entrada com Pydantic; usar `ConfigDict(extra="forbid")` em comandos de escrita.
- [ ] Construir queries parametrizadas com SQLAlchemy/FastCRUD; toda entrada variável é enviada como parâmetro.
- [ ] Retornar um schema explícito cuja allowlist exclua campos secretos e internos.
- [ ] Exigir `CurrentUserDep` ou `CurrentSuperUserDep` quando a rota não for pública.
- [ ] Aplicar autorização por objeto no serviço, independentemente da visibilidade da ação no frontend.
- [ ] Levantar exceções de domínio de `modules/common/exceptions.py`.
- [ ] Registrar eventos com `infrastructure.logging.get_logger`; `print` fica fora do código da aplicação.
- [ ] Excluir de logs senha, cookie, CSRF, API key, token OAuth, segredo e payload pessoal.
- [ ] Encerrar recursos com `async with`; aplicar `finally` aos recursos sem context manager.
- [ ] Atualizar `src/interfaces/api/v1/__init__.py` ao adicionar um router.
- [ ] Atualizar `src/modules/__init__.py` ao adicionar um modelo SQLAlchemy.
- [ ] Adicionar variáveis novas em `infrastructure/config/settings.py` e `.env.example`.

## Portão de qualidade

Execute a partir de `backend/`:

```bash
uv run ruff check src tests
uv run mypy src --config-file pyproject.toml
uv run pytest tests/unit -q
uv run pytest tests/integration -q
uv run pytest --cov=src --cov-report=term-missing
```

Os testes de integração usam PostgreSQL via Testcontainers e exigem Docker. A
aprovação da integração requer a execução efetiva desses testes.

## Definição de pronto

- [ ] Caminho feliz, falhas, limites e permissões têm testes.
- [ ] O isolamento impede que o usuário A leia ou altere recursos do usuário B.
- [ ] Usuário anônimo e usuário sem privilégio recebem `401` e `403` corretamente.
- [ ] Respostas, logs e mensagens de erro excluem campos internos.
- [ ] Migração foi revisada e testada em upgrade e downgrade, quando aplicável.
- [ ] Operações repetidas ou concorrentes preservam unicidade e consistência.
- [ ] Logs permitem investigar a operação sem conter segredos.
- [ ] Lint, tipos, testes unitários e testes de integração passam.

## Referências externas

- [Fastro](https://benavlabs.github.io/FastAPI-boilerplate/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0](https://docs.sqlalchemy.org/en/20/)
- [Alembic](https://alembic.sqlalchemy.org/)
- [Pydantic](https://docs.pydantic.dev/latest/)
- [OWASP Top 10:2025](https://owasp.org/Top10/)
- [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
