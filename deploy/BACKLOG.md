# Backlog do deploy em intranet

Este backlog reúne os itens necessários para considerar o deploy de produção
pronto para uso em um servidor Docker dentro da intranet da empresa.

## P0 — bloqueadores para entrar em produção

### Configurar ambiente de produção

- [ ] Criar `deploy/.env.production` a partir de `.env.production.example`.
- [ ] Definir `PUBLIC_HOST` com o nome DNS interno definitivo.
- [ ] Gerar senhas fortes e exclusivas para PostgreSQL e Redis.
- [ ] Gerar uma `SECRET_KEY` aleatória, exclusiva e com pelo menos 32 caracteres.
- [ ] Guardar as credenciais no cofre de senhas ou solução de secrets da empresa.
- [ ] Restringir as permissões de leitura do arquivo `.env.production` no servidor.

Critério de aceite: o arquivo não contém valores de exemplo, não está no Git e
`docker compose -f deploy/compose.production.yaml --env-file deploy/.env.production config --quiet`
termina sem erros.

### Provisionar DNS e HTTPS internos

- [ ] Criar o registro DNS interno apontando `PUBLIC_HOST` para o servidor.
- [ ] Emitir um certificado para esse host pela autoridade certificadora da empresa.
- [ ] Instalar a cadeia em `deploy/nginx/certs/tls.crt` e a chave privada em
      `deploy/nginx/certs/tls.key`.
- [ ] Garantir que os computadores clientes confiem na autoridade certificadora.
- [ ] Restringir o acesso à chave privada no servidor.
- [ ] Documentar responsável, validade e procedimento de renovação do certificado.

Critério de aceite: o acesso HTTP redireciona para HTTPS e os navegadores da
intranet abrem a aplicação sem alerta de certificado.

### Disponibilizar a inicialização segura do sistema

- [ ] Adicionar ao Compose de produção um serviço executável apenas sob demanda
      para criar os dados iniciais e o primeiro superusuário.
- [ ] Incluir somente os scripts necessários na imagem desse serviço.
- [ ] Receber as credenciais iniciais por variáveis temporárias ou secrets.
- [ ] Garantir que a operação seja idempotente e não recrie usuários existentes.
- [ ] Remover as credenciais iniciais do ambiente após a execução.
- [ ] Documentar o comando de inicialização e a troca da senha no primeiro acesso.

Critério de aceite: uma instalação com banco vazio pode ser inicializada por um
comando documentado, sem usar a imagem de desenvolvimento e sem gravar a senha no Git.

### Implementar backup e restauração

- [ ] Definir frequência, retenção, destino e criptografia dos backups.
- [ ] Automatizar backup consistente do PostgreSQL.
- [ ] Incluir o volume de imagens de perfil no plano de backup.
- [ ] Avaliar se o Redis contém algum dado que precise de recuperação.
- [ ] Manter pelo menos uma cópia fora do servidor Docker.
- [ ] Documentar o procedimento de restauração completa.
- [ ] Executar e registrar um teste real de restauração.

Critério de aceite: banco e arquivos podem ser restaurados em um servidor limpo,
dentro dos objetivos de perda de dados e tempo de recuperação definidos pela empresa.

## P1 — operação e confiabilidade

### Configurar logs, monitoramento e alertas

- [x] Configurar rotação e limite de tamanho dos logs dos containers.
- [ ] Monitorar disponibilidade da aplicação e os healthchecks.
- [ ] Monitorar CPU, memória, disco e crescimento dos volumes Docker.
- [ ] Criar alertas para indisponibilidade e pouco espaço em disco.
- [ ] Definir retenção e acesso aos logs de aplicação.
- [ ] Evitar registro de senhas, cookies, tokens e dados pessoais.

Critério de aceite: uma falha ou falta de espaço gera alerta antes de causar perda
de serviço, e os logs não crescem sem limite.

### Preparar o servidor de produção

- [ ] Usar um servidor Linux suportado e atualizado.
- [ ] Instalar versões homologadas de Docker Engine e Docker Compose.
- [ ] Configurar inicialização automática do Docker após reinicialização.
- [ ] Liberar no firewall somente as portas necessárias para a intranet.
- [ ] Restringir SSH e administração do host aos operadores autorizados.
- [ ] Sincronizar relógio e fuso horário do servidor.
- [ ] Definir capacidade mínima de CPU, memória e armazenamento.

Critério de aceite: após reiniciar o servidor, a stack volta automaticamente e
somente as portas previstas ficam acessíveis pela rede.

### Definir atualização e rollback

- [ ] Fixar versões de imagens base com política de atualização controlada.
- [ ] Documentar build, atualização, migração e verificação pós-deploy.
- [ ] Criar backup antes de migrações destrutivas.
- [ ] Definir rollback da aplicação e a estratégia para migrações incompatíveis.
- [ ] Registrar versão, data e responsável por cada implantação.

Critério de aceite: uma versão pode ser instalada e revertida seguindo um
procedimento reproduzível e previamente testado.

## P2 — homologação e entrega

### Executar teste de aceitação no ambiente da empresa

- [ ] Construir todas as imagens no servidor ou pipeline definitivo.
- [ ] Confirmar que todos os containers ficam saudáveis.
- [ ] Confirmar que `/` entrega o frontend pelo host interno.
- [ ] Confirmar que `/api/` chega ao backend pela mesma origem.
- [ ] Confirmar que as portas do backend, PostgreSQL e Redis não estão públicas.
- [ ] Testar login, logout, expiração de sessão e limite de sessões.
- [ ] Testar proteção CSRF e rejeição de hosts desconhecidos.
- [ ] Confirmar os headers de segurança nas páginas, assets e APIs.
- [ ] Testar upload, persistência e restauração de imagens de perfil.
- [ ] Reiniciar containers e o servidor para validar recuperação automática.
- [ ] Executar teste de backup e restauração antes da liberação.

Critério de aceite: todos os testes passam no servidor e em uma estação cliente
real da intranet, com evidências registradas.

## Checklist de liberação

- [ ] Todos os itens P0 foram concluídos.
- [ ] Teste de restauração aprovado.
- [ ] Teste de aceitação aprovado.
- [ ] Responsáveis por operação, backup e certificados definidos.
- [ ] Credenciais entregues por canal seguro.
- [ ] Procedimento de suporte e comunicação de incidentes definido.
- [ ] Data de entrada em produção aprovada pela empresa.
