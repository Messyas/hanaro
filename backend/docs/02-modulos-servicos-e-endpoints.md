# Checklist: módulos, serviços e endpoints

## 1. Definir o contrato

- [ ] Método e caminho representam a operação e são únicos no inventário de endpoints.
- [ ] `response_model`, status de sucesso e respostas `401/403/404/409/422/429` estão definidos.
- [ ] Entrada tem limites de tamanho, formato, enum e quantidade.
- [ ] Listagem exige paginação e possui limite máximo.
- [ ] Escrita repetida tem estratégia de idempotência quando puder gerar cobrança, job ou recurso duplicado.
- [ ] O contrato usa allowlist e exclui `owner_id`, `is_superuser`, flags internas e timestamps controlados pelo servidor.

## 2. Criar schemas

Use `pydantic.BaseModel`, `Field` e `ConfigDict`:

```python
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field


class WidgetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Annotated[str, Field(min_length=1, max_length=120)]


class WidgetRead(BaseModel):
    id: int
    name: str
```

- [ ] Separar `Create`, `Update`, `Read` e schemas internos.
- [ ] Definir payloads com allowlist em schemas próprios, separados dos modelos ORM.
- [ ] Aplicar normalização somente quando a regra for inequívoca; entradas inválidas geram erro explícito.
- [ ] Validar URLs externas por esquema, host/porta permitidos e destino resolvido; a validação de SSRF inclui controles além de regex.
- [ ] Excluir de todas as respostas `hashed_password`, `key_hash`, sessão, CSRF e demais credenciais.

## 3. Implementar serviço e dependência

A regra de negócio e a autorização por objeto ficam em `service.py`. Consultas
simples ficam em `crud.py`.

```python
from typing import Annotated
from fastapi import Depends

from .service import WidgetService


def get_widget_service() -> WidgetService:
    return WidgetService()


WidgetServiceDep = Annotated[WidgetService, Depends(get_widget_service)]
```

- [ ] O serviço recebe `db`, ator atual e dados já validados.
- [ ] O serviço deriva `owner_id` do usuário autenticado.
- [ ] O serviço verifica existência e propriedade na mesma operação/consulta sempre que possível.
- [ ] O serviço levanta `ResourceNotFoundError`, `ResourceExistsError`, `ValidationError` ou `PermissionDeniedError`.
- [ ] Propagar exceções que não tenham recuperação ou tradução local, preservando o traceback.
- [ ] Efeitos externos acontecem após validações e com estratégia para falhas parciais.

## 4. Criar rota fina

```python
from fastapi import APIRouter, status

from ...infrastructure.dependencies import AsyncSessionDep, CurrentUserDep
from .dependencies import WidgetServiceDep
from .schemas import WidgetCreate, WidgetRead

router = APIRouter(tags=["Widgets"])


@router.post("/", response_model=WidgetRead, status_code=status.HTTP_201_CREATED)
async def create_widget(
    values: WidgetCreate,
    current_user: CurrentUserDep,
    db: AsyncSessionDep,
    service: WidgetServiceDep,
) -> WidgetRead:
    return await service.create(values, owner_id=current_user["id"], db=db)
```

- [ ] Usar aliases de `infrastructure/dependencies.py`.
- [ ] Manter SQL, hashing, chamadas HTTP e regras de negócio nas respectivas camadas de serviço ou infraestrutura.
- [ ] Registrar o router em `src/interfaces/api/v1/__init__.py`.
- [ ] Manter documentação OpenAPI sem exemplos que contenham dados reais.
- [ ] Delegar exceções internas ao handler global, que produz mensagem pública e `support_id`.

## 5. Testes específicos

Unitários do serviço:

- [ ] Caminho feliz e retorno tipado.
- [ ] Recurso inexistente, duplicado e entrada semanticamente inválida.
- [ ] Proprietário correto, outro usuário e superusuário, se permitido.
- [ ] Dependência externa falha, expira ou retorna payload inválido.
- [ ] Transação reverte quando a segunda escrita falha.

Integração HTTP:

- [ ] Status, body e `Content-Type` do caminho feliz.
- [ ] Payload com campo extra, ausente, limite excedido e tipo errado retorna `422`.
- [ ] Anônimo recebe `401`; autenticado sem permissão recebe `403`.
- [ ] ID inexistente recebe `404` sem revelar se pertence a outro usuário quando isso criar enumeração.
- [ ] Duplicata recebe `409`.
- [ ] A resposta contém somente campos públicos e autorizados.
- [ ] Paginação limita valores extremos e não permite consulta sem limite.
- [ ] Métodos HTTP fora do contrato são rejeitados sem executar a operação.

```bash
uv run pytest tests/unit/modules/<modulo> -q
uv run pytest tests/integration/api/v1/<modulo> -q
uv run pytest tests/unit/modules/common/test_error_handler.py -q
```
