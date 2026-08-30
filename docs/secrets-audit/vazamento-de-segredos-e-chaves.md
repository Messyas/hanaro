# Relatório de Auditoria de Segurança: Vazamento de Segredos e Chaves

**Projeto:** Hanaro – Sistema de Gestão e Monitoramento de Material Scrap  
**Escopo da Análise:** Varredura Estática Completa de Código, Configurações, `.gitignore` e Histórico Git  
**Data da Avaliação:** 30 de Agosto de 2026  
**Classificação Geral:** **APROVADO (NENHUM VAZAMENTO REAL DETECTADO)**  
**Status do Repositório:** **SEGURO / SEM CREDENCIAIS EM TEXTO PLANO RASTREADAS**  

---

## 1. Sumário Executivo

Esta auditoria realizou uma varredura profunda de segurança em todos os **373 arquivos rastreados** pelo Git no repositório Hanaro, inspecionando a presença de:
- Chaves Privadas (RSA, EC, OpenSSH, PGP, DSA);
- Credenciais e Tokens de Nuvem (AWS Access Keys, Google Cloud API Keys, GitHub Personal Access Tokens);
- Strings de conexão com bancos de dados (`postgresql://`, `redis://`, `amqp://`) contendo senhas embutidas;
- Segredos de Aplicação e Sessão (`SECRET_KEY`, `JWT_SECRET`, tokens de webhook);
- Certificados e chaves criptográficas TLS/X.509 (`.pem`, `.key`, `.p12`, `.crt`).

### Veredito da Auditoria
* **Vazamentos Reais de Segredos:** **0 (Zero).**
* **Arquivos Sensíveis Rastreados no Git:** **0 (Zero).**
* **Arquivos de Ambiente (`.env`, `deploy/.env.production`, certificados TLS):** **Devidamente ignorados pelo [`.gitignore`](file:///C:/Users/User/Documents/projects/hanaro/.gitignore).**
* **Achados da Varredura Estática:** 5 ocorrências analisadas manualmente, todas classificadas como **falsos positivos legítimos** (templates de injeção dinâmica de configuração, docstrings de exemplo e fixtures de testes unitários).

---

## 2. Inventário de Arquivos Sensíveis e Regras do `.gitignore`

O arquivo [`.gitignore`](file:///C:/Users/User/Documents/projects/hanaro/.gitignore) do projeto adota uma política restritiva que impede o commit acidental de arquivos de ambiente e chaves privadas:

```gitignore
# Trecho do .gitignore auditado
.env
.env.*
!.env.example
!.env.*.example
deploy/.env.production
deploy/nginx/certs/*
!deploy/nginx/certs/README.md
```

### Validação de Exclusão de Arquivos Críticos:
| Arquivo / Diretório | Status no Git | Avaliação de Risco |
| :--- | :---: | :--- |
| `backend/.env` | 🟢 **Ignorado** | Seguro. Contém apenas valores locais de desenvolvimento. |
| `deploy/.env.production` | 🟢 **Ignorado** | Seguro. Impede vazamento das credenciais de staging/produção. |
| `deploy/nginx/certs/*` | 🟢 **Ignorado** | Seguro. Certificados e chaves `.key`/`.crt` não são rastreados. |
| `.env.example` e `backend/.env.example` | 🟡 **Rastreado (Público)** | Seguro. Contém apenas placeholders (`your-super-secret-key...`). |

---

## 3. Análise Detalhada dos Achados da Varredura

Durante o scan de alta sensibilidade com expressões regulares, 5 ocorrências de padrões de segredos foram detectadas e avaliadas:

```mermaid
graph TD
    Scan["Varredura Estática (373 Arquivos)"]
    Scan --> F1["settings.py:420<br/>(Interpolação Dinâmica AMQP)"]
    Scan --> F2["user/service.py:74<br/>(Docstring Exemplo)"]
    Scan --> F3["user/service.py:453<br/>(Sanitização LGPD)"]
    Scan --> F4["test_settings.py:256<br/>(Assert de Teste)"]
    Scan --> F5["test_service.py:194<br/>(Mock Test Key)"]
    
    F1 --> FP1["✅ Falso Positivo (Código Seguro)"]
    F2 --> FP2["✅ Falso Positivo (Documentação)"]
    F3 --> FP3["✅ Prática de Segurança (Scrubbing)"]
    F4 --> FP4["✅ Falso Positivo (Teste Unitário)"]
    F5 --> FP5["✅ Falso Positivo (Teste Unitário)"]
```

### Detalhamento dos Achados:

1. **[`backend/src/infrastructure/config/settings.py:420`](file:///C:/Users/User/Documents/projects/hanaro/backend/src/infrastructure/config/settings.py#L420):**
   * *Código:* `return f"amqp://{self.TASKIQ_RABBITMQ_USER}:{self.TASKIQ_RABBITMQ_PASSWORD}@{self.TASKIQ_RABBITMQ_HOST}:{self.TASKIQ_RABBITMQ_PORT}/{self.TASKIQ_RABBITMQ_VHOST}"`
   * *Diagnóstico:* **Falso Positivo.** Construtor dinâmico de URL a partir de variáveis de ambiente. Nenhuma senha hardcoded.
2. **[`backend/src/modules/user/service.py:74`](file:///C:/Users/User/Documents/projects/hanaro/backend/src/modules/user/service.py#L74):**
   * *Código:* `password="securepassword123"` (dentro do bloco `Example:` da docstring).
   * *Diagnóstico:* **Falso Positivo.** Apenas documentação ilustrativa de uso do schema `UserCreate`.
3. **[`backend/src/modules/user/service.py:453`](file:///C:/Users/User/Documents/projects/hanaro/backend/src/modules/user/service.py#L453):**
   * *Código:* `hashed_password="DELETED_INVALID_HASH"`
   * *Diagnóstico:* **Prática Recomendada de Segurança.** Valor dummy utilizado no método `anonymize_user` para sobrescrever e inutilizar o hash de senha no banco de dados durante processos de exclusão/LGPD.
4. **[`backend/tests/unit/infrastructure/config/test_settings.py:256`](file:///C:/Users/User/Documents/projects/hanaro/backend/tests/unit/infrastructure/config/test_settings.py#L256):**
   * *Código:* `expected_url = "amqp://test-user:test-password@rabbitmq-host:5673/test"`
   * *Diagnóstico:* **Falso Positivo.** Asserção de teste unitário para validar o parsing de URL do RabbitMQ.
5. **[`backend/tests/unit/modules/api_keys/test_service.py:194`](file:///C:/Users/User/Documents/projects/hanaro/backend/tests/unit/modules/api_keys/test_service.py#L194):**
   * *Código:* `api_key="fai_invalid_key_12345"`
   * *Diagnóstico:* **Falso Positivo.** Chave inválida mockada para testar o comportamento de rejeição do serviço de validação de API Key.

---

## 4. Mecanismos de Proteção Ativa Contra Vazamento no Código

A aplicação possui salvaguardas programáticas para evitar que segredos vazem durante a execução:

### 4.1. Validador de Inicialização em Produção
O módulo [`production_validator.py`](file:///C:/Users/User/Documents/projects/hanaro/backend/src/infrastructure/security/production_validator.py) executa uma verificação preventiva no boot da aplicação:
- Analisa a entropia de `SECRET_KEY` (rejeita senhas menores que 32 caracteres ou contendo termos previsíveis como `secret`, `password`, `1234`, `qwerty`);
- Rejeita o uso de credenciais padrão no PostgreSQL (`POSTGRES_PASSWORD='postgres'`);
- Alerta sobre instâncias Redis sem senha ou sem criptografia TLS (`rediss://`).

### 4.2. Sanitização de Mensagens e Logs em Runtime
Em [`execution_service.py`](file:///C:/Users/User/Documents/projects/hanaro/backend/src/modules/material_scrap/execution_service.py#L43-L60), mensagens de erro e metadados de automação passam por um filtro de regex antes de serem gravados ou retornados:
```python
_SECRET_PATTERN = re.compile(r"(?i)(password|secret|token|cookie|authorization)\s*[:=]\s*\S+")

def sanitize_message(value: str) -> str:
    return _SECRET_PATTERN.sub(r"\1=[REDACTED]", value).strip()[:2000]
```
Esse mecanismo impede que eventuais credenciais vazadas em respostas de erro de serviços externos (ex: GERP) sejam armazenadas no PostgreSQL ou expostas aos operadores.

### 4.3. Hashing Unidirecional de Chaves de API
No módulo [`api_keys`](file:///C:/Users/User/Documents/projects/hanaro/backend/src/modules/api_keys/), as chaves de acesso emitidas para robôs ou integrações seguem o padrão de segurança:
- O valor em texto plano (`fai_...`) é exibido apenas uma vez no momento da criação;
- O banco de dados armazena unicamente o hash criptográfico SHA-256 (`api_key_hash`);
- Em caso de comprometimento da base de dados, os atacantes não obtêm chaves válidas.

---

## 5. Recomendações e Melhores Práticas

Para manter a integridade contínua do repositório contra vazamentos acidentais:

1. **Ferramenta Automatizada de Pré-Commit (Gitleaks / Detect-Secrets):**
   * Adicionar o hook do `gitleaks` ou `detect-secrets` ao [`.pre-commit-config.yaml`](file:///C:/Users/User/Documents/projects/hanaro/.pre-commit-config.yaml) para escanear commits localmente antes do push.
2. **Gerenciamento de Segredos em Produção:**
   * Em ambientes de produção (Render, AWS, Cloudflare, Kubernetes), injetar credenciais via variáveis de ambiente seguras da plataforma ou Secret Managers (ex: AWS Secrets Manager, Vault, Doppler), evitando a presença de arquivos `.env` em disco nos servidores.
3. **Rotação Periódica de Chaves:**
   * Estabelecer um calendário de rotação anual para `SECRET_KEY`, `POSTGRES_PASSWORD` e senhas de SMTP.
   * Utilizar a funcionalidade de expiração (`expires_at`) do módulo `api_keys` para renovar periodicamente as chaves de integração do robô RPA.

---

## 6. Conclusão

A auditoria de segredos conclui que o repositório **Hanaro está seguro contra vazamento de credenciais e chaves**. Os controles de `.gitignore`, o validador de produção no startup e a sanitização ativa de mensagens em runtime formam uma proteção robusta contra exposição acidental de dados sensíveis.
