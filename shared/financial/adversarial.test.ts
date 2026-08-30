import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { calculateFinancialProjection } from "./engine";
import { NATAL_PENDING_SEED } from "./natalSeed";
import type { FinancialInputSnapshot } from "./types";

const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const });
const benchmarkInputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("100"), qualifiedCouplesGrowthRate: provided("0"), conversionRate: provided("0.1"), averageTicket: provided("1000"),
  collectionRate: provided("0.8"), cancellationRate: provided("0.1"), variableCostRate: provided("0.2"), partnerShareRate: provided("0.05"),
  fixedCostMonthly: provided("1000"), payrollMonthly: provided("1000"), capexInitial: provided("5000"), preOperationMonths: provided("0"), entryValuePerContract: provided("100"),
  paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"),
  paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"),
  paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"),
  paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"),
  paymentBoletoMixRate: provided("0"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"), discountRateAnnual: provided("0.12"),
};

describe("auditoria adversarial do motor", () => {
  it("mantém o seed Natal bloqueado sem transformar pendência em valor falso", () => {
    const result = calculateFinancialProjection(NATAL_PENDING_SEED, 120);
    expect(result.status).toBe("blocked_by_pending_inputs");
    expect(result.projections).toEqual([]);
    expect(result.kpis.npv).toBeNull();
    expect(result.missingInputKeys).toHaveLength(29);
  });

  it("emite timeline com precisão decimal fixa e sem NaN/Infinity", () => {
    const result = calculateFinancialProjection(benchmarkInputs, 120);
    expect(result.status).toBe("valid");
    for (const row of result.projections) {
      for (const value of Object.values(row).filter((candidate) => typeof candidate === "string")) {
        expect(value).toMatch(/^-?\d+\.\d{8}$/);
        expect(value).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it("calcula 10 projeções interativas de 120 meses dentro do orçamento local", () => {
    const start = performance.now();
    for (let index = 0; index < 10; index += 1) calculateFinancialProjection(benchmarkInputs, 120);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
