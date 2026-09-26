# Logging, exceções e recursos

Use este guia em toda funcionalidade nova. Logs devem permitir investigar uma falha sem expor credenciais; exceções devem preservar a causa interna e devolver ao cliente apenas informações seguras.

## Logging

O backend fornece `infrastructure.logging.get_logger`. Use essa configuração central em toda funcionalidade.

```python
from ...infrastructure.logging import get_logger

logger = get_logger(__name__)
```

Adapte apenas a quantidade de pontos na importação relativa conforme o pacote.

### Checklist por evento

- [ ] Use `debug` para diagnóstico interno sem dados sensíveis.
- [ ] Use `info` para resultados relevantes de negócio.
- [ ] Use `warning` para acesso negado, entrada suspeita, retry ou degradação recuperável.
- [ ] Use `error` para uma falha conhecida sem traceback necessário.
- [ ] Dentro de `except`, use `logger.exception(...)` quando o traceback for necessário.
- [ ] Registre identificadores úteis: `user_id`, `resource_id`, operação, duração e resultado.
- [ ] Preserve o correlation ID criado pela infraestrutura; o tratamento global também gera um `support_id` para falhas inesperadas.
- [ ] Registre contexto em campos estruturados e selecione somente os atributos necessários.
- [ ] Registre cada falha uma única vez, na camada que a trata ou no handler global.

```python
logger.info(
    "profile_updated",
    extra={"user_id": str(current_user.id), "fields_changed": sorted(changes)},
)
```

### Dados excluídos dos logs

- [ ] Senhas, hashes de senha ou códigos de recuperação.
- [ ] `Authorization`, cookies, tokens de sessão, refresh tokens ou outros segredos.
- [ ] API keys completas; para correlação, use identificador público ou prefixo não secreto.
- [ ] Tokens CSRF, `SECRET_KEY`, connection strings ou variáveis de ambiente.
- [ ] Corpo completo de requests/responses, documentos e dados pessoais.
- [ ] Exceções de bibliotecas se a mensagem puder conter payloads, URLs assinadas ou credenciais.

## Tratamento de exceções

O fluxo preferido é:

1. A camada de domínio ou serviço levanta uma exceção específica de `app/support/common/exceptions.py`.
2. O handler global de `app/support/common/utils/error_handler.py` converte a exceção em resposta HTTP.
3. Falhas inesperadas recebem mensagem genérica e `support_id`; detalhes ficam apenas no log interno.

### Checklist

- [ ] Use uma exceção de domínio existente ou adicione uma exceção específica e seu mapeamento em `app/support/common/constants.py`.
- [ ] Restrinja `HTTPException` à camada de interface; CRUD e serviços levantam exceções de domínio.
- [ ] Adicione `try/except` quando houver recuperação, tradução de erro, retry controlado ou contexto útil.
- [ ] Toda exceção capturada deve ser tratada ou propagada; blocos vazios são inválidos.
- [ ] Capture exceções específicas ou `Exception`; `BaseException` fica reservado ao runtime.
- [ ] Preserve a causa com `raise MinhaExcecao(...) from exc`.
- [ ] Após registrar uma falha inesperada, relance-a com `raise` para o handler global.
- [ ] Respostas públicas excluem `str(exc)`, stack trace, SQL, nomes de tabelas e caminhos internos.
- [ ] Caminhos normais de negócio retornam resultados tipados; exceções representam falhas ou estados excepcionais.

```python
try:
    result = await provider.execute(command)
except ProviderTimeoutError as exc:
    logger.warning(
        "provider_timeout",
        extra={"provider": provider.name, "operation": command.kind},
    )
    raise ExternalServiceUnavailableError() from exc
```

Para falhas inesperadas que não podem ser tratadas localmente:

```python
try:
    await run_operation()
except Exception:
    logger.exception("operation_failed", extra={"operation": "run_operation"})
    raise
```

Esse bloco é aplicado somente quando o contexto local acrescenta informação
operacional que o handler global não possui.

## Transações

- [ ] Agrupe em uma transação todas as alterações que precisam ser atômicas.
- [ ] Faça `commit` apenas depois de todas as validações e operações dependentes.
- [ ] Em falha, execute `rollback` antes de reutilizar a sessão.
- [ ] Operações que combinam banco e serviço externo definem idempotência, outbox ou compensação para falhas parciais.
- [ ] Chamadas HTTP lentas ocorrem fora de transações abertas.

```python
try:
    await update_records(session)
    await session.commit()
except Exception:
    await session.rollback()
    raise
```

Quando a API da biblioteca oferecer um context manager transacional, use `async with session.begin():`.

## Gerenciamento e encerramento de recursos

Recursos com ciclo de vida externo — arquivos, locks, streams, conexões, sessões
e handles nativos — exigem encerramento determinístico em sucesso, falha e
cancelamento.

Use context managers como padrão para associar aquisição e encerramento:

```python
import httpx

timeout = httpx.Timeout(10.0, connect=3.0)

async with httpx.AsyncClient(timeout=timeout) as client:
    response = await client.get(url)
    response.raise_for_status()
```

Use `finally` quando o recurso não oferecer context manager ou quando o
encerramento depender de lógica própria que deva executar em sucesso, falha ou
cancelamento:

```python
resource = await acquire_resource()
try:
    return await resource.execute()
finally:
    await resource.close()
```

### Checklist de recursos

- [ ] Defina timeout de conexão e de operação para I/O externo.
- [ ] Limite tamanho de upload, download e buffers em memória.
- [ ] Use streaming para conteúdos grandes.
- [ ] Cancele ou encerre tarefas filhas quando a operação principal terminar.
- [ ] Feche recursos de forma determinística por context manager ou `finally`, independentemente de `__del__`.
- [ ] Verifique que cleanup também funciona quando a operação é cancelada.

## Testes obrigatórios

- [ ] Uma exceção de domínio produz o status e o código público esperados.
- [ ] Uma exceção inesperada não expõe detalhes e devolve um `support_id`.
- [ ] `logger.exception` é chamado uma única vez para a falha inesperada.
- [ ] Os logs não contêm senha, token, cookie, API key nem corpo sensível.
- [ ] `rollback` ocorre após falha de persistência e nenhum dado parcial permanece.
- [ ] `close`, unlock ou cleanup ocorre tanto no sucesso quanto na exceção.
- [ ] Timeouts e cancelamentos liberam os recursos.
- [ ] Falha do próprio mecanismo de logging não muda a resposta de negócio.

Execute pelo menos:

```bash
uv run pytest tests/unit -q
uv run pytest tests/integration -q
uv run pytest --cov=src --cov-report=term-missing
```
