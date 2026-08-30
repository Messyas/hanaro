# Checklist OWASP Top 10 - revisao de codigo

**Data:** 30 de agosto de 2026. Este checklist descreve o que foi confirmado no
repositorio; nao afirma conformidade de infraestrutura nao auditada.

| Categoria | Estado | Evidencia e observacao |
| --- | --- | --- |
| A01 Controle de acesso | Parcialmente verificado | Relatorio detalhado exige `CurrentUserDep`; dashboard e filtros sao publicos por regra documentada; escritas administrativas usam superusuario. Revisar ownership quando recursos passarem a ser privados por usuario. |
| A02 Falhas criptograficas | Parcialmente verificado | Senhas e API keys sao tratadas pelo provedor/servico; segredo e banco padrao sao rejeitados no boot de producao. TLS e gestao de segredos da plataforma dependem do deploy. |
| A03 Injecao | Sem achado confirmado no escopo | Rotas revisadas usam schemas Pydantic e SQLAlchemy. Alteracoes com SQL raw, shell ou HTML devem receber nova revisao. |
| A04 Design inseguro | Corrigido em parte | Rate limit global agora e executado por IP. Politicas por tier exigem uso explicito de `check_rate_limit`; nao declarar limite por usuario onde ele nao esta conectado ao fluxo. |
| A05 Configuracao incorreta | Parcialmente verificado | Headers no app/Nginx e allowlist de hosts existem. CORS, cookies seguros, docs e Redis possuem configuracao dependente de ambiente; o validador registra varios itens apenas como aviso. |
| A06 Componentes vulneraveis | Sem vulnerabilidade de producao encontrada na ultima execucao | `npm audit --omit=dev` e `pip-audit` foram usados na revisao anterior. A conclusao vale para o lockfile daquele momento; rode no CI a cada atualizacao. |
| A07 Autenticacao | Parcialmente verificado | Apenas username/senha local; OAuth removido. Sessao e CSRF sao aplicados pelo fluxo de autenticacao. Validar lockout e cookies no ambiente implantado. |
| A08 Integridade | Parcialmente verificado | Lockfile e testes existem; as mutacoes de execucao usam transacoes e controles de estado. O pipeline de deploy deve continuar validando imagem e lockfile. |
| A09 Logging e monitoramento | Parcialmente verificado | Erros de execucao sao redigidos antes de persistencia. Alertas, retencao e observabilidade de producao nao foram verificados. |
| A10 SSRF | Sem achado confirmado no escopo | Nenhuma rota revisada aceita URL arbitraria para fetch servidor. Novas integracoes HTTP devem usar allowlist, timeout e bloqueio de redirecionamento. |

## Decisoes importantes

- O dashboard/TV e `GET /api/v1/scrap/filters` sao publicos intencionalmente.
- `GET /api/v1/scrap` nao e publico: e a leitura detalhada para relatorios.
- Ingestao usa `X-API-Key`, nao Bearer token.
- SQLAdmin foi removido; o primeiro superusuario e criado pelo script de
  bootstrap e autentica pelo mesmo mecanismo das demais contas locais.

## Proximas verificacoes

- Rodar os testes de integracao com Docker disponivel no ambiente de CI.
- Fazer teste de carga controlado para confirmar 429 e recuperacao do backend de
  rate limit configurado para producao.
- Revisar a configuracao efetiva de TLS, proxy confiavel, CORS, WAF e logs apos
  cada mudanca de infraestrutura.
