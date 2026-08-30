# Revisao de segredos

**Data:** 30 de agosto de 2026. Escopo: arquivos rastreados na revisao atual.
Uma varredura do historico inteiro exige ferramenta apropriada, como Gitleaks, e
nao foi usada para afirmar ausencia historica de segredos.

## Achado corrigido

O arquivo rastreado `.env.example` continha credenciais de bootstrap que pareciam
reais. Elas foram removidas nesta alteracao e o arquivo agora contem somente
placeholders de desenvolvimento. Como a credencial ja esteve no Git, ela deve ser
tratada como exposta: revogue/rotacione a senha e invalide qualquer conta local
que ainda a utilize. A remocao da ponta do branch nao apaga o historico remoto.

## Controles confirmados

- `.env` e arquivos de producao sensiveis sao ignorados pelo Git; arquivos
  `*.example` sao publicos e nao podem conter valores reais.
- O bootstrap exige quatro variaveis de ambiente somente no momento da execucao
  de `python -m scripts.setup_initial_data`; elas nao autenticam uma interface
  administrativa em runtime.
- Chaves de API sao persistidas como hash; o valor em texto plano deve ser
  mostrado apenas na criacao.
- Mensagens de falha de execucao passam por redacao antes de persistencia.

## Acao recomendada

Adicione Gitleaks ou equivalente ao pre-commit/CI, execute uma varredura no
historico completo e siga o procedimento de rotacao para qualquer valor achado.
