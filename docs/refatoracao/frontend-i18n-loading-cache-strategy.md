# Especificação de i18n — carregamento, cache e resolução de idioma

Data: 2026-09-13
Escopo: frontend Angular, SSR e integração com preferências do usuário
Status: proposta aprovada para implementação incremental
Documento relacionado: [Frontend SOLID refactoring report](./frontend-solid-refactoring-report.md)

## 1. Objetivo

Definir uma estratégia única para os idiomas português, inglês e coreano que:

- preserve a troca de idioma em tempo de execução, sem recarregar a aplicação;
- evite incluir os três catálogos completos no bundle inicial;
- permita que o servidor determine o idioma antes da renderização SSR;
- use cache previsível e versionado, sem limpeza manual de dados no navegador;
- mantenha traduções globais e traduções de feature em limites claros;
- elimine gradualmente a duplicidade entre os catálogos TypeScript e a configuração XLF.

## 2. Decisão arquitetural

O Hanaro adotará **i18n em runtime com carregamento assíncrono por idioma e por feature**.

O idioma inicial será resolvido no servidor quando houver uma requisição SSR. O navegador receberá somente o catálogo necessário para renderizar a tela atual. Outros idiomas serão carregados apenas quando o usuário os selecionar.

Não será criada uma rotina própria para apagar traduções antigas do navegador. A invalidação será feita por versionamento de assets, cabeçalhos HTTP e, se habilitado, pela política do Angular Service Worker.

### Consequências da decisão

- A troca de idioma continuará acontecendo sem reload.
- O primeiro carregamento não transportará traduções que o usuário não utiliza.
- O servidor precisará conhecer o idioma por perfil, sessão ou cookie; `localStorage` não está disponível durante SSR.
- Cada catálogo precisará ter contrato tipado e fallback explícito.
- O sistema atual baseado em um único objeto `TRANSLATIONS` será substituído de forma incremental.

## 3. Estado atual

O frontend declara `pt`, `en` e `ko` no mesmo objeto `TRANSLATIONS` em `frontend/src/app/i18n/language.service.ts`. Como consequência, os três catálogos são compilados juntos no JavaScript associado ao serviço.

Também existem catálogos contendo os três idiomas em:

- `frontend/src/app/pages/dashboard/dashboard.translations.ts`;
- `frontend/src/app/pages/dashboard/kiosk/dashboard-kiosk.translations.ts`.

A preferência do navegador é persistida na chave `hanaro-language-preference`, contendo apenas o código do idioma. Esse formato deve ser preservado.

Durante SSR, `LanguageService` retorna `pt` sem consultar a requisição. Isso pode produzir HTML inicial em português e uma mudança posterior para inglês ou coreano após a hidratação.

O `angular.json` declara o locale fonte e arquivos XLF, mas a interface atual utiliza majoritariamente o catálogo reativo de runtime. Manter dois sistemas cobrindo as mesmas mensagens aumenta o risco de divergência.

## 4. Idiomas e códigos canônicos

Os códigos internos aceitos continuam sendo:

```ts
export type LanguageCode = 'pt' | 'en' | 'ko';
```

Mapeamento de locale para formatação:

| Código interno | Locale de apresentação | Nome nativo |
| --- | --- | --- |
| `pt` | `pt-BR` | Português (BR) |
| `en` | `en-US` | English |
| `ko` | `ko-KR` | 한국어 |

Regras de negócio, filtros e comparações usam sempre os códigos internos. Texto traduzido nunca deve controlar comportamento.

## 5. Ordem de resolução do idioma

O idioma inicial deverá ser resolvido nesta ordem:

1. preferência persistida no perfil do usuário autenticado;
2. cookie de idioma válido enviado na requisição;
3. cabeçalho HTTP `Accept-Language`;
4. idioma padrão `pt`.

Depois que o usuário selecionar um idioma:

1. a interface muda imediatamente;
2. o código é salvo em cookie para as próximas renderizações SSR;
3. o código pode permanecer no `localStorage` como fallback do cliente;
4. para usuários autenticados, a preferência é sincronizada com o servidor.

O valor recebido de cookie, perfil ou cabeçalho deve ser normalizado para `pt`, `en` ou `ko`. Valores ausentes ou não suportados resultam em `pt`.

## 6. Fluxo de carregamento

```text
Requisição inicial
  -> servidor resolve o LanguageCode
  -> SSR carrega o catálogo global desse idioma
  -> HTML informa o idioma em <html lang="...">
  -> estado inicial é transferido para o navegador
  -> hidratação reutiliza o mesmo idioma e catálogo
  -> rota carrega o catálogo da feature vigente

Troca manual de idioma
  -> LanguageService valida o código
  -> carrega catálogo global e catálogo da feature aberta
  -> atualiza o signal somente após carga válida
  -> persiste cookie/localStorage e perfil
  -> mantém em memória os catálogos usados na sessão
```

Durante uma troca, a interface não deve exibir chaves cruas nem misturar idiomas. Se o novo catálogo falhar, o idioma anterior permanece ativo e uma mensagem traduzida de erro é exibida.

## 7. Estrutura-alvo de pastas

A estrutura será ajustada ao plano de migração para `core`, `shared` e `modules`:

```text
frontend/src/app/
├── core/
│   └── i18n/
│       ├── language-code.ts
│       ├── language-preference.port.ts
│       ├── language.service.ts
│       ├── translation-loader.ts
│       ├── translation-registry.ts
│       └── locales/
│           ├── pt.ts
│           ├── en.ts
│           └── ko.ts
├── shared/
│   └── i18n/
│       └── translation.types.ts
└── modules/
    └── dashboard/
        └── i18n/
            ├── dashboard-translations.ts
            └── locales/
                ├── pt.ts
                ├── en.ts
                └── ko.ts
```

Cada feature será proprietária de suas mensagens. `core/i18n` conterá somente infraestrutura, preferências e mensagens globais de layout, autenticação e navegação.

Features não poderão importar catálogos internos de outra feature. Se uma mensagem for realmente compartilhada, ela deverá ser promovida para um contrato compartilhado pequeno e explícito.

## 8. Contratos propostos

O carregador deve depender de um contrato estreito, sem conhecer componentes ou regras específicas de uma feature:

```ts
export interface TranslationLoader<TTranslations> {
  load(language: LanguageCode): Promise<TTranslations>;
}
```

Um registro de catálogos pode usar imports dinâmicos:

```ts
const GLOBAL_TRANSLATION_LOADERS = {
  pt: () => import('./locales/pt').then(({ PT_TRANSLATIONS }) => PT_TRANSLATIONS),
  en: () => import('./locales/en').then(({ EN_TRANSLATIONS }) => EN_TRANSLATIONS),
  ko: () => import('./locales/ko').then(({ KO_TRANSLATIONS }) => KO_TRANSLATIONS),
} satisfies Record<LanguageCode, () => Promise<AppTranslations>>;
```

Requisitos dos contratos:

- catálogos são `readonly`;
- os três idiomas satisfazem a mesma interface TypeScript;
- chaves ausentes falham no build ou nos testes de contrato;
- imports dinâmicos devem permanecer estáticos e enumerados para o bundler gerar chunks previsíveis;
- o loader não acessa diretamente `window`, `document`, cookies ou `localStorage`;
- persistência fica atrás de uma porta própria de preferência de idioma.

## 9. Responsabilidades

### `LanguageService`

- expor idioma atual e traduções por signals;
- validar e normalizar `LanguageCode`;
- coordenar a troca de idioma;
- manter o último catálogo válido durante carregamentos;
- expor estados `idle`, `loading` e `error` quando necessários.

### `TranslationLoader`

- carregar um catálogo por idioma;
- deduplicar requisições concorrentes para o mesmo catálogo;
- validar o resultado antes de publicá-lo;
- não decidir preferência nem alterar o idioma ativo.

### `LanguagePreferencePort`

- ler a preferência disponibilizada pelo ambiente;
- persistir o código selecionado;
- permitir adaptadores distintos para navegador, SSR e perfil remoto.

### Backend/SSR

- resolver a precedência da preferência;
- disponibilizar o idioma inicial para o bootstrap Angular;
- configurar o atributo `lang` correto;
- evitar que a hidratação escolha um idioma diferente do HTML recebido;
- sincronizar a preferência do usuário autenticado quando aplicável.

### Feature

- possuir suas chaves e catálogos;
- registrar ou carregar as traduções quando sua rota for ativada;
- traduzir conteúdo visível, `aria-label`, placeholder e mensagens de estado;
- não implementar persistência ou detecção de idioma.

## 10. Política de cache

### Regras obrigatórias

- Guardar em `localStorage` e cookie apenas o código do idioma.
- Não guardar objetos completos de tradução em `localStorage`.
- Usar nomes com hash de conteúdo para chunks gerados pelo build.
- Para JSON estático, usar versão no nome ou URL e cabeçalhos HTTP coerentes.
- Manter um cache em memória por sessão para evitar carregamentos repetidos.
- Não apagar manualmente os outros idiomas após cada troca.

### Cache em memória

O loader poderá manter:

```ts
Map<LanguageCode, AppTranslations>
```

Para catálogos de feature, a chave deverá combinar feature e idioma. Esse cache vive somente durante a sessão da página e não exige política de expiração.

### Cache HTTP

Assets com hash podem usar cache longo e `immutable`, pois uma alteração gera uma nova URL. Arquivos sem hash precisam de revalidação ou versão explícita.

### Angular Service Worker

Caso o projeto adote PWA/Service Worker, os catálogos devem usar carregamento sob demanda (`installMode: "lazy"`). Traduções nunca solicitadas não precisam ser pré-carregadas. Grupos de dados devem ter `maxSize` e `maxAge` finitos.

Uma rotina de limpeza customizada só será aceita se uma medição demonstrar crescimento não limitado fora das políticas padrão do navegador ou do Service Worker.

## 11. SSR e hidratação

O SSR não pode depender de `localStorage`. A preferência precisa estar acessível pela requisição, normalmente por cookie, sessão ou perfil autenticado.

O locale resolvido no servidor deve ser transferido para o cliente junto com o estado inicial. O cliente deve reutilizá-lo durante a hidratação, sem executar uma segunda decisão conflitante.

Requisitos:

- HTML renderizado e aplicação hidratada usam o mesmo idioma;
- não ocorre flash inicial em português para usuários de inglês ou coreano;
- a primeira requisição não precisa buscar novamente um catálogo já usado no SSR;
- falha ao consultar o perfil não bloqueia a aplicação: cookie, cabeçalho e `pt` formam os fallbacks;
- cookies devem ter escopo, `SameSite`, segurança e duração definidos pela política de autenticação do ambiente.

## 12. Persistência no servidor

Para usuários autenticados, o perfil poderá expor um campo equivalente a:

```json
{
  "language": "en"
}
```

O frontend não precisa baixar todos os catálogos a partir do backend. O servidor armazena a **preferência**, enquanto os assets de tradução podem continuar sendo servidos estaticamente pelo Angular/deploy.

Servir traduções por API é permitido, mas só deve ser adotado se houver necessidade real de alterar textos sem novo deploy. Nesse cenário, a API deverá fornecer versão/ETag, contrato de fallback e política de indisponibilidade.

## 13. Escolha entre runtime e i18n de build do Angular

O Angular também suporta gerar uma aplicação completa para cada locale com `localize`, normalmente publicada em `/pt/`, `/en/` e `/ko/`. Essa alternativa entrega apenas um idioma ao usuário, porém a troca costuma navegar ou recarregar a variante localizada.

O Hanaro preservará runtime i18n porque a troca imediata sem reload já faz parte do comportamento esperado. Os XLF não devem continuar como uma segunda fonte das mesmas mensagens. Ao final da migração, uma decisão explícita deverá:

- remover a configuração XLF não utilizada; ou
- limitar XLF apenas a mensagens que sejam deliberadamente de build, documentando essa fronteira.

## 14. Tratamento de erros e fallback

- Idioma inválido: normalizar para `pt`.
- Catálogo global indisponível durante a inicialização: usar `pt` e registrar o erro.
- Catálogo do novo idioma indisponível durante troca: manter o idioma anterior.
- Catálogo de feature indisponível: apresentar estado de erro recuperável; não mostrar chaves técnicas.
- Chave ausente: falhar em teste/build; em produção, registrar telemetria e usar fallback controlado.
- Resposta incompatível da API de perfil: ignorar o valor e continuar pela cadeia de fallback.

## 15. Segurança e privacidade

- Catálogos enviados ao navegador são públicos para qualquer usuário que acesse a aplicação; não podem conter segredos.
- A preferência de idioma não deve ser usada como autorização ou identificação de tenant.
- Chaves e valores de tradução não devem conter HTML não confiável.
- Se traduções vierem de API, o cliente deve continuar usando interpolação segura e evitar renderização arbitrária com `innerHTML`.

## 16. Observabilidade

Registrar, sem dados sensíveis:

- idioma resolvido e origem da decisão (`profile`, `cookie`, `header`, `default`);
- falhas de carregamento por idioma e feature;
- fallback aplicado;
- incompatibilidade entre locale do SSR e da hidratação;
- duração do carregamento dos catálogos.

Não registrar conteúdo do perfil, cookies completos ou textos potencialmente sensíveis.

## 17. Plano de implementação

### Fase I18N-0 — Medição e contrato

- [ ] Medir o tamanho minificado e compactado dos catálogos atuais.
- [ ] Inventariar catálogos globais e específicos de feature.
- [ ] Definir `LanguageCode`, contrato base e teste de igualdade de chaves.
- [ ] Registrar a fronteira entre runtime i18n e XLF.
- [ ] Criar testes de caracterização para troca imediata de idioma.

Aceite: existe uma baseline reproduzível e os três catálogos têm o mesmo conjunto de chaves.

### Fase I18N-1 — Separação dos catálogos globais

- [ ] Mover a infraestrutura para `core/i18n` conforme o WP1 do relatório SOLID.
- [ ] Dividir `TRANSLATIONS` em `pt.ts`, `en.ts` e `ko.ts`.
- [ ] Implementar carregamento com imports dinâmicos enumerados.
- [ ] Adicionar cache em memória e deduplicação de requisições.
- [ ] Manter compatibilidade temporária com `language.translations()`.

Aceite: o bundle/chunk inicial contém somente o idioma inicial e a troca continua sem reload.

### Fase I18N-2 — SSR e preferência

- [ ] Criar a porta de preferência de idioma.
- [ ] Implementar adaptador de navegador para cookie e `localStorage`.
- [ ] Resolver idioma no SSR por perfil, cookie, `Accept-Language` e fallback.
- [ ] Transferir locale e catálogo inicial para a hidratação.
- [ ] Sincronizar a preferência autenticada com o backend.

Aceite: não há flash de idioma nem divergência de hidratação nos três idiomas.

### Fase I18N-3 — Catálogos por feature

- [ ] Migrar Dashboard e Kiosk como piloto.
- [ ] Carregar traduções junto com a rota/feature.
- [ ] Migrar as demais features na ordem do relatório SOLID.
- [ ] Impedir imports entre catálogos internos de features.
- [ ] Remover tabelas antigas após a migração de cada consumidor.

Aceite: abrir uma feature não baixa catálogos de outras features e não duplica mensagens globais.

### Fase I18N-4 — Cache e fechamento

- [ ] Configurar cache HTTP/versionamento dos assets.
- [ ] Se houver Service Worker, configurar catálogos como `lazy`.
- [ ] Decidir e remover a estratégia XLF redundante.
- [ ] Adicionar verificação de chaves e literais não traduzidos ao CI.
- [ ] Atualizar documentação e grafo de conhecimento.

Aceite: cache, atualização e fallback são verificáveis; não existem duas fontes concorrentes para a mesma tradução.

## 18. Estratégia de testes

### Testes unitários

- resolução e normalização de locale;
- precedência perfil, cookie, cabeçalho e padrão;
- igualdade das chaves entre `pt`, `en` e `ko`;
- cache em memória e deduplicação de carregamentos;
- preservação do idioma anterior após falha;
- sincronização da preferência sem acoplar o serviço à API concreta.

### Testes de integração

- bootstrap com cada idioma;
- troca `pt -> en -> ko` sem reload;
- navegação lazy para feature com catálogo próprio;
- retorno a um idioma já carregado sem nova requisição;
- fallback quando perfil ou catálogo remoto falha.

### Testes SSR/hidratação

- cookie `en` produz HTML e hidratação em inglês;
- perfil `ko` tem precedência sobre cookie e cabeçalho;
- `Accept-Language` é respeitado sem preferência persistida;
- locale não suportado resulta em português;
- ausência de `localStorage` no servidor não causa erro;
- não existem avisos de hydration mismatch.

### Testes de experiência e acessibilidade

- `lang` do documento acompanha o idioma ativo;
- sidebar, breadcrumb, diálogos e página aberta mudam juntos;
- foco não é perdido durante a troca;
- loading, vazio, erro, sucesso, placeholder e `aria-label` estão traduzidos;
- coreano não causa truncamento crítico e funciona a 320 px e 200% de zoom.

## 19. Critérios de aceite finais

- [ ] Apenas o idioma inicial é transferido no primeiro carregamento.
- [ ] Trocar de idioma não exige reload.
- [ ] Somente o código do idioma é persistido em cookie/localStorage.
- [ ] Usuários autenticados podem manter a preferência no servidor.
- [ ] SSR e hidratação começam no mesmo idioma.
- [ ] Catálogos são carregados sob demanda e versionados.
- [ ] Não existe limpeza manual periódica de traduções no navegador.
- [ ] Os três idiomas têm contratos completos e testados.
- [ ] Traduções de feature ficam dentro da respectiva feature.
- [ ] Não existem fontes TypeScript e XLF concorrentes para a mesma mensagem.
- [ ] Testes, build, formatação e verificações arquiteturais passam.

## 20. Referências

- [Angular — Merge translations into the application](https://angular.dev/guide/i18n/merge)
- [Angular — Deploy multiple locales](https://angular.dev/guide/i18n/deploy)
- [Angular — Service worker configuration](https://angular.dev/ecosystem/service-workers/config)
- [Perfil, configurações e idiomas](../../frontend/docs/profile-settings-i18n.md)
- [Relatório de refatoração frontend SOLID](./frontend-solid-refactoring-report.md)
