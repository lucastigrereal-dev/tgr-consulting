# TGR Consulting — Known Issues e gates externos

Este registro separa dívida implementável de decisões de negócio e dependências externas. Código e testes são a autoridade para o estado atual.

## Gates externos para produção

1. **OAuth real:** login/logout e cookies foram testados localmente; URL, app id e credenciais de produção não foram fornecidos.
2. **Object storage real:** o proxy restringe artefatos ao prefixo tenant-bound, mas upload/download no serviço real depende de credenciais externas.
3. **Deploy e observabilidade:** preview/produção, TLS, WAF/rede, alertas, logs centralizados e retenção dependem do ambiente autorizado.
4. **Backup gerenciado:** o restore drill local é real sobre `tgr_consulting_test`; RPO, RTO, retenção e restauração do banco gerenciado continuam externos.
5. **Rate limit distribuído:** o limitador atual é local por processo; múltiplas réplicas exigem store compartilhado.

Nenhum desses gates autoriza credenciais no repositório.

## Contratos de negócio que podem permanecer `PENDING`

1. **Carteira multidimensional:** coortes/recebíveis ainda não carregam simultaneamente produto, canal e ponto em todas as linhas do ledger.
2. **Pós-cancelamento:** reembolso, devolução de inventário e reversão/liberação de holdback exigem política financeira explícita.
3. **Correção e juros:** índice, periodicidade, base e capitalização devem ser decididos antes de entrarem em snapshot oficial.
4. **Goal Seek avançado:** V1 suporta os targets/levers registrados e estados explícitos; multiobjetivo e targets ainda marcados `unsupported` dependem de fórmula autoritativa.
5. **Edição click-only completa:** o E2E master usa browser real para a jornada visível e tRPC autenticado para preparar domínios sem editor integral. Transformar todo o setup complexo em digitação por UI permanece melhoria de produto, não prova já concluída.
6. **Operação por turno e ICP por ponto:** os agregados atuais cobrem capacidade, captação e Point Economics, mas `Shift`, `CaptorPlan`, sazonalidade e ICP por ponto ainda não possuem contrato autoritativo completo.
7. **Meios de pagamento avançados:** antecipação, chargeback, PIX e políticas por adquirente exigem premissas comerciais e financeiras antes de alterar caixa oficial.
8. **Impact Cascade e regressão visual:** o impacto financeiro determinístico e a matriz responsiva estão cobertos; grafo causal interativo e baseline pixel-a-pixel permanecem evolução de produto/apresentação.

## Higiene histórica

- A migration `0013` impede novas duplicações de approval/baseline, mas não apaga automaticamente eventos duplicados preexistentes. Qualquer saneamento do banco real exige inspeção e autorização.

## Limitações de apresentação

- PDF/PPTX são entregas executivas determinísticas, não templates de agência com edição visual irrestrita.
- XLSX contém oito abas reconciliadas ao snapshot/export pack; não é uma segunda implementação do motor.
- O Boardroom sem estudo mostra estados vazios honestos; números surgem apenas de cálculo autoritativo.

## Fechado nesta rodada

- Builder com `PROVIDED`/`PENDING` e domínios financeiros reconciliados;
- Goal Seek V1 preservado/evoluído, recalculado server-side, auditável e protegido contra payload forjado, divergência e corrida;
- snapshots com identidade analítica `horizonMonths` + `asOfMonth` + ordinal monotônica;
- Boardroom fullscreen de 16 capítulos, responsivo e operável por teclado;
- comparação persistida e exports PDF/PPTX/XLSX com seleção/hash reproduzíveis;
- approval/baseline idempotentes, tenancy e imutabilidade provadas;
- headers/CSP, request ID, redaction, body limit, rate limit local e startup de produção fail-closed;
- migrations legadas, suíte completa, E2E master e restore drill certificados localmente.
- Cost Catalog ligado ao snapshot oficial com tratamento explícito contra dupla contagem, clone de cenário, migration legada segura e Formula Set `1.9.0`.
