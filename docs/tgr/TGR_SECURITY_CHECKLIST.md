# TGR Consulting — Checklist de segurança

## Implementado e testado

- [x] startup de produção recusa configuração incompleta;
- [x] `JWT_SECRET` de produção exige ao menos 32 caracteres;
- [x] sessão e OAuth state usam políticas de cookie coerentes com HTTP local e HTTPS;
- [x] queries e mutations protegidas derivam tenant do usuário autenticado;
- [x] storage proxy só aceita o prefixo `igr/{userId}/exports/`;
- [x] limite padrão de request body em 1 MB;
- [x] rate limit por IP para superfícies HTTP sensíveis;
- [x] erros de log passam por redaction de credenciais e tokens;
- [x] exports exigem snapshot autoritativo aprovado;
- [x] versões baseline são imutáveis e lifecycle é idempotente;
- [x] arquivos `.env`, tokens e credenciais não fazem parte do receipt.

## Gates de produção

- [ ] validar callback e domínio exatos do provedor OAuth;
- [ ] executar upload/download real em storage com identidade de menor privilégio;
- [ ] escolher store distribuído para rate limit se houver mais de uma réplica;
- [ ] ligar alertas, retenção de logs e monitoramento do ambiente de deploy;
- [ ] executar restore drill segundo o RPO/RTO do banco gerenciado.

Falha em qualquer gate externo mantém produção bloqueada, sem invalidar a certificação local.
