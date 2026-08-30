---
trigger: always_on
description: Consult the graphify knowledge graph at graphify-out/ for codebase and architecture questions.
---

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- For codebase or architecture questions, when `graphify-out/graph.json` exists, first run `python -m graphify query "<question>"` (or `graphify query` / MCP `query_graph`). Use `python -m graphify path "<A>" "<B>"` for relationships and `python -m graphify explain "<concept>"` for focused concepts.
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context
- After modifying code files in this session, run `python -m graphify update .` to keep the graph current (AST-only, no API cost)
