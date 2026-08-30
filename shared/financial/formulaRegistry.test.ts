import { describe, expect, it } from "vitest";
import { IGR_CORE_FORMULA_SET_V1 } from "./formulas";
import { FormulaRegistry } from "./formulaRegistry";

describe("Formula Registry", () => {
  it("permite múltiplas versões publicadas e seleção explícita da ativa", () => {
    const v2 = { ...IGR_CORE_FORMULA_SET_V1, id: "igr-core-formulas-v2", semanticVersion: "2.0.0" as const };
    const registry = new FormulaRegistry([IGR_CORE_FORMULA_SET_V1, v2], v2.id);
    expect(registry.list()).toHaveLength(2);
    expect(registry.getActiveFormulaSet().semanticVersion).toBe("2.0.0");
    registry.selectActiveFormulaSet(IGR_CORE_FORMULA_SET_V1.id);
    expect(registry.getActiveFormulaSet().semanticVersion).toBe("1.5.0");
  });

  it("expõe lineage recursivo de KPI até inputs", () => {
    const registry = new FormulaRegistry([IGR_CORE_FORMULA_SET_V1], IGR_CORE_FORMULA_SET_V1.id);
    const lineage = registry.getLineage("npv");
    expect(lineage.find((node) => node.id === "operating-cash-flow" && node.kind === "formula")).toBeTruthy();
    expect(lineage.find((node) => node.id === "discountRateAnnual" && node.kind === "input")).toBeTruthy();
    expect(lineage.find((node) => node.id === "averageTicket" && node.kind === "input")).toBeTruthy();
  });

  it("publica estrutura comercial e condição de pagamento como fórmulas rastreáveis", () => {
    const registry = new FormulaRegistry([IGR_CORE_FORMULA_SET_V1], IGR_CORE_FORMULA_SET_V1.id);
    const teamLineage = registry.getLineage("commercial-team-monthly-cost");
    const paymentLineage = registry.getLineage("payment-terms-net-settlement");
    const installmentLineage = registry.getLineage("installment-collections");
    const healthyLineage = registry.getLineage("healthy-d90");
    expect(teamLineage.find((node) => node.id === "payrollMonthly" && node.kind === "input")).toBeTruthy();
    expect(paymentLineage.find((node) => node.id === "net-entry-collections" && node.kind === "formula")).toBeTruthy();
    expect(installmentLineage.find((node) => node.id === "paymentCardInstallmentMdrRate" && node.kind === "input")).toBeTruthy();
    expect(installmentLineage.find((node) => node.id === "paymentCardInstallmentSettlementDays" && node.kind === "input")).toBeTruthy();
    expect(installmentLineage.find((node) => node.id === "canceled-receivables" && node.kind === "formula")).toBeTruthy();
    expect(installmentLineage.find((node) => node.id === "collectionRate")).toBeFalsy();
    expect(healthyLineage.find((node) => node.id === "cancellationCurveD90" && node.kind === "input")).toBeTruthy();
    expect(healthyLineage.find((node) => node.id === "cureRates" && node.kind === "input")).toBeTruthy();
    expect(IGR_CORE_FORMULA_SET_V1.id).toBe("igr-core-formulas-v1-5");
    expect(IGR_CORE_FORMULA_SET_V1.semanticVersion).toBe("1.5.0");
  });

  it("recusa ativar formula set que não foi publicado", () => {
    const draft = { ...IGR_CORE_FORMULA_SET_V1, id: "igr-draft", status: "draft" as const };
    const registry = new FormulaRegistry([IGR_CORE_FORMULA_SET_V1, draft], IGR_CORE_FORMULA_SET_V1.id);
    expect(() => registry.selectActiveFormulaSet(draft.id)).toThrow("publicado");
  });
});
