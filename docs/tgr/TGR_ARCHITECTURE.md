# TGR Consulting — Architecture

## Visão

```text
React/Vite UI
  ├─ Builder
  ├─ Scenario Lab
  ├─ Boardroom Premium
  └─ Governance / exports
          │ tRPC autenticado
Express + tRPC routers
          │ tenant derivado da sessão
Persistence services (server/db.ts)
          │ transações + auditoria
MySQL 8 / Drizzle migrations

Shared financial domain
  ├─ Decimal engine + Formula Registry 1.8.0
  ├─ inventory / commercial condition / payment calendar
  ├─ point economics / commercial operations / commissions
  ├─ cohorts / receivables portfolio
  └─ Goal Seek V1 / Capital Envelope / Impact map
```

## Fronteiras

- `client/src`: apresentação e comandos; não contém um segundo motor financeiro.
- `shared/financial`: domínio determinístico, Decimal e contratos compartilhados.
- `server/routers`: validação de entrada, autenticação e superfície tRPC.
- `server/db.ts`: tenancy, lifecycle, transações, snapshots e auditoria.
- `server/financial`: snapshot e artefatos derivados.
- `drizzle`: schema e migrations ordenadas `0000`–`0016`.

## Fluxo autoritativo

`inputs/componentes → cálculo validado → snapshot hash → decisão → aprovação → baseline → export`.

O snapshot fixa formula set, horizonte, input hash, payload calculado e snapshot hash. A UI, o Boardroom e os exports leem esse mesmo payload. Uma versão `baseline` recebe `isImmutable=true`; edição exige uma branch de cenário.

Cada branch também mantém `financialRevision`. Inputs, produto, condições comerciais, carteira, captação, operações, workforce e custos incrementam a revisão dentro da mesma transação da mudança. O Goal Seek recalcula no servidor e só grava se `inputHash` e `financialRevision` ainda forem exatamente os observados; uma corrida causa rollback integral. A criação do snapshot bloqueia a versão, valida novamente estado/revisão/hash/formula set e faz a transição de lifecycle com predicados otimistas; qualquer drift concorrente reverte snapshot, memória, workflow e auditoria.

O Cost Catalog participa do domínio autoritativo e do hash. A classificação `incremental` ajusta `fixedCostMonthly`, `payrollMonthly` ou `capexInitial`; `included_in_project_totals` evita dupla contagem. A classificação e as linhas são clonadas para cenários.

## Decisões operacionais

- aplicação monolítica modular é suficiente para a rodada atual;
- MySQL é a persistência autoritativa; storage guarda somente artefatos;
- rate limit é local por processo, com store distribuído pendente se houver múltiplas réplicas;
- `TRUST_PROXY` é opt-in explícito;
- logs HTTP carregam request/correlation ID e passam por redaction.
