import { describe, expect, it } from "vitest";
import { simulateCaptadorChange } from "./meetingSimulator";
import type { FinancialInputSnapshot } from "./types";
import { GOLDEN_NATAL_PONTA_NEGRA_2026 } from "./natalGolden";

const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const, sourceRef: "meeting-simulator-test" });
const inputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("100"), qualifiedCouplesGrowthRate: provided("0"), conversionRate: provided("0.1"), averageTicket: provided("1000"),
  collectionRate: provided("0.8"), cancellationRate: provided("0.1"), variableCostRate: provided("0.2"), partnerShareRate: provided("0.05"),
  fixedCostMonthly: provided("1000"), payrollMonthly: provided("10000"), capexInitial: provided("5000"), preOperationMonths: provided("0"), entryValuePerContract: provided("100"),
  paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"),
  paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"),
  paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"),
  paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"),
  paymentBoletoMixRate: provided("0"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"), discountRateAnnual: provided("0.12"),
};

describe("simulateCaptadorChange", () => {
  it("simula a retirada de captadores sem alterar o input original", () => {
    const result = simulateCaptadorChange({ inputs, horizonMonths: 12, captadorDelta: "-2", qualifiedCouplesPerCaptadorMonth: "12", loadedCostPerCaptadorMonth: "3500" });
    expect(result.mode).toBe("non_persistent");
    expect(result.before.qualifiedCouplesMonth1).toBe("100.00000000");
    expect(result.after.qualifiedCouplesMonth1).toBe("76.00000000");
    expect(result.after.payrollMonthly).toBe("3000.00000000");
    expect(inputs.qualifiedCouplesMonth1.value).toBe("100");
    expect(inputs.payrollMonthly.value).toBe("10000");
  });

  it("aceita ticket e custo fixo como alavancas adicionais na mesma cópia", () => {
    const result = simulateCaptadorChange({
      inputs,
      horizonMonths: 12,
      captadorDelta: "0",
      qualifiedCouplesPerCaptadorMonth: "12",
      loadedCostPerCaptadorMonth: "3500",
      averageTicketDelta: "250",
      fixedCostMonthlyDelta: "-100",
    });

    expect(result.after.averageTicket).toBe("1250.00000000");
    expect(result.after.fixedCostMonthly).toBe("900.00000000");
    expect(result.after.kpis.npv).not.toBe(result.before.kpis.npv);
  });

  it("simula folha, comissão/incentivo mensal e CAPEX sem persistir a hipótese", () => {
    const result = simulateCaptadorChange({
      inputs, horizonMonths: 12, captadorDelta: "0", qualifiedCouplesPerCaptadorMonth: "12", loadedCostPerCaptadorMonth: "3500",
      payrollMonthlyDelta: "750", variableCostMonthlyDelta: "500", capexInitialDelta: "2500",
    });
    expect(result.after.payrollMonthly).toBe("10750.00000000");
    expect(result.after.variableCostMonthly).toBe("2500.00000000");
    expect(result.after.variableCostRate).toBe("0.25000000");
    expect(result.after.capexInitial).toBe("7500.00000000");
    expect(result.marginal.investment).toBe("2500.00000000");
    expect(result.marginal.cost).not.toBe("0.00000000");
    expect(result.marginal.recoveryMonths).toBeNull();
    expect(result.marginal.method).toContain("investimento adicional");
    expect(result.marginal.byLever.map(item => item.key)).toEqual(["folha", "comissao", "capex"]);
    expect(result.marginal.byLever.find(item => item.key === "capex")?.marginal.investment).toBe("2500.00000000");
    expect(inputs.payrollMonthly.value).toBe("10000");
    expect(inputs.variableCostRate.value).toBe("0.2");
    expect(inputs.capexInitial.value).toBe("5000");
  });

  it("limita o estoque ativo e permite revender contratos cancelados na base e na simulação", () => {
    const result = simulateCaptadorChange({
      inputs,
      horizonMonths: 12,
      captadorDelta: "10",
      qualifiedCouplesPerCaptadorMonth: "100",
      loadedCostPerCaptadorMonth: "0",
      maxContracts: "2",
    });

    expect(result.before.kpis.grossSales).toBe("2222.22222222");
    expect(result.after.kpis.grossSales).toBe("2222.22222222");
    expect(result.marginal.grossSales).toBe("0.00000000");
  });

  it("deriva qualificados da meta mensal de vendas sem alterar o Golden Natal", () => {
    const originalInputs = structuredClone(GOLDEN_NATAL_PONTA_NEGRA_2026.inputs);
    const result = simulateCaptadorChange({
      inputs: GOLDEN_NATAL_PONTA_NEGRA_2026.inputs,
      horizonMonths: GOLDEN_NATAL_PONTA_NEGRA_2026.horizonMonths,
      calculationOptions: GOLDEN_NATAL_PONTA_NEGRA_2026.options,
      captadorDelta: "0",
      qualifiedCouplesPerCaptadorMonth: "25",
      loadedCostPerCaptadorMonth: "0",
      targetGrossSalesMonth1: "120",
      includeLeverBreakdown: false,
    });

    expect(result.before.grossSalesMonth1).toBe("100.00000000");
    expect(result.after.grossSalesMonth1).toBe("120.00000000");
    expect(result.before.qualifiedCouplesMonth1).toBe("500.00000000");
    expect(result.after.qualifiedCouplesMonth1).toBe("600.00000000");
    expect(result.before.kpis.sellOutMonth).not.toBe(result.after.kpis.sellOutMonth);
    expect(result.before.variableCostMonthly).not.toBe(result.after.variableCostMonthly);
    expect(result.before.kpis.totalOperatingCashFlow).not.toBe(result.after.kpis.totalOperatingCashFlow);
    expect(result.before.kpis.npv).not.toBe(result.after.kpis.npv);
    expect(result.before.kpis.paybackMonths).not.toBe(result.after.kpis.paybackMonths);
    expect(GOLDEN_NATAL_PONTA_NEGRA_2026.inputs).toEqual(originalInputs);
  });

  it("recalcula TIR quando o fluxo possui raiz econômica disponível", () => {
    const result = simulateCaptadorChange({
      inputs: {
        ...GOLDEN_NATAL_PONTA_NEGRA_2026.inputs,
        preOperationMonths: provided("12"),
      },
      horizonMonths: GOLDEN_NATAL_PONTA_NEGRA_2026.horizonMonths,
      calculationOptions: GOLDEN_NATAL_PONTA_NEGRA_2026.options,
      captadorDelta: "0",
      qualifiedCouplesPerCaptadorMonth: "25",
      loadedCostPerCaptadorMonth: "0",
      targetGrossSalesMonth1: "120",
      includeLeverBreakdown: false,
    });

    expect(result.before.kpis.irrAnnual).not.toBeNull();
    expect(result.after.kpis.irrAnnual).not.toBeNull();
    expect(result.before.kpis.irrAnnual).not.toBe(result.after.kpis.irrAnnual);
  });

  it("recusa meta inválida e conversão zero ao derivar qualificados", () => {
    expect(() => simulateCaptadorChange({
      inputs,
      horizonMonths: 12,
      captadorDelta: "0",
      qualifiedCouplesPerCaptadorMonth: "12",
      loadedCostPerCaptadorMonth: "0",
      targetGrossSalesMonth1: "-1",
    })).toThrow("meta de vendas");

    expect(() => simulateCaptadorChange({
      inputs: { ...inputs, conversionRate: provided("0") },
      horizonMonths: 12,
      captadorDelta: "0",
      qualifiedCouplesPerCaptadorMonth: "12",
      loadedCostPerCaptadorMonth: "0",
      targetGrossSalesMonth1: "20",
    })).toThrow("conversão maior que zero");
  });
});
