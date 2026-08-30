import { describe, expect, it } from "vitest";
import { summarizeCostCatalog } from "./costCatalog";

describe("cost catalog", () => {
  it("bloqueia a soma quando uma linha segue pendente", () => {
    expect(summarizeCostCatalog([{ category: "payroll", frequency: "monthly", amountText: null, status: "pending" }])).toEqual({ status: "blocked", pendingCount: 1 });
  });
  it("normaliza mensal, anual e one-time sem float", () => {
    expect(summarizeCostCatalog([{ category: "payroll", frequency: "monthly", amountText: "100.1", status: "provided" }, { category: "legal", frequency: "annual", amountText: "1200", status: "provided" }, { category: "operations", frequency: "one_time", amountText: "55.55", status: "provided" }])).toEqual(expect.objectContaining({ status: "valid", monthlyRunRate: "200.10000000", annualRunRate: "2401.20000000", oneTimeCosts: "55.55000000" }));
  });
});
