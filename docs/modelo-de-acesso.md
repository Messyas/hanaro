# Modelo de acesso do Hanaro

Este documento registra as fronteiras de autorizacao decididas para a intranet.
Uma rota publica e uma decisao explicita de produto; o backend continua sendo a
fonte de verdade para toda operacao protegida.

## Matriz de acesso

| Superficie | Leitura | Escrita | Regra |
| --- | --- | --- | --- |
| Dashboard e modo TV | Publica | Nao aplicavel | `GET /api/v1/dashboard/scrap*` e leitura de metas sao publicos para exibicao em TV. O contrato deve permanecer agregado e sem dados pessoais. |
| Opcoes de filtro | Publica | Nao aplicavel | `GET /api/v1/scrap/filters` fornece somente valores distintos para montar filtros publicos; nao retorna linhas de transacao. |
| Relatorios detalhados | Usuario autenticado | Nao aplicavel | `GET /api/v1/scrap` exige `CurrentUserDep`; esconder a tela no frontend nao substitui essa verificacao. |
| Relatorios publicados | Usuario autenticado | Usuario autenticado | O MVP permite criar, compor, publicar e exportar relatorios a qualquer usuario autenticado; autoria e auditoria permanecem obrigatorias. |
| Metas do dashboard | Publica | Superusuario | A consulta e publica; `PUT /api/v1/dashboard/scrap/targets/{year}/{month}` exige `CurrentSuperUserDep`. |
| Aliases de codigos | Usuario autenticado | Superusuario | Configuracao compartilhada. Somente administrador pode altera-la. |
| Perfil | Proprio usuario | Proprio usuario | Identidade e privilegios sao derivados da sessao, nunca do payload. |
| Usuarios | Superusuario | Superusuario | Nao existe auto cadastro. Contas sao provisionadas por pessoa autorizada. |
| Ingestao do robo | Chave de API com escopo | Chave de API com escopo | As mutacoes de scrap exigem o cabecalho `X-API-Key`; sessao de navegador e `Authorization: Bearer` nao substituem essa chave. |

## Regras de implementacao

- O dashboard publico nao pode incorporar dados pessoais, credenciais, comentarios livres ou linhas detalhadas de transacao.
- Filtros publicos devem continuar limitados ao schema atual, com valores e quantidade de parametros validados no backend.
- Toda mutacao de configuracao compartilhada exige autenticacao, CSRF valido quando usar sessao e autorizacao de superusuario.
- O perfil nao aceita `tier`, `is_superuser`, papel ou identificador de outro usuario.
- O bootstrap local de uma conta administrativa e feito por `python -m scripts.setup_initial_data`. Ele cria um usuario local provisionado; nao existe SQLAdmin nem credencial administrativa paralela em runtime.
- Depois do bootstrap, um administrador cria contas reais por `POST /api/v1/users/`.
  A rota exige `CurrentSuperUserDep`; auto cadastro e criacao por usuario comum
  permanecem desabilitados.
- Login usa exclusivamente `username` e senha locais. Nao ha login social ou provisionamento por identidade externa.

## Testes minimos

- Visitante recebe `401` ao chamar `GET /api/v1/scrap`.
- Visitante consegue chamar `GET /api/v1/scrap/filters` e os endpoints de dashboard publico.
- Usuario comum recebe `403` em mutacoes administrativas.
- Usuario nao consegue ler ou alterar o perfil de outra pessoa.
- Novas rotas devem ser adicionadas a esta matriz antes de serem publicadas.
