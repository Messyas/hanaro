# Infraestrutura e integrações

Use a seção correspondente sempre que a funcionalidade tocar cache, rate limit,
tarefas assíncronas, APIs externas ou arquivos. Autorização e validação na
camada de serviço permanecem obrigatórias em todos esses fluxos.

## Cache

Use a abstração existente em `infrastructure.cache`, com `get`, `set`, `delete`, `delete_pattern`, `exists`, `clear` ou o decorator `cache`.

### Checklist

- [ ] Inclua no cache key todo limite de isolamento aplicável: ambiente, tenant, usuário, recurso e versão.
- [ ] Defina TTL explicitamente de acordo com a validade do dado.
- [ ] Invalide a chave depois de qualquer escrita que altere o valor derivado.
- [ ] Exclua do cache senha, token, cookie, API key e dados pessoais desnecessários.
- [ ] Construa padrões de `delete_pattern` exclusivamente com componentes validados pelo servidor.
- [ ] Faça autenticação e autorização na fonte de verdade; presença no cache representa somente disponibilidade de dados.
- [ ] Defina o comportamento em indisponibilidade: bypass seguro ou falha fechada para decisões críticas.
- [ ] Adote lock ou coalescência contra cache stampede quando o recálculo for caro.

### Testes

- [ ] Hit e miss retornam o mesmo contrato.
- [ ] TTL expira como esperado.
- [ ] Atualização e exclusão invalidam todas as chaves relacionadas.
- [ ] Chaves isolam integralmente o conteúdo privado de usuários e tenants diferentes.
- [ ] Indisponibilidade do cache segue o comportamento seguro definido.

## Rate limit e abuso

Use `increment_and_check`, `get_count` e `reset` da infraestrutura de rate limit. A chave deve representar o sujeito correto: usuário autenticado, API key, IP confiável ou uma composição desses valores.

### Checklist

- [ ] Aplique limites menores em login, recuperação de senha, criação de sessão e envio de códigos.
- [ ] Proteja também operações caras, uploads, buscas e integrações pagas.
- [ ] Aceite `X-Forwarded-For` somente de proxies confiáveis configurados.
- [ ] Defina janela, limite e chave sem permitir bypass por pequenas variações de entrada.
- [ ] Para autenticação e operações financeiras, aplique falha fechada quando o contador estiver indisponível.
- [ ] Use respostas uniformes que não revelem a existência de contas.
- [ ] Registre bloqueios sem incluir credenciais ou payloads.

### Testes

- [ ] Requisições dentro da janela passam até o limite.
- [ ] A próxima requisição é bloqueada com resposta estável.
- [ ] A janela ou `reset` libera novamente o sujeito.
- [ ] Chaves de usuários diferentes são independentes.
- [ ] Concorrência não permite ultrapassar o limite por race condition.
- [ ] A indisponibilidade do storage segue a política documentada.

## Tarefas assíncronas

Registre tarefas com o `default_broker` do Taskiq. O helper
`register_task(task_name, broker_name, task_func)` inclui tarefas que precisam
aparecer no catálogo interno. O backend mantém um único broker central.

```python
from ...infrastructure.taskiq import default_broker, register_task


@default_broker.task
async def process_resource(resource_id: str) -> None:
    ...


register_task("process_resource", "default", process_resource)
```

Mantenha o broker centralizado em `infrastructure.taskiq`. O registro auxiliar é necessário somente se a tarefa participar do catálogo usado para desenvolvimento ou monitoramento.

### Checklist

- [ ] Passe identificadores mínimos; objetos ORM, tokens e dados pessoais completos ficam fora das mensagens.
- [ ] Recarregue o estado atual do banco dentro da tarefa.
- [ ] Torne a tarefa idempotente para suportar reentrega.
- [ ] Defina retries limitados, backoff e quais exceções são retentáveis.
- [ ] Operações externas não idempotentes usam idempotency key antes de habilitar retry.
- [ ] Valide novamente permissões ou o contexto de negócio se a tarefa executar ação privilegiada.
- [ ] Registre início, resultado, duração, attempt e identificador da tarefa sem segredos.
- [ ] Defina timeout, tratamento de poison message e destino de falhas permanentes.
- [ ] Feche sessões e clientes externos com `async with` ou `finally`.

### Testes

- [ ] Execução normal produz o efeito esperado.
- [ ] A mesma mensagem duas vezes não duplica o efeito.
- [ ] Erro transitório faz retry; erro permanente não entra em loop.
- [ ] Estado alterado ou recurso removido antes da execução é tratado com segurança.
- [ ] Falha parcial não deixa a operação inconsistente.
- [ ] Logs e mensagens da fila não contêm segredos.

## APIs externas

Use `httpx.AsyncClient`, `httpx.Timeout`, `httpx.Limits` e `response.raise_for_status()`. Valide a resposta externa com um schema Pydantic antes de utilizá-la no domínio.

```python
import httpx

timeout = httpx.Timeout(10.0, connect=3.0)
limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)

async with httpx.AsyncClient(timeout=timeout, limits=limits) as client:
    response = await client.get(provider_url, headers=safe_headers)
    response.raise_for_status()
    payload = ProviderResponse.model_validate(response.json())
```

### Checklist

- [ ] Mantenha host, esquema e porta em allowlist quando qualquer parte da URL vier do cliente.
- [ ] Bloqueie endereços loopback, link-local, redes privadas e metadata de cloud em recursos de fetch/proxy.
- [ ] Revalide cada redirect contra a allowlist antes de segui-lo.
- [ ] Defina timeouts de conexão, leitura, escrita e pool.
- [ ] Limite conexões, tamanho de resposta e número de páginas.
- [ ] Use TLS com validação de certificados habilitada.
- [ ] Guarde credenciais em settings/secret manager e exclua-as do código e dos logs.
- [ ] Aceite apenas os campos esperados; use Pydantic com `extra="forbid"` quando o contrato precisar ser estrito.
- [ ] Faça retry apenas de falhas transitórias e operações idempotentes, com backoff e jitter.
- [ ] Traduza erros do provedor para exceções de domínio sem expor a resposta original.
- [ ] Valide dados da integração como entrada externa não confiável.

### Testes

- [ ] Sucesso e cada classe de erro relevante do provedor.
- [ ] Timeout de conexão e leitura.
- [ ] Resposta inválida, campos extras, JSON malformado e payload grande.
- [ ] Redirect para host não permitido e tentativas de SSRF.
- [ ] Retry respeita limite e não repete operação não idempotente.
- [ ] Cliente/conexão fecha em sucesso, erro e cancelamento.

## Uploads, arquivos e conteúdo binário

- [ ] Limite tamanho antes de carregar o conteúdo inteiro em memória.
- [ ] Valide tipo real do conteúdo além de extensão e `Content-Type`.
- [ ] Gere nomes e caminhos internos no servidor; o caminho enviado pelo cliente não participa da resolução no filesystem.
- [ ] Impeça path traversal e gravação fora do diretório permitido.
- [ ] Armazene fora da raiz pública quando o arquivo exigir autorização.
- [ ] Faça download com autorização por objeto e cabeçalhos seguros.
- [ ] Considere análise antimalware para conteúdo fornecido por usuários.
- [ ] Remova temporários em `finally` e teste falhas durante upload/processamento.

## Verificação final

```bash
uv run ruff check src tests
uv run mypy src --config-file pyproject.toml
uv run pytest tests/unit -q
uv run pytest tests/integration -q
```

Além dos testes do módulo, simule indisponibilidade e latência do componente externo. Uma integração só está pronta quando seu modo de falha também está definido e testado.
