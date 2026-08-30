# Modelo de acesso do Hanaro

Este documento registra as decisões de produto e os limites de autorização da
aplicação. Uma rota pública é uma escolha explícita de negócio, não a ausência
acidental de um guard.

## Matriz de acesso

| Superfície | Leitura | Escrita | Regra de negócio |
| --- | --- | --- | --- |
| Dashboard | Pública | Não aplicável | Deve funcionar sem login, inclusive em TVs. Expõe somente projeções agregadas e dados adequados à exibição pública. |
| Modo TV | Pública | Proibida | Não cria sessão, não contém controles administrativos e consome somente endpoints públicos de leitura. |
| Relatórios | Usuário autenticado | Conforme a função futura | Contém dados detalhados e operacionais; não pode ser acessado por visitante anônimo. |
| Metas do dashboard | Pública | Superusuário | Todos podem visualizar metas; somente administrador pode criá-las ou alterá-las. |
| Aliases de códigos | Usuário autenticado | Superusuário | A configuração é compartilhada entre todos os usuários, mas somente administrador pode criar, alterar ou remover aliases. |
| Preferências visuais | Pública e local ao navegador | Próprio navegador | Tema e idioma não são configuração de domínio e não exigem conta. |
| Perfil | Próprio usuário autenticado | Próprio usuário autenticado | O usuário só lê e altera o próprio perfil; privilégios, tier e identidade administrativa não fazem parte do payload de perfil. |
| Administração de usuários | Superusuário | Superusuário | Não existe cadastro público. Contas são provisionadas por uma pessoa autorizada no contexto da empresa. |
| Ingestão e execução do robô | Chave de API com escopo | Chave de API com escopo | Não utiliza a sessão de navegador e não aceita chamada anônima. |

## Dashboard público e modo TV

Os endpoints sob `/api/v1/dashboard/scrap` são públicos por design. Essa decisão
permite abrir o dashboard em uma TV ou estação de acompanhamento sem criar ou
persistir uma conta no dispositivo.

O contrato público deve permanecer agregado e mínimo. Ele não deve incorporar
nomes completos, e-mail, telefone, credenciais, comentários livres, ordens de
trabalho ou outros campos que identifiquem uma pessoa. Toda alteração no schema
de resposta público exige uma revisão específica de exposição de dados.

As operações de escrita não herdam o caráter público da leitura. Por exemplo,
`PUT /api/v1/dashboard/scrap/targets/{year}/{month}` continua restrito a
`CurrentSuperUserDep`.

## Relatórios

A tela `/relatorios` exige sessão autenticada. A mesma regra deve existir no
backend: esconder o link ou aplicar um guard Angular não é controle de acesso.

Os endpoints detalhados `GET /api/v1/scrap` e `GET /api/v1/scrap/filters` estão
atualmente públicos. Antes de serem usados como fonte dos Relatórios, devem
receber `CurrentUserDep` ou uma permissão mais específica. O endpoint detalhado
retorna campos operacionais que não pertencem ao contrato público do dashboard.

## Configuração de aliases

Aliases traduzem códigos vindos do arquivo para nomes compartilhados no sistema.
Eles são configuração de domínio, não preferência visual do navegador.

Quando essa funcionalidade for implementada:

- usuários autenticados podem consultar os aliases usados nos relatórios;
- somente `CurrentSuperUserDep` pode criar, alterar ou remover aliases;
- o backend deriva o ator da sessão e registra `actor_id`, data e valores antes/depois;
- o payload não aceita `actor_id`, role, `is_superuser` ou outro campo de privilégio;
- atualizações concorrentes devem usar versão, comparação otimista ou transação;
- toda mutação via sessão exige CSRF válido;
- a interface administrativa deve ficar separada da rota pública de tema e idioma.

## Cadastro e perfil

Não existe auto cadastro. `POST /api/v1/users` permanece administrativo e não
deve ganhar uma variante pública sem uma nova decisão de produto e um fluxo de
convite/verificação.

A intranet utiliza exclusivamente credenciais locais. Depois que um
administrador provisiona a conta, o usuário entra com `username` e senha. Não
há login social, vínculo com Google/GitHub nem criação automática de usuário a
partir de identidade externa.

O perfil usa a identidade resolvida pela sessão. O usuário comum só pode ler e
alterar a própria conta e imagem. Mudança de tier, ativação, anonimização ou
manutenção de outra conta pertence à administração e exige autorização explícita
no backend.

Os schemas de criação e atualização usam `extra="forbid"`: campos desconhecidos
ou de identidade externa são rejeitados. O perfil permite apenas nome, username,
e-mail, dados de contato e imagem; tier e privilégios continuam fora desse
payload.

## Invariantes de implementação e teste

- O backend é a autoridade de autorização; guards e visibilidade no frontend são UX.
- Rotas públicas aceitam somente `GET`/`HEAD`, salvo exceção documentada.
- Nenhuma rota de configuração de domínio aceita escrita anônima.
- Cada mutação administrativa possui teste de `401`, `403` e sucesso de superusuário.
- Relatórios possuem teste garantindo que visitante anônimo recebe `401`.
- Dashboard e modo TV possuem teste garantindo leitura anônima e ausência de dados pessoais.
- Perfil possui teste cruzado: usuário A não lê nem altera o perfil do usuário B.
- Perfil rejeita campos desconhecidos, tier e privilégio.
- Toda nova rota deve ser adicionada a esta matriz antes de ser publicada.
