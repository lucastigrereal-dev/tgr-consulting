import { describe, expect, it } from "vitest";
import { deriveCostCatalogCashflowAdjustments, summarizeCostCatalog } from "./costCatalog";

describe("cost catalog", () => {
  it("bloqueia a soma quando uma linha segue pendente", () => {
    expect(summarizeCostCatalog([{ category: "payroll", frequency: "monthly", amountText: null, status: "pending" }])).toEqual({ status: "blocked", pendingCount: 1 });
  });
  it("normaliza mensal, anual e one-time sem float", () => {
    expect(summarizeCostCatalog([{ category: "payroll", frequency: "monthly", amountText: "100.1", status: "provided" }, { category: "legal", frequency: "annual", amountText: "1200", status: "provided" }, { category: "operations", frequency: "one_time", amountText: "55.55", status: "provided" }])).toEqual(expect.objectContaining({ status: "valid", monthlyRunRate: "200.10000000", annualRunRate: "2401.20000000", oneTimeCosts: "55.55000000" }));
  });
  it("deriva somente custos incrementais para caixa sem dupla contagem", () => {
    expect(deriveCostCatalogCashflowAdjustments([
      { category: "operations", frequency: "monthly", amountText: "12000", status: "provided", cashflowTreatment: "incremental" },
      { category: "payroll", frequency: "annual", amountText: "1200", status: "provided", cashflowTreatment: "incremental" },
      { category: "technology", frequency: "one_time", amountText: "5000", status: "provided", cashflowTreatment: "incremental" },
      { category: "partner", frequency: "monthly", amountText: "999", status: "provided", cashflowTreatment: "included_in_project_totals" },
    ])).toEqual({ status: "valid", fixedCostMonthly: "12000.00000000", payrollMonthly: "100.00000000", capexInitial: "5000.00000000" });
  });
  it("bloqueia caixa quando um custo incremental permanece pendente", () => {
    expect(deriveCostCatalogCashflowAdjustments([
      { category: "operations", frequency: "monthly", amountText: null, status: "pending", cashflowTreatment: "incremental" },
      { category: "legal", frequency: "annual", amountText: null, status: "pending", cashflowTreatment: "included_in_project_totals" },
    ])).toEqual({ status: "blocked", pendingCount: 1 });
  });
});
