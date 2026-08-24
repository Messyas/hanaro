# Frontend

Aplicação Angular com SSR. O navegador usa uma única origem para páginas e API:

```text
/       frontend Angular
/api/   backend FastAPI por proxy
```

## Desenvolvimento

Com toda a aplicação:

```bash
docker compose up --build
```

Somente o frontend, com o backend disponível em `127.0.0.1:8000`:

```bash
npm ci
npm start
```

Nos dois casos, acesse <http://localhost:4200>. Requisições devem usar caminhos
relativos como `/api/v1/...`; o proxy mantém cookies e CSRF em mesma origem.

O servidor de desenvolvimento usa live reload completo. HMR e o pré-bundle
incremental do Vite ficam desativados na configuração `development`, porque a
combinação de SSR, `@defer` e arquivos montados com polling no Docker pode manter
uma versão antiga de uma dependência otimizada durante recompilações. Essa opção
não afeta o build ou o servidor de produção.

## Verificação

```bash
npm test -- --watch=false
npm run test:coverage
npm run build
```

As regras de arquitetura, segurança, HTTP, modo TV e novas funcionalidades estão
no [guia de desenvolvimento](docs/README.md).
