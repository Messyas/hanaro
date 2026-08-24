# Certificados TLS

Este diretório recebe os certificados provisionados para o host definido em
`PUBLIC_HOST`:

```text
tls.crt    cadeia pública do certificado
tls.key    chave privada correspondente
```

Os arquivos reais permanecem fora do Git. Em produção, copie-os para este
diretório com acesso restrito ao operador do deploy ou substitua o bind mount
por um secret do orquestrador.

Quando a organização encerrar TLS em um balanceador corporativo anterior ao
Nginx, mantenha HTTPS também entre as camadas ou adapte a configuração com a
equipe de infraestrutura. O endereço HTTP público deve continuar redirecionando
para HTTPS.
