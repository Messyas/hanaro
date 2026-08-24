# Perfil, configurações e idiomas

`Perfil` e `Configurações` são funcionalidades distintas:

- `/configuracoes` é pública e contém apenas preferências locais da interface:
  tema claro/escuro/sistema e idioma;
- `/perfil` exige sessão e contém os dados do próprio usuário: nome, e-mail da
  conta, e-mail de notificações, telefone e cargo;
- o nome de usuário aparece no Perfil somente para consulta. Alterá-lo muda a
  credencial de login e, por isso, não faz parte desse formulário;
- o item `Perfil` fica no menu dos três pontos da identidade; `Configurações`
  aparece como página normal da sidebar, inclusive para visitantes.

As duas páginas usam um único `h1.page-title`, sem subtítulo ou descrição logo
abaixo. Cada área funcional começa diretamente por um `h2` e pode ter uma
descrição curta. Não coloque ícones decorativos antes de títulos de cards ou
seções.

No Perfil, use a superfície branca com raio de `24px` fornecida pelo
`app-canvas`; não crie outro card dentro dela. O `h1` fica no topo dessa
superfície e uma borda suave separa cada área; não transforme Dados pessoais,
Contato e foto em vários cards aninhados. Os dados aparecem primeiro
como pares de rótulo e valor, em duas colunas no desktop e uma no mobile. O botão
`Editar perfil` alterna somente os dados editáveis para campos de formulário;
`Cancelar` restaura o último estado salvo e `Salvar alterações` atualiza a
sessão. A foto permanece em uma linha de identidade independente, com avatar,
nome, e-mail e ações alinhadas à direita, pois seu CRUD não depende do modo de
edição dos demais dados.

## Tradução em tempo de execução

As preferências são aplicadas no navegador por `LanguageService`. Textos que
precisam mudar imediatamente ao escolher um idioma devem vir de
`language.translations()`; não use `$localize` nesses pontos, pois ele é resolvido
durante o build e não reage à troca em tempo de execução.

Ao criar ou alterar uma página:

1. adicione a chave ao contrato `AppTranslations`;
2. preencha a chave nos três catálogos `pt`, `en` e `ko`;
3. leia o catálogo no template com `@let t = language.translations()`;
4. traduza também `aria-label`, placeholder, loading, vazio, erro e sucesso;
5. nunca monte a interface comparando textos traduzidos; regras usam códigos
   estáveis (`pt`, `en`, `ko`) e valores de domínio.

A sidebar e o breadcrumb usam a mesma árvore reativa de navegação. Portanto, o
label de uma rota deve vir do catálogo (`t.navSettings`, por exemplo). Ao trocar
o idioma, sidebar, breadcrumb, menu do perfil e páginas abertas devem mudar sem
reload.

Os nomes nativos das opções permanecem reconhecíveis (`Português (BR)`,
`English`, `한국어`); o texto secundário usa o idioma atualmente selecionado. A
lista de idiomas é sempre vertical dentro do card.

## Persistência do perfil

O formulário carrega `GET /api/v1/users/me` e salva uma allowlist por
`PATCH /api/v1/users/{username}`. Nunca use dados hardcoded nem aceite que o
frontend escolha outro usuário. Uma mudança no e-mail da conta invalida a
verificação anterior no backend. Campos opcionais vazios são enviados como
`null`, e a identidade da sidebar é atualizada por `AuthService.refreshSession()`
depois do salvamento.

## Foto do perfil

A foto faz parte do Perfil autenticado e usa um CRUD próprio. A interface deve
mostrar a imagem atual (ou as iniciais como fallback) e somente as ações
necessárias para o estado atual: `Adicionar foto`, `Alterar foto` e
`Remover foto`. A seleção de um arquivo inicia o envio, exibe o preview local e
mantém feedback acessível de processamento, sucesso ou erro. Todos esses textos
devem existir nos três catálogos de idioma.

Os endpoints são sempre relativos ao usuário da sessão; o cliente nunca envia
um identificador de usuário:

- `GET /api/v1/users/me/profile-image`: lê o arquivo atual;
- `PUT /api/v1/users/me/profile-image`: cria ou substitui usando o campo
  multipart `image`;
- `DELETE /api/v1/users/me/profile-image`: remove a associação e o arquivo.

Aceite apenas JPEG, PNG e WebP de até 5 MB no cliente e valide novamente no
servidor. O backend deve decodificar a imagem, rejeitar arquivos animados ou
corrompidos, limitar dimensões, corrigir a orientação EXIF e regravar como WebP
sem metadados. Não exponha caminhos do disco na URL nem confie apenas no MIME
declarado pelo navegador. O arquivo fica no volume persistente
`profile_images`, e uma substituição ou exclusão também remove a versão anterior
do armazenamento.

Depois de criar, substituir ou remover a foto, chame
`AuthService.refreshSession()`. Assim, a imagem exibida na identidade da sidebar
é atualizada sem reload e permanece coerente em todos os idiomas.
