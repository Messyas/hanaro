# Plano de implementação e roteiro de testes — automação GERP Material Scrap

> Documento operacional para desenvolvimento, homologação na intranet e publicação no Smart Office.
>
> Data planejada para o primeiro teste na intranet: **15/09/2026**
> Fuso operacional: **America/Manaus**
> Relatório GERP: **Other Account Transaction Text Download**
> Programa/request: **Textdown:XXINVM**

## 1. Objetivo

Implementar o trecho ainda ausente da automação de Material Scrap:

1. autenticar no SSO EP/EPLG da LG;
2. acessar o portal GERP;
3. baixar e iniciar o JNLP do cliente **GERP Production**;
4. abrir o request `Textdown:XXINVM`;
5. executar o relatório `Other Account Transaction Text Download` para a janela e organização solicitadas;
6. acompanhar o request até o estado terminal de sucesso;
7. baixar e validar o TSV;
8. usar o pipeline canônico já existente no Hanaro;
9. enviar o lote para `POST /api/v1/scrap/ingestions`;
10. acompanhar a ingestão e registrar evidências operacionais.

Este documento também define como testar cada camada separadamente, como fazer o teste ponta a ponta com população local e como preparar um pacote para o Smart Office/BotCity.

## 2. Escopo e limites de segurança

### Incluído

- SSO EP/EPLG, portal GERP e cliente Java/JNLP.
- Consulta **somente leitura** do relatório de Other Account Transaction.
- Download, validação estrutural, normalização e envio ao Hanaro.
- Execução local assistida e execução pelo Runner do Smart Office.
- Logs, correlação, timeouts, screenshots de erro e limpeza de recursos do próprio robô.
- Testes sem envio, com dados sintéticos, com arquivo real e ponta a ponta.

### Fora do escopo

- Lançamento ou alteração de despesas no GERP.
- Reaproveitamento do fluxo de escrita do projeto `gerp_bl-main`.
- Encerrar todos os processos `chrome.exe`, `msedge.exe`, `firefox.exe`, `java.exe` ou `jp2launcher.exe` da máquina.
- Registrar senha, token, cookie, `personal_id_code`, conteúdo integral de comentários ou dados pessoais nos logs.
- Publicar diretamente como versão de produção sem homologação manual no Runner selecionado.
- Usar o Smart Office como armazenamento permanente do TSV ou das credenciais.

### Regra de parada durante a homologação

Interromper imediatamente o teste se a automação abrir um módulo de inclusão/alteração, apresentar botão de gravação de transação, selecionar responsabilidade diferente da homologada ou apontar para ambiente diferente do GERP autorizado. O teste deve produzir apenas um request de relatório e um arquivo de saída.

## 3. Estado atual confirmado

O Hanaro já possui:

- parser rígido para UTF-8/CP1252 e TSV com 29 posições;
- normalização, reconciliação e contrato JSON canônico `1.0.0`;
- cálculo de hash e linhagem do arquivo;
- envio HTTP com `X-API-Key`;
- endpoint assíncrono de ingestão;
- worker Taskiq;
- idempotência por arquivo, janela e escopo;
- estados e etapas de execução exibidos no backend/frontend;
- simulação local via Docker Compose.

Ainda falta a implementação concreta de `GerpSource.obtain_file()`. O arquivo `automation/modules/gerp_client.py` é apenas um contrato/placeholder.

### Referências antigas avaliadas

| Projeto | Uso recomendado |
|---|---|
| `if-cost-automation-master` | Fonte principal para entender SSO, portal, JNLP, responsabilidades, request e download. Não copiar sem revisão. |
| `GERP_Other account (1)` | Mapa visual dos passos no cliente desktop. Não usar diretamente em produção. |
| `gerp_bl-main` | Referência de BotCity Desktop e imagens, mas o caso de uso é escrita de custos, não extração de Material Scrap. |

Os dois arquivos reais `Other_Account_Transaction_Text_*` já encontrados em Downloads têm exatamente o cabeçalho esperado pelo parser atual e nenhuma linha estruturalmente malformada na verificação realizada.

## 4. Arquitetura alvo

```text
Smart Office / BotCity Runner (Windows, sessão interativa)
    |
    |-- obtém parâmetros não secretos da tarefa
    |-- obtém credenciais do cofre do orquestrador
    v
HanaroMaterialScrapBot
    |
    |-- cria execution_id/correlation_id uma única vez
    |-- registra a execução no backend
    v
EplgAuthenticator ----> EP/EPLG SSO
    v
GerpPortalClient -----> Portal GERP e download do JNLP
    v
GerpDesktopClient ----> GERP Production / Textdown:XXINVM
    v
GerpRequestMonitor ---> request_id + Completed/Normal
    v
StableDownloadWatcher -> arquivo novo, completo e estável
    v
GerpDownloadSource ---> Path validado
    v
build_canonical_batch(mode="GERP_RPA", execution_id=<mesmo UUID>)
    v
HttpBatchSender ------> POST /api/v1/scrap/ingestions
    v
Redis / Taskiq worker -> PostgreSQL -> dashboard e tela de execuções
```

### Separação obrigatória dos ambientes

O robô visual precisa rodar em **Windows com desktop interativo**, navegador, Java/JNLP e acesso à intranet. Ele não deve ser colocado dentro do container Linux `automation/Dockerfile`.

O parser, a normalização, a API, o Redis, o worker e o PostgreSQL continuam portáveis e testáveis em Docker. O limite entre os dois ambientes é o `Path` de um TSV validado e o contrato JSON canônico.

## 5. Estrutura de código proposta

```text
automation/
├── gerp/
│   ├── __init__.py
│   ├── config.py              # configuração validada, sem leitura espalhada de env
│   ├── errors.py              # erros tipados e códigos operacionais
│   ├── models.py              # request, resultado, sessão e metadados
│   ├── sso.py                 # protocolo e adaptador EP/EPLG
│   ├── portal.py              # portal web e aquisição do JNLP
│   ├── desktop.py             # cliente GERP Production
│   ├── request_monitor.py     # polling de status e request_id
│   ├── download.py            # detecção e estabilidade do arquivo
│   └── source.py              # GerpDownloadSource(GerpSource)
├── material_scrap/            # pipeline atual, preservado
├── smartoffice/
│   ├── bot.py                 # entrypoint BotCity/Maestro
│   ├── orchestration.py       # fluxo e atualização das etapas no backend
│   ├── maestro.py             # parâmetros, credenciais e finish_task
│   ├── requirements.txt       # dependências Windows/RPA
│   ├── HanaroMaterialScrap.botproj
│   ├── build.ps1
│   └── build.bat
├── resources/
│   └── gerp/                  # imagens somente quando não houver seletor/controle
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
```

Não mover as dependências Windows para `automation/requirements.txt`, pois esse arquivo é usado pela imagem Linux da simulação. BotCity, Selenium/driver, `pywinauto`, `pywin32` e integrações do Smart Office devem ficar em `automation/smartoffice/requirements.txt`.

## 6. Contratos principais

### 6.1 Configuração

Usar um único objeto imutável e validado, por exemplo `GerpAutomationSettings`. Nenhuma classe de domínio deve chamar `os.getenv()` diretamente.

| Variável/parâmetro | Obrigatório | Secreto | Observação |
|---|---:|---:|---|
| `HANARO_BACKEND_URL` | sim no E2E | não | HTTPS no ambiente compartilhado. |
| `HANARO_API_KEY` | sim no envio | sim | Cofre do Smart Office; nunca parâmetro visível. |
| `HANARO_GERP_CREDENTIAL_LABEL` | sim no Runner | não | Nome lógico do segredo no orquestrador. |
| usuário EPLG | sim | sim | Recuperado do cofre. |
| senha EPLG | sim | sim | Recuperada do cofre. |
| matrícula/employee number | conforme SSO | sim | Recuperada do cofre. |
| personal ID code | conforme SSO | sim | Recuperado do cofre. |
| `query_date_from` | sim | não | ISO `YYYY-MM-DD` na tarefa; converter para o formato da tela. |
| `query_date_to` | sim | não | Não pode ser anterior ao início ou futura. |
| `organization_parameter` | sim | não | Começar com uma organização homologada; testar `ALL` separadamente. |
| `exchange_rate` | sim enquanto manual | não | Decimal positivo, nunca `float`. |
| `exchange_rate_source` | sim | não | Ex.: `manual_homologation`. |
| `download_directory` | sim | não | Diretório exclusivo por execução. |
| `headless` | não | não | Deve permanecer `false` para JNLP/desktop. |
| timeouts | sim, com defaults | não | Login, portal, JNLP, janela, request e download. |

Credenciais devem existir apenas em memória pelo tempo necessário. Não incluí-las em `.env`, linha de comando, screenshots, exceções ou metadados do BotCity.

### 6.2 Contexto da execução

O Runner deve criar uma vez:

```python
execution_id = uuid.uuid4()
correlation_id = str(execution_id)
```

Esse mesmo UUID deve aparecer em:

- registro inicial da execução;
- logs locais;
- atualizações das etapas;
- nome do diretório temporário;
- lote canônico;
- resposta de ingestão;
- evidências da homologação.

Alteração necessária: `build_canonical_batch()` deve aceitar `execution_id` opcional. Quando o chamador não fornecer, preserva-se a geração atual para compatibilidade. No modo `GERP_RPA`, o orquestrador deve sempre fornecê-lo.

### 6.3 Resultado da aquisição

Além do `Path`, a implementação concreta deve manter metadados operacionais:

```python
@dataclass(frozen=True)
class GerpDownloadResult:
    path: Path
    request_id: str
    organization_parameter: str
    query_date_from: date
    query_date_to: date
    downloaded_at: datetime
```

O protocolo atual retorna somente `Path`. Para não acoplar o pipeline à UI, há duas opções aceitáveis:

1. manter `obtain_file() -> Path` e expor `last_result` somente no adaptador; ou
2. introduzir um novo protocolo `GerpDownloadProvider` que retorna `GerpDownloadResult`, deixando `GerpSource` como fachada compatível.

Preferir a opção 2 por tornar o request ID obrigatório e testável.

## 7. Fluxo de implementação

### Fase 0 — descoberta assistida na intranet

Antes de automatizar, executar manualmente o roteiro da seção 11 e registrar:

- URL inicial real do EP/EPLG;
- quantidade e significado dos campos do login;
- existência de OTP, biometria, CAPTCHA ou aprovação externa;
- URL final do portal GERP;
- seletor estável do menu/responsabilidade;
- nome e origem do JNLP;
- título real da janela Java;
- responsabilidade e módulo corretos para NW1, NW4, NWK e demais organizações;
- formato de data exigido pela tela;
- campo do request ID;
- estados intermediários e estado terminal exato;
- comportamento de `Organization Code = ALL`;
- nome, extensão e encoding reais do arquivo.

Não inspecionar ou automatizar mecanismo destinado a bloquear bots sem autorização formal. Se houver MFA/OTP, tratar como passo assistido ou usar identidade de serviço homologada pela LG.

**Critério de conclusão:** uma execução manual, somente leitura, gera um TSV válido para uma janela curta.

### Fase 1 — fundação, configuração e erros

Implementar primeiro sem navegador:

- settings validados;
- criação de diretório exclusivo por execução;
- erros tipados;
- redator de segredos em logs;
- relógio e polling injetáveis;
- política de timeout;
- limpeza apenas dos processos iniciados pelo próprio robô;
- interfaces para SSO, portal, desktop, monitor e download.

Códigos mínimos de erro:

| Código | Categoria | Exemplo |
|---|---|---|
| `SSO_AUTH_FAILED` | `AUTHENTICATION` | Credencial recusada. |
| `SSO_INTERACTION_REQUIRED` | `AUTHENTICATION` | OTP/MFA precisa de pessoa. |
| `GERP_PORTAL_UNAVAILABLE` | `NETWORK` | Portal não abriu no timeout. |
| `JNLP_NOT_DOWNLOADED` | `GERP_STARTUP` | Portal não entregou o JNLP. |
| `GERP_WINDOW_TIMEOUT` | `GERP_STARTUP` | Janela Java não surgiu. |
| `GERP_NAVIGATION_FAILED` | `GERP_REQUEST` | Responsabilidade/módulo não encontrado. |
| `GERP_REQUEST_FAILED` | `GERP_REQUEST` | Request terminou com erro. |
| `GERP_REQUEST_TIMEOUT` | `GERP_REQUEST` | Não alcançou estado terminal. |
| `DOWNLOAD_NOT_STARTED` | `FILE_DOWNLOAD` | Nenhum arquivo novo apareceu. |
| `DOWNLOAD_NOT_STABLE` | `FILE_DOWNLOAD` | Arquivo continuou crescendo ou temporário. |
| `GERP_FILE_INVALID` | `FILE_VALIDATION` | Header, encoding ou conteúdo inválido. |
| `BACKEND_REJECTED` | `INGESTION` | API retornou 4xx/5xx. |

**Critério de conclusão:** todos os componentes podem ser testados com fakes, sem intranet.

### Fase 2 — autenticação EP/EPLG

Criar o protocolo `EplgAuthenticator` e começar com um adaptador da biblioteca interna `dxacademy.eplg.Login`, caso ela esteja disponível no índice corporativo e sua utilização esteja autorizada.

Requisitos:

- receber credenciais por objeto secreto, nunca no construtor global ou em constantes;
- detectar sucesso por elemento/URL esperado, não por `sleep`;
- não registrar URL completa se ela contiver token/query string de SSO;
- diferenciar credencial inválida, indisponibilidade e interação/MFA;
- limitar tentativas para evitar bloqueio da conta;
- não marcar “lembrar meu ID” automaticamente;
- permitir teste `login_only` que encerra antes do GERP.

Se `dxacademy` não puder ser instalado ou não estiver autorizado, implementar o login observado na Fase 0 por seletor estável. Não copiar credenciais nem tokens do projeto legado.

**Critério de conclusão:** o teste `login_only` chega à página autenticada do EP/EPLG e encerra o navegador criado pelo robô.

### Fase 3 — portal GERP e JNLP

Responsabilidades do `GerpPortalClient`:

- navegar para o portal por URL configurada;
- validar que a sessão SSO foi transferida;
- selecionar responsabilidade e módulo homologados;
- capturar o estado do diretório antes do clique;
- solicitar o JNLP;
- aguardar um arquivo novo pelo evento/estado do filesystem;
- rejeitar arquivo vazio ou ainda temporário;
- iniciar o JNLP usando associação configurada ou executável homologado;
- registrar o PID/processo iniciado quando possível;
- aguardar a janela GERP com timeout monotônico.

Não procurar `frmservlet.jnlp` recursivamente em toda a pasta do usuário, como faz o legado. O download deve acontecer no diretório exclusivo da execução.

**Critério de conclusão:** `portal_and_launch` abre a janela GERP e encerra apenas os processos iniciados nesse teste.

### Fase 4 — cliente desktop e execução do relatório

Prioridade de automação:

1. controles acessíveis por `pywinauto`/UI Automation;
2. atalhos de teclado estáveis da aplicação;
3. seletores de imagem BotCity com região de busca restrita;
4. coordenadas absolutas somente como último recurso e nunca como estratégia principal.

Fluxo:

1. ativar e maximizar somente a janela GERP esperada;
2. selecionar organização/responsabilidade;
3. abrir lista de valores/request;
4. informar `Textdown:XXINVM`;
5. selecionar `Other Account Transaction Text Download`;
6. preencher organização e janela;
7. submeter uma única vez;
8. capturar o request ID;
9. consultar/atualizar o status com polling limitado;
10. aceitar somente o par de sucesso homologado, inicialmente `Completed/Normal`;
11. abrir o output uma única vez.

Não reenviar automaticamente um request após timeout sem antes verificar pelo request ID se o primeiro continua ativo. Isso evita duplicidade.

**Critério de conclusão:** request ID registrado e output aberto sem alteração de dados do GERP.

### Fase 5 — download robusto

O `StableDownloadWatcher` deve:

- tirar snapshot de nome, tamanho e `mtime` antes do clique;
- ignorar arquivos já existentes;
- ignorar `.crdownload`, `.part`, `.tmp` e equivalentes;
- exigir pelo menos duas ou três observações consecutivas com mesmo tamanho;
- tentar abrir o arquivo com compartilhamento de leitura para confirmar que não está bloqueado;
- limitar a espera por timeout;
- validar tamanho maior que zero;
- executar `parse_gerp_tsv()` antes de retornar sucesso;
- calcular SHA-256;
- mover por operação segura para o diretório da execução;
- nunca escolher simplesmente “o arquivo mais recente da pasta Downloads”.

Não usar o consolidado legado com `on_bad_lines="skip"`: descartar linhas silenciosamente é incompatível com a reconciliação do Hanaro.

**Critério de conclusão:** arquivos parciais, antigos ou estruturalmente inválidos são rejeitados; apenas o novo TSV completo é retornado.

### Fase 6 — integração com o pipeline Hanaro

Extrair uma função de aplicação reutilizável, sem `argparse`, por exemplo:

```python
def process_source(
    source_file: Path,
    context: RunContext,
    exchange_rate_provider: ExchangeRateProvider,
    *,
    execution_id: UUID | None = None,
    mode: Literal["LOCAL_FILE_SIMULATION", "GERP_RPA"],
) -> CanonicalMaterialScrapBatch: ...
```

O CLI atual e o bot Smart Office chamam essa função. O CLI continua compatível.

Mapear o ciclo visual nas etapas já existentes:

| Etapa do backend | Início | Conclusão |
|---|---|---|
| `GERP_REQUEST` | antes de abrir responsabilidade/request | request submetido e ID capturado |
| `GERP_REPORT_GENERATION` | após submissão | status `Completed/Normal` confirmado |
| `FILE_DOWNLOAD` | antes de abrir output | arquivo estável movido para a execução |
| `FILE_VALIDATION` | antes do parser | encoding/header/linhas validados |
| `DATA_NORMALIZATION` | antes de `build_canonical_batch` | reconciliação concluída |
| `EXCHANGE_RATE` | antes de obter a taxa | taxa válida anexada |
| `JSON_VALIDATION` | antes de serializar/enviar | contrato `1.0.0` validado |
| `SNAPSHOT_PUBLICATION` | após `202 QUEUED` | worker publica ou execução termina com falha |

Há uma lacuna atual de provisionamento: criar uma API key pela rota existente não cria automaticamente a linha granular em `key_permissions`. Antes do teste E2E, implementar ou fornecer um comando administrativo auditável para conceder somente:

```text
resource = material_scrap
action   = create
allowed  = true
```

Não conceder wildcard ao robô.

**Critério de conclusão:** uma única execução aparece na tela de execuções com o mesmo UUID desde o GERP até a publicação.

### Fase 7 — Smart Office/BotCity

O entrypoint deve:

1. criar `BotMaestroSDK.from_sys_args()` sem servidor/login/token embutidos;
2. ler parâmetros da tarefa;
3. buscar credenciais no cofre;
4. iniciar a execução Hanaro;
5. executar o caso de uso;
6. anexar somente evidências sanitizadas;
7. finalizar a tarefa com sucesso ou falha coerente;
8. executar limpeza em `finally` sem matar processos alheios.

O pacote deve conter apenas:

- `bot.py`;
- código `automation/gerp`, `automation/material_scrap` e `automation/smartoffice` necessário;
- `requirements.txt` Windows;
- recursos de imagem homologados;
- metadados do projeto.

Excluir do pacote:

- `.env`;
- credenciais;
- fixtures reais;
- exports GERP;
- screenshots com dados pessoais;
- `artifacts/`;
- caches, `.git`, testes e documentos internos desnecessários.

Segundo a documentação oficial da BotCity, projetos Python são construídos pelo `build.bat`/`build.sh` e publicados como `.zip` ou `.tar.gz`; o Easy Deploy associa o pacote a uma versão e a um Runner. Usar **versão nova**, não sobrescrever a versão anterior, e só marcar como release após o smoke test. Referências: [Orquestrando sua automação](https://documentation.botcity.dev/pt/tutorials/orchestrating-your-automation/) e [Robôs no Maestro](https://documentation.botcity.dev/pt/maestro/features/bots/).

## 8. Estratégia de organizações

Esta decisão precisa ser tomada na intranet:

### Caminho preferido: `ALL`

Se um único request com `Organization Code = ALL` produzir todas as organizações permitidas e o arquivo passar na reconciliação, usar um único TSV e `organization_parameter="ALL"`.

### Fallback: uma execução por organização

Se `ALL` não funcionar:

- criar um request separado para cada organização homologada;
- processar e publicar cada TSV com seu `organization_parameter` real;
- usar um `execution_id` por arquivo/request;
- não concatenar arquivos silenciosamente;
- permitir que o backend reconcilie somente as partições cobertas.

Não assumir que NW1, NW4 e NWK são a lista completa. Registrar a lista fornecida pelo responsável de negócio.

## 9. Estratégia de testes automatizados

### Testes unitários — sem browser/intranet

- settings obrigatórios, datas, organizações e timeouts;
- redação de senha/token/cookie em logs e exceções;
- transições do orquestrador;
- cálculo de deadline com relógio monotônico;
- polling até sucesso, falha e timeout;
- detecção de download novo;
- rejeição de arquivo temporário, vazio, antigo e instável;
- parser chamado antes de retornar o `Path`;
- request não é reenviado após timeout ambíguo;
- cleanup encerra apenas PIDs registrados;
- mesmo `execution_id` atravessa todos os componentes;
- falha antes do download preserva o snapshot anterior;
- credenciais não aparecem em logs capturados.

### Testes de integração local — fakes

- servidor HTTP fake representando EP/EPLG e portal;
- diretório temporário simulando JNLP e download;
- fake desktop reproduzindo estados `Pending`, `Running`, `Completed/Normal` e erro;
- backend local recebendo o contrato canônico;
- replay do mesmo arquivo confirma idempotência;
- nova versão na mesma janela substitui o snapshot somente após publicação completa.

### Testes manuais na intranet

Executar na ordem da seção 11. Nunca começar pelo teste completo.

## 10. Preparação para 15/09/2026

### Checklist de acesso e máquina

- [ ] Notebook conectado à rede/VPN autorizada da LG.
- [ ] Conta EP/EPLG desbloqueada e login manual confirmado.
- [ ] Responsabilidades GERP necessárias atribuídas à conta.
- [ ] Acesso manual ao relatório confirmado.
- [ ] Chrome ou navegador homologado instalado.
- [ ] Java/JNLP homologado instalado e associação `.jnlp` funcionando.
- [ ] BotCity Studio/Runner disponível, se o teste de publicação ocorrer.
- [ ] Runner Windows está online e tem sessão interativa; tela não bloqueia durante o teste.
- [ ] Escala de tela e resolução registradas para recursos visuais.
- [ ] Diretório de download exclusivo criado e gravável.
- [ ] Nenhum arquivo real será versionado ou anexado a ticket sem sanitização.
- [ ] Responsável de negócio confirmou organização e janela seguras.
- [ ] Existe um plano de rollback para a versão do bot no Smart Office.

### Checklist do Hanaro local

Na raiz do repositório:

```powershell
docker version
docker compose version
docker compose config --quiet
git status --short
```

O último comando é somente informativo. Há alterações locais no repositório; não limpar nem resetar o worktree para realizar esta homologação.

Preparar configuração local sem credenciais GERP:

```powershell
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
```

Preencher no `.env` somente valores locais do Hanaro. Não colocar usuário, senha, matrícula ou personal ID do EPLG nesse arquivo.

## 11. Roteiro de homologação na intranet

Preencher a ficha da seção 13 a cada teste.

### T01 — login manual EP/EPLG

**Objetivo:** confirmar conta, URL e eventuais fatores adicionais.

1. Abrir uma janela privada do navegador.
2. Acessar o EP/EPLG manualmente.
3. Autenticar sem gravar senha no navegador.
4. Registrar apenas URL base, campos presentes e resultado.
5. Confirmar se há OTP/MFA/interação humana.
6. Encerrar a sessão.

**Aceite:** página autenticada acessível e método de autenticação documentado.

### T02 — disponibilidade da biblioteca corporativa

Em um ambiente Python descartável autorizado:

```powershell
python -m pip show dxacademy
python -c "from dxacademy.eplg import Login; print('dxacademy.eplg.Login disponível')"
```

Se não estiver instalada, verificar o índice corporativo e a autorização de uso. Não instalar pacote homônimo de origem desconhecida.

O procedimento completo de localização, instalação, validação e contingência está na seção 18.

**Aceite:** origem, versão e licença/autorização do pacote registradas, ou decisão formal de não usá-lo.

### T03 — automação somente do SSO

Executar o futuro modo:

```powershell
python -m automation.smartoffice.bot --mode login-only
```

O comando é alvo de implementação; ele ainda não existe no estado atual.

**Observar:** tempo, URL final sanitizada, MFA e encerramento apenas do navegador criado pelo teste.

**Aceite:** login confirmado por condição explícita, sem abrir GERP e sem credenciais nos logs.

### T04 — portal e abertura do GERP

Executar o futuro modo:

```powershell
python -m automation.smartoffice.bot --mode launch-only
```

**Observar:** nome do JNLP, diretório, tempo até a janela, título da janela e PID iniciado.

**Aceite:** GERP Production aberto e encerrado sem afetar outros navegadores/processos.

### T05 — navegação sem submeter request

Executar o futuro modo:

```powershell
python -m automation.smartoffice.bot `
  --mode navigate-only `
  --organization NWK
```

Usar a organização homologada; `NWK` é somente exemplo baseado nos arquivos atuais.

**Aceite:** tela de parâmetros do `Other Account Transaction Text Download` aberta, sem submissão.

### T06 — request real mínimo, sem enviar ao Hanaro

Escolher uma janela fechada e curta. Sugestão inicial: um dia anterior, como `2026-09-14`, desde que confirmado pelo responsável.

```powershell
python -m automation.smartoffice.bot `
  --mode download-only `
  --date-from 2026-09-14 `
  --date-to 2026-09-14 `
  --organization NWK
```

**Registrar:** request ID, estados observados, duração, nome, tamanho e SHA-256 do arquivo. Não registrar conteúdo das linhas.

Verificação local segura:

```powershell
$arquivo = '<CAMINHO_DO_TSV_BAIXADO>'
Get-Item -LiteralPath $arquivo | Select-Object Name, Length, LastWriteTime
Get-FileHash -Algorithm SHA256 -LiteralPath $arquivo
$cabecalho = Get-Content -LiteralPath $arquivo -TotalCount 1
[pscustomobject]@{
    Colunas = (@($cabecalho -split "`t", -1)).Count
    TerminaComTab = $cabecalho.EndsWith("`t")
}
```

**Aceite:** request em sucesso, arquivo estável, 29 colunas e coluna final vazia.

Se o relatório não retornar registros, registrar o comportamento como caso válido de “sem dados”, mas repetir com uma janela curta que tenha registros para validar o parser.

### T07 — parser isolado em Docker, sem envio

O `.venv` host está quebrado porque aponta para um Python removido. Usar Docker:

```powershell
docker compose build backend
docker compose run --rm --no-deps `
  -e PYTHONPATH=/app `
  backend `
  pytest /app/automation/tests -q
```

Processar o arquivo real sem backend:

```powershell
$env:HANARO_SIMULATION_HOST_INPUT_DIR = 'C:/Users/User/Downloads'
$env:HANARO_SIMULATION_INPUT = '/input/<NOME_EXATO_DO_ARQUIVO>'
$env:HANARO_SIMULATION_REFERENCE_DATE = '2026-09-15'
$env:HANARO_SIMULATION_EXCHANGE_RATE = '<TAXA_HOMOLOGADA>'
$env:HANARO_SIMULATION_RATE_SOURCE = 'manual_homologation'
$env:HANARO_SIMULATION_ORGANIZATION = 'NWK'
$env:HANARO_SIMULATION_SEND = 'false'

docker compose --profile simulation build material-scrap-simulation
docker compose --profile simulation run --rm --no-deps material-scrap-simulation
```

Limpar as variáveis da sessão depois do teste:

```powershell
'HANARO_SIMULATION_HOST_INPUT_DIR',
'HANARO_SIMULATION_INPUT',
'HANARO_SIMULATION_REFERENCE_DATE',
'HANARO_SIMULATION_EXCHANGE_RATE',
'HANARO_SIMULATION_RATE_SOURCE',
'HANARO_SIMULATION_ORGANIZATION',
'HANARO_SIMULATION_SEND' | ForEach-Object {
    Remove-Item -Path "Env:$_" -ErrorAction SilentlyContinue
}
```

**Aceite:** testes passam, JSON é criado em `automation/artifacts/`, `source_rows = accepted_rows`, organizações correspondem ao arquivo e não ocorre chamada ao backend.

### T08 — população local com fixture sintética

Antes de usar dado real, validar toda a infraestrutura com a fixture versionada.

1. Configurar `ADMIN_*` no `.env` para o ambiente local.
2. Iniciar serviços:

```powershell
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://localhost:8000/health
```

3. Confirmar que `backend`, `postgres`, `redis` e `material-scrap-worker` estão saudáveis/ativos.
4. Provisionar uma API key de serviço com apenas `material_scrap:create` usando o comando administrativo a ser implementado.
5. Definir temporariamente `HANARO_API_KEY` na sessão ou no mecanismo de segredo do teste. Não imprimir seu valor.
6. Executar:

```powershell
docker compose --profile simulation run --rm material-scrap-simulation
```

7. Acompanhar:

```powershell
docker compose logs --since=10m backend material-scrap-worker
```

8. Abrir `http://localhost:4200` e verificar Base de Scrap, Dashboard e Execuções.

**Aceite:** API retorna `202`, worker conclui, execução aparece como `COMPLETED`, contagens reconciliam e dashboard é atualizado.

### T09 — idempotência local

Executar novamente a mesma fixture, janela, escopo e taxa.

**Aceite:** não há duplicação lógica; o backend reconhece replay/versão inalterada conforme o contrato atual.

### T10 — população local com TSV real mínimo

Somente depois de T07–T09:

1. usar o TSV de janela curta produzido em T06;
2. confirmar organização e datas;
3. definir o arquivo como input da simulação;
4. manter o Hanaro local, nunca produção, no primeiro teste;
5. executar a simulação com envio;
6. comparar `source_rows`, `accepted_rows`, organizações, datas e totais de controle;
7. verificar visualmente uma amostra mínima autorizada, sem exportar evidência com PII.

**Aceite:** população real local reconciliada e navegável, sem linha rejeitada e sem exposição de dados.

### T11 — ponta a ponta local

Executar o futuro modo completo do robô Windows apontando para o backend local:

```powershell
python -m automation.smartoffice.bot `
  --mode full `
  --date-from 2026-09-14 `
  --date-to 2026-09-14 `
  --organization NWK `
  --backend-url http://localhost:8000
```

**Aceite:** um único `execution_id` correlaciona request GERP, arquivo, JSON, task ID e snapshot publicado.

### T12 — validação de `ALL`

Depois do sucesso com uma organização:

1. usar a mesma janela;
2. executar com `organization=ALL`;
3. listar somente os códigos encontrados, sem conteúdo das linhas;
4. comparar com a lista esperada do responsável de negócio;
5. decidir formalmente entre `ALL` e uma execução por organização.

**Aceite:** cobertura completa e inequívoca, sem duplicidade entre organizações.

## 12. Publicação controlada no Smart Office

### Pré-requisitos do Runner

- Windows e desktop interativo.
- Rede/intranet LG.
- Navegador e driver compatíveis.
- Java/JNLP homologado.
- Permissão de escrita no diretório do Runner.
- Resolução/escala homologadas se houver reconhecimento de imagem.
- Dependências Python disponíveis no ambiente do Runner.
- Acesso HTTPS ao backend Hanaro pretendido.
- Cofre com credenciais EPLG e API key Hanaro.

### Build

No diretório do projeto BotCity:

```powershell
.\build.bat
Get-ChildItem .\dist, . -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in '.zip', '.gz' } |
    Select-Object FullName, Length, LastWriteTime
```

Antes do upload, abrir/listar o pacote e confirmar que não contém `.env`, exports, artefatos, screenshots reais ou segredos.

### Easy Deploy

1. Criar ou selecionar a automação de homologação.
2. Informar um Bot ID estável, por exemplo `hanaro-material-scrap`.
3. Publicar uma **versão nova**, por exemplo `0.1.0-hml`.
4. Selecionar tecnologia Python.
5. Associar somente o Runner de homologação.
6. Não marcar como release de produção no primeiro upload.
7. Configurar credenciais no cofre.
8. Configurar parâmetros padrão seguros: modo `login-only` ou `download-only`, janela de um dia e uma organização.

### Sequência de execução no Runner

- [ ] `login-only`
- [ ] `launch-only`
- [ ] `navigate-only`
- [ ] `download-only`
- [ ] `full` apontando para Hanaro local/homologação
- [ ] `ALL`, somente após organização individual

### Rollback

Se uma versão falhar:

1. não sobrescrever o pacote defeituoso;
2. retirar sua release;
3. selecionar a versão anterior conhecida;
4. interromper apenas tarefas novas;
5. verificar pelo request ID se existe request GERP em andamento;
6. preservar logs sanitizados e o TSV apenas na retenção autorizada;
7. abrir correção com código de erro e `execution_id`.

## 13. Ficha de evidência por teste

Copiar e preencher para cada caso:

```text
Teste:
Data/hora (America/Manaus):
Operador:
Máquina/Runner:
Versão do bot/commit:
Modo:
Ambiente Hanaro: nenhum | local | homologação
Organização:
Janela consultada:
execution_id:
GERP request_id:
Resultado esperado:
Resultado observado:
Duração:
Arquivo (somente nome):
Tamanho:
SHA-256:
Linhas de origem:
Linhas aceitas:
Organizações encontradas:
Task ID:
Status final:
Código de erro, se houver:
Evidência sanitizada:
Observações:
```

Não incluir senha, token, cookie, URL de SSO com query string, nomes de pessoas ou conteúdo de `REQ Comment`.

## 14. Matriz de homologação

| ID | Cenário | Saída esperada | Bloqueia avanço? |
|---|---|---|---:|
| H01 | Credencial válida | Login explícito confirmado | sim |
| H02 | Credencial inválida controlada | `SSO_AUTH_FAILED`, sem repetição excessiva | sim |
| H03 | MFA/OTP | `SSO_INTERACTION_REQUIRED` ou fluxo assistido | sim |
| H04 | Portal indisponível | timeout, cleanup e falha registrada | não |
| H05 | JNLP não baixa | nenhum arquivo antigo é executado | sim |
| H06 | Janela Java não abre | timeout monotônico e cleanup | sim |
| H07 | Responsabilidade ausente | falha antes de submeter request | sim |
| H08 | Request com sucesso | request ID e `Completed/Normal` | sim |
| H09 | Request com erro | output não é baixado/publicado | sim |
| H10 | Download parcial | arquivo não é entregue ao parser | sim |
| H11 | TSV inválido | `GERP_FILE_INVALID` | sim |
| H12 | TSV válido sem envio | JSON reconciliado | sim |
| H13 | Fixture enviada | `202` e worker `COMPLETED` | sim |
| H14 | Replay da fixture | sem duplicação lógica | sim |
| H15 | TSV real em local | população reconciliada | sim |
| H16 | Runner login-only | tarefa finalizada corretamente | sim |
| H17 | Runner download-only | arquivo válido e sem processos órfãos | sim |
| H18 | Runner full em homologação | mesma correlação ponta a ponta | sim |
| H19 | Organização `ALL` | cobertura homologada | decisão |
| H20 | Backend/Redis indisponível | snapshot anterior preservado e retry seguro | sim |

## 15. Critérios para considerar pronto para produção

- [ ] Autorização para reutilizar `dxacademy` ou login alternativo homologado.
- [ ] Nenhum segredo ou token embutido no código/pacote.
- [ ] Credencial legada exposta no projeto antigo rotacionada.
- [ ] API key de serviço com privilégio mínimo e expiração definida.
- [ ] Mesmo `execution_id` em todo o fluxo.
- [ ] Timeouts em todos os waits externos.
- [ ] Nenhum `sleep` usado como confirmação de sucesso.
- [ ] Nenhum `taskkill` genérico.
- [ ] Download exclusivo e estável.
- [ ] Parser rígido executado antes da publicação.
- [ ] Testes unitários e de integração passando.
- [ ] Homologação individual e `ALL` registrada.
- [ ] Replay/idempotência comprovados.
- [ ] Falha preserva o snapshot anterior.
- [ ] Runner de produção tem requisitos e acesso documentados.
- [ ] Versão anterior disponível para rollback.
- [ ] Retenção/remoção dos arquivos reais definida com Segurança/Negócio.
- [ ] Responsável de negócio aprovou totais, organizações e janela.

## 16. Ordem recomendada de trabalho

1. Realizar T01, T02 e uma execução manual do relatório.
2. Registrar seletores, responsabilidades, estados e comportamento de `ALL`.
3. Implementar fundação, erros, download watcher e testes unitários.
4. Implementar `login-only`.
5. Implementar `launch-only`.
6. Implementar `navigate-only`.
7. Implementar `download-only`.
8. Ajustar `execution_id` e extrair o caso de uso do pipeline.
9. Implementar provisionamento auditável da API key do robô.
10. Executar T07–T10.
11. Implementar e executar `full` local.
12. Criar pacote Smart Office e executar a sequência controlada.
13. Homologar `ALL`, falhas, replay e rollback.
14. Somente então promover a versão para produção.

## 17. Questões que devem ser respondidas amanhã

- O primeiro portal exige apenas quatro campos ou também MFA/OTP?
- `dxacademy==0.1.0` está disponível no índice corporativo e pode ser redistribuído no pacote?
- Qual navegador/driver é oficialmente suportado no Runner?
- Qual runtime abre o JNLP e qual o título exato da janela?
- Qual responsabilidade/módulo é correto para cada organização?
- `ALL` realmente retorna todas as organizações necessárias?
- O estado terminal é exatamente `Completed/Normal`?
- O request ID pode ser lido de forma acessível, sem OCR?
- O download vem sem extensão, como os exemplos atuais?
- Há um ambiente GERP de homologação ou o relatório somente leitura será testado em produção?
- Qual backend Hanaro o Smart Office consegue alcançar?
- Onde as credenciais e parâmetros de tarefa são configurados no Smart Office da LG?
- Qual Runner será usado para homologação e quem autoriza o release?
- Qual a taxa/cotação autorizada para o teste e para produção?
- Por quanto tempo o TSV real pode permanecer no disco do Runner?

As respostas devem virar configuração, teste automatizado ou decisão registrada; não devem permanecer como suposições embutidas no código.

## 18. Obtenção e homologação da biblioteca `dxacademy`

### 18.1 Diagnóstico atual

Os projetos legados dão duas pistas consistentes:

- `if-cost-automation-master/requirements.txt` fixa `dxacademy==0.1.0`;
- `app/gerp/gerp_web.py` importa `Login` de `dxacademy.eplg`.

Até a verificação realizada em 14/09/2026, o pacote não estava disponível no PyPI público e não havia wheel nem código-fonte dele nas cópias locais examinadas. Portanto, tratá-lo como dependência corporativa privada da LG até que a equipe responsável confirme a origem. A referência no projeto legado demonstra uso anterior, mas não comprova autorização para copiar ou redistribuir o pacote.

Não instalar pacotes de nome semelhante encontrados na internet. Não copiar `site-packages` de outra máquina e não contornar TLS com `--trusted-host`.

### 18.2 Resultado esperado da investigação

Ao final, deve existir uma das decisões abaixo, registrada com responsável e data:

1. **Reutilização autorizada:** pacote oficial, versão, origem, licença interna e método de instalação conhecidos.
2. **Disponível somente no Runner:** imagem homologada já contém a biblioteca e o deploy não deve empacotá-la.
3. **Não reutilizável:** uso não autorizado, artefato indisponível ou incompatível; implementar o adaptador próprio descrito em 18.9.

### 18.3 Roteiro na intranet

Executar nesta ordem:

1. Pesquisar no GitLab/repositório corporativo pelo grupo dos projetos de automação, especialmente `dx-sw-team`, usando os termos `dxacademy`, `dx-academy`, `eplg` e `EmailHandler`.
2. Procurar documentação do DX Academy, catálogo interno de bibliotecas, Nexus, Artifactory ou outro índice Python corporativo.
3. Perguntar ao time de DX Automation/Smart Office e aos mantenedores dos bots legados:
   - qual é o repositório oficial;
   - se `0.1.0` ainda é a versão homologada;
   - se o pacote pode ser incluído no artefato do Hanaro;
   - se ele já vem instalado na imagem do Runner;
   - qual versão de Python, navegador e driver ele suporta;
   - se há fluxo próprio para MFA/OTP e conta de serviço.
4. Solicitar URL do índice ou wheel oficial por canal corporativo. Não pedir que enviem senha, token, cookie ou configuração pessoal de `pip`.

### 18.4 Inspeção de uma máquina ou Runner autorizado

Executar sem alterar o ambiente primeiro:

```powershell
python --version
python -m pip show dxacademy
python -c "import dxacademy; print(dxacademy.__file__)"
python -c "from dxacademy.eplg import Login; print('dxacademy.eplg.Login disponível')"
python -m pip check
```

Se `pip show` não encontrar o pacote, examinar a configuração que aponta para índices privados:

```powershell
python -m pip config debug
python -m pip config list
```

As saídas podem conter URL interna, nome de usuário ou token. Guardá-las apenas em local corporativo aprovado, remover valores secretos das evidências e nunca adicioná-las ao Git.

Registrar:

- máquina/Runner e imagem utilizados;
- caminho do interpretador retornado por `Get-Command python`;
- versão de Python e arquitetura;
- versão e localização de `dxacademy`;
- dependências listadas por `pip show`;
- resultado do import de `Login`;
- origem informada pelo responsável corporativo.

### 18.5 Teste isolado em ambiente descartável

Usar a mesma versão de Python homologada para o Runner. O exemplo abaixo usa Python 3.11 apenas como marcador; substituí-lo pela versão confirmada:

```powershell
py -3.11 -m venv .venv-dxacademy-test
& .\.venv-dxacademy-test\Scripts\python.exe -m pip install --upgrade pip
```

Se a empresa fornecer um índice privado, preferir credenciais já configuradas no ambiente:

```powershell
& .\.venv-dxacademy-test\Scripts\python.exe -m pip install "dxacademy==0.1.0" --index-url "https://<indice-corporativo>/simple"
```

Não colocar token diretamente no comando, pois ele pode ficar no histórico do terminal ou nos logs do Runner. Se o índice exigir autenticação, seguir o mecanismo de credenciais homologado pela LG.

Se a empresa fornecer um wheel oficial:

```powershell
Get-FileHash -Algorithm SHA256 .\dxacademy-0.1.0-py3-none-any.whl
& .\.venv-dxacademy-test\Scripts\python.exe -m pip install .\dxacademy-0.1.0-py3-none-any.whl
```

Validar a instalação:

```powershell
& .\.venv-dxacademy-test\Scripts\python.exe -m pip show dxacademy
& .\.venv-dxacademy-test\Scripts\python.exe -m pip check
& .\.venv-dxacademy-test\Scripts\python.exe -c "from dxacademy.eplg import Login; print('IMPORT_OK')"
```

O hash SHA-256 deve ser comparado com o valor fornecido pelo repositório ou mantenedor. A evidência pode conter versão, hash e resultados, mas não credenciais nem URLs assinadas.

### 18.6 Teste funcional mínimo, sem executar o fluxo completo

Antes de usar credenciais, inspecionar somente a API pública necessária:

```powershell
& .\.venv-dxacademy-test\Scripts\python.exe -c "from dxacademy.eplg import Login; import inspect; print(inspect.signature(Login))"
```

Se a política corporativa permitir inspeção adicional, registrar apenas nomes de métodos e assinaturas usados pelo bot legado. Não publicar código-fonte proprietário nem despejar objetos que possam conter segredos.

Depois executar T01 e T03 com uma conta de teste ou identidade autorizada. O teste deve confirmar uma condição explícita de login, não apenas a ausência de exceção. MFA/OTP permanece assistido até existir solução corporativa homologada.

### 18.7 Inclusão no Smart Office

Confirmar com o responsável pelo Runner qual dos modelos se aplica:

| Modelo | Empacotamento | Verificação no início da tarefa |
|---|---|---|
| Biblioteca preinstalada na imagem | Não incluir wheel | importar `dxacademy.eplg.Login` e registrar somente versão |
| Instalação via índice privado | Fixar versão no lock/requirements do pacote | executar instalação pelo mecanismo de build autorizado |
| Wheel corporativo | Armazenar no repositório interno de artefatos, não necessariamente no Git | validar nome, versão e SHA-256 durante o build |

Não assumir que a biblioteca disponível no computador de desenvolvimento também existe no Runner. O teste `login-only` deve ser a primeira execução no Smart Office; `launch-only`, `navigate-only`, `download-only` e `full` só avançam após o aceite da etapa anterior.

### 18.8 Registro da decisão

Preencher e anexar à evidência da homologação:

```text
Data:
Responsável técnico:
Equipe que confirmou a origem:
Origem oficial do pacote:
Versão homologada:
Python suportado:
Runner/imagem homologada:
Forma de instalação: preinstalado | índice privado | wheel
SHA-256 do wheel, quando aplicável:
Permissão de redistribuição: sim | não | não se aplica
Import de dxacademy.eplg.Login: OK | FALHA
pip check: OK | FALHA
Login isolado: OK | FALHA | INTERAÇÃO HUMANA
Decisão: reutilizar | implementar adaptador próprio
Pendências:
```

### 18.9 Contingência se `dxacademy` não estiver disponível

Não bloquear toda a arquitetura na biblioteca. Manter o protocolo `EplgAuthenticator` e criar dois adaptadores intercambiáveis:

```text
EplgAuthenticator
├── DxAcademyEplgAuthenticator       # import opcional e isolado
└── BrowserEplgAuthenticator         # Selenium/BotCity, fluxo homologado
```

O adaptador de `dxacademy` deve fazer import tardio e produzir um erro tipado, como `DXACADEMY_NOT_AVAILABLE`, quando a dependência não existir. Assim, testes unitários e o restante do pipeline continuam executáveis sem a biblioteca proprietária.

O adaptador de navegador deve usar seletores estáveis levantados na Fase 0, esperar condições explícitas, redigir segredos dos logs e interromper com `SSO_INTERACTION_REQUIRED` diante de MFA/OTP não automatizado. Ele não deve contornar CAPTCHA, MFA ou controles de acesso.

### 18.10 Critérios de aceite da dependência

- [ ] Origem corporativa confirmada por responsável identificável.
- [ ] Versão e compatibilidade com Python/Runner registradas.
- [ ] Autorização de uso e redistribuição definida.
- [ ] Instalação reproduzível em ambiente descartável ou presença garantida na imagem.
- [ ] Hash do artefato registrado, quando houver wheel.
- [ ] `pip check` sem conflitos.
- [ ] Import de `dxacademy.eplg.Login` validado.
- [ ] T03 executado sem segredo nos logs.
- [ ] Forma de provisionamento no Smart Office definida.
- [ ] Contingência por adaptador próprio decidida caso algum item bloqueante falhe.
