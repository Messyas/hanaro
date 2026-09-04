# Auditoria de dependencias

**Data:** 30 de agosto de 2026.

A revisao anterior executou `npm audit --omit=dev --json` e `pip-audit` na imagem
de backend sem vulnerabilidades conhecidas reportadas para dependencias de
producao naquele instante. Isso nao equivale a garantia permanente: o lockfile e
as bases de CVE mudam continuamente.

Nesta alteracao, `sqladmin`, `wtforms` e `types-wtforms` foram removidos do
`pyproject.toml` e do `uv.lock`, pois a interface SQLAdmin tambem foi removida.

Mantenha no CI:

```bash
npm audit --omit=dev --json
uvx pip-audit
```

Classifique resultados por alcance: dependencias de runtime sao prioridade de
correcao; dependencias exclusivamente de desenvolvimento ainda devem ser
atualizadas de forma planejada.
