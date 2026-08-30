import { describe, expect, it } from "vitest";
import { calculateAuthoritativeSnapshot } from "./snapshot";
import type { FinancialInputSnapshot } from "../../shared/financial/types";

const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const });
const inputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("5"), qualifiedCouplesGrowthRate: provided("0"), conversionRate: provided("0.1"),
  averageTicket: provided("1000"), collectionRate: provided("1"), cancellationRate: provided("0"),
  variableCostRate: provided("0"), partnerShareRate: provided("0"), fixedCostMonthly: provided("0"),
  payrollMonthly: provided("0"), capexInitial: provided("0"), preOperationMonths: provided("0"), entryValuePerContract: provided("100"),
  paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"),
  paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"),
  paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"),
  paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"),
  paymentBoletoMixRate: provided("0"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"), discountRateAnnual: provided("0"),
};

describe("snapshot autoritativo", () => {
  it("produz hash estável para a mesma entrada", () => {
    const first = calculateAuthoritativeSnapshot({ inputs, horizonMonths: 12, formulaSetVersionId: "igr-core-formulas-v1" });
    const second = calculateAuthoritativeSnapshot({ inputs, horizonMonths: 12, formulaSetVersionId: "igr-core-formulas-v1" });
    expect(first.snapshotHash).toEqual(second.snapshotHash);
    expect(first.snapshotHash).toHaveLength(64);
  });

  it("não expõe KPIs nem projeções quando um domínio autoritativo bloqueia o cálculo", () => {
    const result = calculateAuthoritativeSnapshot({
      inputs,
      horizonMonths: 12,
      formulaSetVersionId: "igr-core-formulas-v1",
      domainBlockers: ["product_catalog.missing"],
    });

    expect(result.status).toBe("blocked_by_pending_inputs");
    expect(result.projections).toEqual([]);
    expect(result.memory).toEqual([]);
    expect(Object.values(result.kpis)).toEqual(Array(9).fill(null));
  });

  it("prioriza invalididade autoritativa mesmo quando o motor financeiro tem pendências", () => {
    const pendingInputs: FinancialInputSnapshot = {
      ...inputs,
      averageTicket: { status: "pending", sourceType: "current_decision" },
    };
    const result = calculateAuthoritativeSnapshot({
      inputs: pendingInputs,
      horizonMonths: 12,
      formulaSetVersionId: "igr-core-formulas-v1",
      domainInvalidities: ["product_catalog.invalid"],
    });

    expect(result.status).toBe("invalid");
    expect(result.projections).toEqual([]);
    expect(Object.values(result.kpis)).toEqual(Array(9).fill(null));
  });
});
