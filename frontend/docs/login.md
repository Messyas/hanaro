# Login no shell público

Não existe uma página ou rota `/login`. Usuários anônimos continuam dentro do
shell e acessam normalmente as áreas públicas, como o Dashboard. No rodapé da
sidebar, o lugar da identidade do usuário exibe o botão `Entrar`; ele abre
`LoginDialog` em um overlay com fundo opaco.

Na sidebar recolhida, esse rodapé nunca desaparece. Um visitante vê a versão
circular do botão `Entrar`, com o mesmo rótulo acessível e o mesmo `LoginDialog`.
Quando há uma sessão, o círculo mostra a foto ou as iniciais do usuário e funciona
como gatilho do menu de Perfil e Sair. Nome, cargo e botão de três pontos ficam
reservados ao modo expandido, onde há espaço suficiente para essa informação.

O formulário é projetado para terminais compartilhados e uso em chão de fábrica:
fluxo curto, alto contraste, controles com pelo menos `56px` de altura, operação
completa por teclado e mensagens diretas.

## Contrato com o backend

Envie `POST /api/v1/auth/login` como `application/x-www-form-urlencoded`, com os
campos `username` e `password`. Uma resposta válida cria a sessão no cookie
`session_id` `HttpOnly` e disponibiliza o cookie de CSRF usado automaticamente
pelo `HttpClient` nas operações seguintes.

- Nunca armazene senha, session ID, JWT ou CSRF em `localStorage` ou
  `sessionStorage`.
- Não registre credenciais, resposta completa ou identificadores pessoais no
  console.
- Use `autocomplete="username"` e `autocomplete="current-password"` para integrar
  gerenciadores de senha.
- Em `401` e `403`, apresente uma mensagem genérica para não confirmar se o usuário
  existe.
- Em `429`, respeite e apresente o tempo de `Retry-After` quando ele estiver
  disponível.
- Em falhas de rede ou servidor, preserve o formulário e permita uma nova
  tentativa, sem apagar o usuário digitado.

Após o login, limpe o campo de senha, feche a modal e atualize a identidade pelo
`GET /api/v1/auth/check-auth`. A sidebar passa a mostrar nome, foto ou iniciais,
função e os itens privados. Após confirmar o logout e revogar a sessão, mantenha o
usuário no sistema, volte ao `/dashboard` público e restaure o botão `Entrar`.

## Visibilidade e acesso

- Dashboard e suporte permanecem disponíveis sem autenticação.
- Relatórios e Perfil usam `authenticatedGuard` e aparecem somente após a sessão
  ser confirmada.
- Páginas dependentes da sessão usam `RenderMode.Client`; o SSR prerenderiza o
  shell público e a leitura do cookie começa após a hidratação no navegador.
- Ocultar um link não substitui autorização do backend; endpoints privados
  continuam validando a sessão.
- Durante a verificação inicial, o botão de login fica desabilitado para evitar
  abrir o formulário antes de conhecer o estado da sessão.

## Uso operacional

- Usuário e senha são obrigatórios, mas o frontend não impõe uma política de senha
  diferente da conta já cadastrada.
- O botão principal permanece grande e visível em telas pequenas e terminais
  touch.
- O formulário informa quando `Caps Lock` está ativo.
- Mostrar senha exige uma ação explícita e possui nome acessível.
- O conteúdo da modal acompanha o idioma já selecionado no sistema.
- O estado de envio bloqueia submissões duplicadas.
- A interface mantém mensagens de erro em uma região `aria-live`.
