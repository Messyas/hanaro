# Modo TV

Esta pasta receberá a tela contínua de acompanhamento da fábrica. A feature deve
conter seus componentes, rota, serviço HTTP, tipos e testes.

- Opera sem login, cookie de sessão ou dados pessoais.
- Consome apenas endpoints públicos de leitura por URLs relativas `/api/v1/...`.
- Mantém o último dado válido e informa a hora da última atualização.
- Atualiza com intervalo configurável, timeout, backoff e jitter.
- Suporta perda de rede e execução prolongada sem diálogo bloqueante.
- Mantém contraste, tipografia e densidade adequados à visualização à distância.

Não inclua controles de escrita, administração ou configuração pessoal nesta
feature.
