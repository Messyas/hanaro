# Checklist: tabelas e migrações

## 1. Modelar antes de criar

- [ ] Definir nome singular/plural consistente e chave primária imutável.
- [ ] Definir nulabilidade, limites de texto e valores padrão no banco.
- [ ] Usar `unique=True` para regras de unicidade global; regras condicionais usam constraint ou índice apropriado.
- [ ] Justificar cada índice por FK, filtro ou ordenação frequente.
- [ ] Definir `ForeignKey` e política de exclusão; cascata destrutiva exige regra de negócio e teste específicos.
- [ ] Decidir entre exclusão física e `SoftDeleteMixin`.
- [ ] Usar timestamps com timezone e `TimestampMixin` quando fizer sentido.
- [ ] Classificar campos pessoais e estabelecer retenção/anominização.
- [ ] Armazenar senhas e API keys como hash; tokens recuperáveis exigem criptografia e política de retenção.

## 2. Criar o modelo

Use as APIs já adotadas:

```python
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...infrastructure.database.models import TimestampMixin
from ...infrastructure.database.session import Base


class Widget(Base, TimestampMixin):
    __tablename__ = "widgets"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
```

- [ ] Herdar de `Base` e dos mixins necessários.
- [ ] Usar `Mapped[...]`, `mapped_column(...)` e a base declarativa existente.
- [ ] Adicionar relações com tipo e `back_populates` nos dois lados.
- [ ] Em código assíncrono, configurar carregamento explícito ou `selectin` conforme o caso de uso.
- [ ] Exportar o novo modelo em `src/modules/__init__.py`.
- [ ] Criar schemas separados de criação, atualização e leitura.
- [ ] O schema de leitura exclui hashes, segredos e colunas internas.

Para CRUD simples:

```python
from fastcrud import FastCRUD

from .models import Widget

crud_widgets: FastCRUD = FastCRUD(Widget)
```

Use `FastCRUD.create/get/get_multi/update/delete` ou expressões SQLAlchemy como
`select()`. Toda entrada variável deve chegar à query como parâmetro; SQL criado
com interpolação de strings fica fora do padrão do backend.

## 3. Gerar e revisar a migração

Execute a partir de `backend/`:

```bash
uv run alembic revision --autogenerate -m "create widgets"
uv run alembic upgrade head
uv run alembic current
```

- [ ] Revisar integralmente o arquivo gerado em `migrations/versions/`, incluindo operações inferidas por autogenerate.
- [ ] Confirmar nomes, tipos, FKs, índices, unique constraints e defaults.
- [ ] Garantir que `upgrade()` faça apenas a mudança planejada.
- [ ] Implementar `downgrade()` seguro quando a reversão for possível.
- [ ] Executar remoção ou renomeação de coluna com dados pelo fluxo expand/contract em deploys separados.
- [ ] Para nova coluna obrigatória: criar nullable/default, preencher em lotes, validar e só depois tornar `NOT NULL`.
- [ ] Criar índices grandes de forma compatível com disponibilidade do ambiente.
- [ ] Fazer backup e ensaio com volume semelhante ao de produção para mudança destrutiva.

Teste de ida e volta em banco descartável:

```bash
uv run alembic upgrade head
uv run alembic downgrade -1
uv run alembic upgrade head
uv run alembic check
```

Em produção, o gate existente exige `ENVIRONMENT=production`,
`CONFIRM_PRODUCTION_MIGRATION=yes` e as variáveis de segurança esperadas. As
credenciais são fornecidas exclusivamente pelo ambiente.

## 4. Testes específicos

Crie testes unitários do modelo e de integração com PostgreSQL real:

- [ ] Criação com valores válidos e aplicação dos defaults.
- [ ] Rejeição de `NULL`, texto acima do limite e enum inválido.
- [ ] Unicidade gera conflito previsível e vira exceção de domínio/HTTP apropriada.
- [ ] FK inválida é rejeitada.
- [ ] Relações carregam sem N+1 no caso de uso principal.
- [ ] Exclusão respeita soft delete/cascade definida.
- [ ] Dois inserts concorrentes não violam a regra de negócio silenciosamente.
- [ ] Usuário de outro tenant/proprietário não acessa a linha.
- [ ] Migração preserva dados existentes.

Comandos:

```bash
uv run pytest tests/unit/modules/<modulo> -q
uv run pytest tests/integration/api/v1/<modulo> -q
uv run pytest tests/unit/infrastructure/database -q
```

## 5. Transações

- [ ] Agrupar operações atômicas em uma transação.
- [ ] Executar `commit()` depois da última validação e de todas as escritas da unidade atômica.
- [ ] Preferir `async with db.begin():` quando o serviço controla a transação.
- [ ] Em tratamento manual, executar `await db.rollback()` antes de propagar a falha.
- [ ] Delegar à `AsyncSessionDep` o encerramento da sessão usada pela rota.
