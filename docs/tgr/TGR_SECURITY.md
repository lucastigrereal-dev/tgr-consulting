# TGR Consulting — Security

## Controles implementados

- autenticação de sessão e procedimentos tRPC protegidos;
- tenancy derivada de `user.id` e checada em todas as operações de projeto/versão;
- papéis para aprovação/baseline/export;
- baseline imutável e exports restritos a snapshot autoritativo aprovado;
- `TRUST_PROXY` desativado por padrão; `X-Forwarded-For` não é usado diretamente pelo rate limiter;
- CSP, `nosniff`, referrer policy, frame policy e permissions policy; HSTS apenas em produção HTTPS;
- request ID validado/gerado, devolvido em `X-Request-Id` e incluído em logs estruturados;
- redaction de bearer/token/code/secret/password em logs;
- stack trace do Error Boundary oculto fora de development/test;
- limite de body, rate limit local e prefixo de storage tenant-bound;
- startup de produção fail-closed para configuração obrigatória.

## Provas locais

Testes cobrem spoofing de IP, headers, request ID, redaction, logout, autorização/tenant, imutabilidade, storage path e export eligibility. O E2E master usa segredo, usuário, banco e storage local temporários; nenhuma credencial de produção é necessária ou gravada.

## Gates externos

- callback/domínio/credenciais OAuth reais;
- identidade e upload/download no storage real;
- secret manager, TLS, WAF/rede e observabilidade do deploy;
- retenção e acesso a logs centralizados;
- rate limit distribuído para múltiplas réplicas;
- restore conforme RPO/RTO do banco gerenciado.

Produção permanece bloqueada enquanto esses itens dependentes do ambiente não forem executados por autoridade externa.
