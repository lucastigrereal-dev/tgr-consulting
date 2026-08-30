# TGR Consulting — Known Issues e gates externos

Este registro separa dívida implementável de decisões de negócio e de dependências externas. Código e testes são a autoridade para o estado atual.

## Gates externos para produção

1. **OAuth real:** login/logout e cookies foram testados localmente, mas o provedor de produção exige URL, app id e credenciais autorizadas.
2. **Object storage real:** o proxy restringe cada usuário a `igr/{userId}/exports/`, porém upload/download contra o Forge de produção depende de credenciais externas.
3. **Deploy e observabilidade:** o build local é reproduzível; preview/produção, alertas, logs centralizados e retenção precisam do ambiente escolhido.
4. **Backup gerenciado:** o restore drill MySQL efêmero é executável e destrutivo somente sobre `tgr_consulting_test`. RPO, RTO, retenção e restauração do banco gerenciado continuam decisões operacionais externas.

Nenhum desses gates autoriza o uso de credenciais no repositório.

## P1 — contratos de negócio que podem permanecer `PENDING`

1. **Carteira multidimensional:** coortes e recebíveis ainda não carregam simultaneamente produto, canal e ponto de captação em todas as linhas do ledger.
2. **Pós-cancelamento:** reembolso, devolução de inventário e liberação/reversão de holdback de comissão requerem política financeira explícita.
3. **Correção e juros:** o Payment Calendar é autoritativo sem indexação positiva. Índice, periodicidade, base e capitalização precisam ser decididos antes de entrar em snapshot oficial.
4. **Goal Seek avançado:** V0 converge e agora aplica dois levers suportados a uma branch auditável. Restrições multiobjetivo e detecção geral de não monotonicidade não fazem parte do contrato atual.
5. **Rate limit distribuído:** o limitador atual é local por processo; múltiplas réplicas exigem um store compartilhado.
6. **Jornada visual com dados completos:** o smoke autenticado cobre shell, rotas, landmarks, teclado, overflow, 1920×1080, zoom 200% e mobile. A digitação de um estudo completo no navegador ainda não substitui os testes transacionais e de domínio existentes.

## Limitações de apresentação

- PDF e PPTX são entregas executivas determinísticas, não um template de agência com edição visual irrestrita.
- XLSX contém resumo, memória de fórmulas, projeção mensal, Point Economics e Commercial Operations. Ele não pretende ser uma segunda implementação do motor.
- O Boardroom sem estudo mostra estados vazios honestos; números só aparecem após cálculo autoritativo.

## Fechado nesta rodada

- produto, estoque, fases de preço e condições comerciais normalizados;
- salvamento comercial único e transacional, com rollback provado;
- pontos de captação e Point Economics autoritativos;
- sala, workforce, ramp, turnover, treinamento e comissão autoritativos;
- Payment Calendar, coortes, carteira, aging, cancelamento, inadimplência, cura, write-off e Healthy D90;
- Goal Seek V0 preservado, validado e aplicável a cenário auditável;
- Boardroom e exportações reconciliados com o mesmo snapshot;
- approval e baseline idempotentes sob repetição sequencial e concorrente;
- startup de produção fail-closed, redaction, limite de body, rate limit local e storage tenant-bound;
- restore drill isolado e smoke autenticado responsivo.
