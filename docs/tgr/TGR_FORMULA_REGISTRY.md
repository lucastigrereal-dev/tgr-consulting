# TGR Consulting — Formula Registry

## Formula set ativo

- ID: `igr-core-formulas-v1-7`
- versão semântica: `1.7.0`
- engine: `igr-engine-1.7.0`
- estado: `published`
- fonte executável: `shared/financial/formulas.ts`

## Fórmulas publicadas

| Domínio | IDs |
| --- | --- |
| Produção comercial | `commercial-operations`, `commission-policy`, `point-economics`, `qualified-couples`, `gross-sales` |
| Comercial e recebíveis | `gross-entry-generated`, `gross-receivables-generated`, `installment-collections`, `gross-receivables-settled`, `canceled-receivables`, `delinquent-balance`, `cured-collections`, `written-off-balance`, `healthy-d90` |
| Caixa | `net-entry-collections`, `pre-operational-investment`, `commercial-team-monthly-cost`, `payment-terms-net-settlement`, `operating-cash-flow` |
| Retorno | `npv`, `irr`, `payback` |

Cada definição contém ID, nome, versão própria, expressão, dependências e explicação. `FormulaRegistry` recusa set vazio, ID duplicado, fórmula ausente e ativação de set não publicado; também expõe lineage fórmula→fórmula/input.

## Goal Seek V1

Targets calculáveis atuais: `grossSales`, `npv`, `totalOperatingCashFlow`, `capitalNeed`, `paybackMonths`, `healthyD90` e `grossEntryGenerated`.

`costPerHealthyD90` e `pointBreakEven` permanecem registrados como `unsupported` porque o snapshot agregado ainda não oferece fórmula autoritativa suficiente para solucioná-los. Essa resposta é deliberada e auditável; o sistema não fabrica uma aproximação.

Levers, bounds, variáveis autorizadas e monotonicidade ficam centralizados em `shared/financial/goalseek.ts`. Antes de buscar uma raiz, o solver valida bounds, suporte, combinação target/lever e monotonicidade observada.

## Regra de mudança

Uma alteração financeira exige teste vermelho, nova versão da fórmula quando sua semântica muda, regressão/golden aplicável e recertificação do snapshot/export. Texto documental não altera resultado do motor.
