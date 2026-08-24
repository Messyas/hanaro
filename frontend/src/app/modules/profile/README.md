# Perfil

Esta pasta receberá a área autenticada de dados e preferências pessoais. A
feature deve conter seus componentes, rota, serviço HTTP, tipos e testes.

- Obtém a identidade pela sessão; não envia um ID de usuário escolhido pela UI.
- Permite alterar somente campos presentes na allowlist do contrato da API.
- Valida telefone para feedback local e depende da validação definitiva do backend.
- Não registra telefone completo, cookie, token ou payload pessoal no console.
- Trata sessão expirada, acesso negado, conflito de atualização e erro de rede.
- Oferece encerramento explícito da sessão em dispositivos compartilhados.

O guard melhora o fluxo de navegação; a autorização obrigatória permanece no
backend.
