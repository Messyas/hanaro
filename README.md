# Hanaro

Aplicação com frontend Angular, API FastAPI, PostgreSQL e Redis.

## Requisito local

Instale e inicie o Docker Desktop. Os comandos do projeto não exigem Python,
Node.js, `uv`, npm ou ambiente virtual no computador host.

## Iniciar o ambiente de desenvolvimento

Na raiz do projeto, execute:

```powershell
docker compose up --build
```

Use os endereços abaixo:

- Frontend: <http://localhost:4200>
- API: <http://localhost:8000>
- Documentação da API: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

Para encerrar apenas o ambiente principal (frontend, backend, PostgreSQL e Redis):

```powershell
docker compose down
```

Esse comando não encerra o SonarQube se ele tiver sido iniciado; veja a seção
**SonarQube** para encerrar toda a pilha.

Para iniciar o worker Taskiq junto com a aplicação:

```powershell
docker compose --profile worker up --build
```

## Configuração local

O Docker Compose usa valores seguros para desenvolvimento quando não existe um
arquivo `.env`. Para alterar portas, credenciais ou recursos opcionais, copie o
modelo e edite somente os valores necessários:

```powershell
Copy-Item .env.example .env
```

Não versione `.env`, certificados ou relatórios gerados.

## Formatação e correção automática

Após editar o código, execute o formatador pelo Docker; não é necessário iniciar
o Compose antes:

```powershell
.\scripts\format.ps1
```

No Linux ou macOS, use:

```bash
bash scripts/format.sh
```

O comando aplica as correções seguras do Ruff e formata `backend/src` e
`backend/tests`; também formata os arquivos TypeScript, HTML e CSS em
`frontend/src` com Prettier. O Ruff pode corrigir regras simples, como imports e
construções obsoletas; o Prettier altera somente a apresentação do código.
Revise as alterações antes de enviá-las. O workflow de lint apenas valida esse
resultado e falha se houver arquivos não formatados.

## Banco e dados iniciais

No desenvolvimento, `docker compose up --build` aplica as migrações, cria de
forma idempotente o plano e o superusuário configurado no `.env`, e inicia a
carga idempotente dos dados de demonstração em segundo plano. Portanto, o
ambiente novo já fica pronto para acesso com o usuário definido em
`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

As quatro variáveis `ADMIN_*` precisam estar preenchidas para criar o usuário;
sem elas, a API continua inicializando, mas o bootstrap é ignorado com uma
mensagem no log. Para repetir manualmente apenas o bootstrap, use:

```powershell
docker compose run --rm backend python -m scripts.setup_initial_data
```

## SonarQube

O SonarQube analisa qualidade, vulnerabilidades e cobertura; ele não modifica o
código automaticamente. Use a rotina de formatação acima para correções
automáticas locais.

### Configuração inicial

Inicie o servidor uma única vez:

```powershell
docker compose --profile sonar up -d --build sonarqube
```

Abra <http://localhost:9000> e entre com as credenciais iniciais `admin` / `admin`.
Defina uma nova senha quando solicitado. Em **My Account > Security**, crie um
**User Token** com um nome como `hanaro-local` e copie o valor imediatamente;
ele não poderá ser exibido novamente. Não use a senha do SonarQube nem um
Global Token para a análise local.

Adicione o token ao `.env` na raiz:

```env
SONAR_TOKEN=seu_token
```

Crie o projeto uma vez no SonarQube, em **Projects > Create Project > Manually**.
Use `Hanaro` como nome e `hanaro` como **Project key**; a chave deve ser igual a
`sonar.projectKey` em `sonar-project.properties`. Na definição de _New Code_,
escolha **Follows the instance's default** (atualmente, **Previous version**).
Mantenha o _Quality Gate_ padrão e conclua a criação. Os perfis de qualidade
recomendados são os padrões **Sonar way** para Python e TypeScript.

Não é necessário cadastrar relatórios pela interface. O arquivo
`sonar-project.properties` já limita a análise a `backend/src` (Python) e
`frontend/src` (TypeScript) e importa automaticamente os relatórios gerados em
`reports/sonar/`. As opções de outras linguagens na interface não afetam este
projeto: elas não serão analisadas enquanto não houver arquivos dessas linguagens
nos caminhos configurados.

### Executar uma análise

Execute toda a preparação e análise:

```powershell
.\scripts\run-sonar.ps1
```

No Linux ou macOS, use:

```bash
bash scripts/run-sonar.sh
```

Os relatórios são gravados em `reports/sonar/`, não são versionados e são
substituídos a cada análise. Ao término, atualize o painel do projeto em
<http://localhost:9000> para consultar os problemas, cobertura e _Quality Gate_.

### Problemas destacados no editor

Instale a extensão **SonarQube for IDE** no editor e conecte-a ao servidor
`http://localhost:9000` com o mesmo User Token. Selecione o projeto `hanaro` no
modo conectado para receber os problemas do SonarQube destacados no código.

### Encerrar os serviços

Não é necessário encerrar o SonarQube antes do ambiente principal. Contudo,
`docker compose down` sem profile mantém os containers do SonarQube em execução.

Para parar somente o SonarQube, preservando seus containers e dados:

```powershell
docker compose --profile sonar stop sonarqube sonarqube-db
```

Para parar e remover todos os containers do projeto, incluindo SonarQube:

```powershell
docker compose --profile sonar down
```

Se o ambiente principal já tiver sido encerrado com `docker compose down`, use o
mesmo comando com `--profile sonar down` para remover os containers restantes do
SonarQube.

Para reiniciar completamente os bancos locais e apagar todos os dados persistidos
(PostgreSQL, Redis e SonarQube), use somente quando essa perda for intencional:

```powershell
docker compose --profile sonar down --volumes
```

## Produção

O pipeline de produção está documentado em [docs/ci-cd.md](docs/ci-cd.md). Pushes
em `developer` executam validação, mas não publicam. O merge em `main` publica
Render e Cloudflare somente depois do `CI / quality-gate`. O blueprint de infraestrutura está em [`render.yaml`](render.yaml) e a
configuração do Worker em [`frontend/wrangler.jsonc`](frontend/wrangler.jsonc).

Crie `deploy/.env.production` a partir de
`deploy/.env.production.example`, preencha todas as variáveis obrigatórias e
instale `deploy/nginx/certs/tls.crt` e `deploy/nginx/certs/tls.key`.

Depois, execute:

```powershell
docker compose `
  -f deploy/compose.production.yaml `
  --env-file deploy/.env.production `
  up --build -d
```

Consulte `deploy/nginx/certs/README.md` e
`backend/docs/07-proxy-frontend-e-deploy.md` antes de publicar.

## Estrutura

- `backend/`: API FastAPI, migrações e testes.
- `frontend/`: aplicação Angular.
- `deploy/`: configuração de produção e Nginx.
- `reports/sonar/`: relatórios locais do SonarQube.
